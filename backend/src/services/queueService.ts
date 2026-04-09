import Booking from '../models/Booking';
import Salon from '../models/Salon';
import { getIO } from '../socket';
import { sendBookingUpdate } from './emailService';

export const recalculateSalonQueue = async (salonId: string) => {
    console.log('Queue Service: Recalculating for', salonId);
    try {
        const salon = await Salon.findById(salonId);
        if (!salon) return;

        // 1. Get all active bookings
        // - In-progress: Needed to know when chairs free up
        // - Confirmed: The queue to be scheduled
        const activeBookings = await Booking.find({
            salonId,
            status: { $in: ['in-progress', 'confirmed'] }
        }).sort({ bookingTime: 1 }); // FIFO

        const inProgress = activeBookings.filter(b => b.status === 'in-progress');
        const confirmed = activeBookings.filter(b => b.status === 'confirmed');

        // 2. Initialize Chairs
        // Each chair tracks when it will be free (timestamp in ms)
        // If salon has 3 chairs, we initiate with [now, now, now]
        // If in-progress booking exists, it occupies a chair until (actualStartTime + duration)
        const now = Date.now();

        // Calculate concurrency based on available staff and chairs
        // We can't serve more customers than we have staff, even if we have chairs.
        // @ts-ignore
        const availableStaff = salon.staff ? salon.staff.filter(s => s.isAvailable).length : salon.chairs;
        const concurrentSlots = Math.max(1, Math.min(salon.chairs, availableStaff));

        console.log(`Queue Calc: Chairs=${salon.chairs}, Staff=${availableStaff}, Slots=${concurrentSlots}`);

        const chairs: number[] = new Array(concurrentSlots).fill(now);

        // Assign in-progress bookings to chairs first
        // We assume they take up the "first" available chairs for simplicity in calculation, 
        // effectively reducing availability.
        inProgress.forEach(booking => {
            // Find earliest available chair (which is 'now' initially)
            // But actually, for in-progress, we need to add their REMAINING time to 'now' 
            // OR use their actual End Time.
            // Formula: EndTime = ActualStartTime + TotalDuration
            const startTime = booking.actualStartTime ? new Date(booking.actualStartTime).getTime() : now;

            // Calculate total duration of services
            // @ts-ignore
            const durationMin = booking.services.reduce((acc, s) => acc + (s.duration || 30), 0);
            const endTime = startTime + (durationMin * 60000);

            // Find the chair that is free earliest (should be 'now') and occupy it
            const earliestChairIdx = chairs.indexOf(Math.min(...chairs));

            // If endTime is in past (shouldn't happen for in-progress), set to now
            chairs[earliestChairIdx] = Math.max(now, endTime);
        });

        // 3. Process Confirmed Queue
        for (const booking of confirmed) {
            // Find earliest free chair
            const earliestChairIdx = chairs.indexOf(Math.min(...chairs));
            const nextFreeTime = chairs[earliestChairIdx];

            // Estimated Start is nextFreeTime
            // Estimated Wait is (nextFreeTime - now)
            const estimatedWaitTimeMin = Math.max(0, Math.ceil((nextFreeTime - now) / 60000));

            // Calculate this booking's duration
            // @ts-ignore
            const durationMin = booking.services.reduce((acc, s) => acc + (s.duration || 30), 0);

            // Update chair to be busy until Start + Duration
            chairs[earliestChairIdx] = nextFreeTime + (durationMin * 60000);

            // 4. Update Booking if significant change (> 2 mins difference)
            // 4. Update Booking if significant change (> 2 mins difference) AND NOT manually overridden
            // @ts-ignore
            const oldWaitTime = booking.estimatedWaitTime;
            // @ts-ignore
            const isOverridden = booking.isTimeOverridden;

            if (!isOverridden && (oldWaitTime === undefined || Math.abs(oldWaitTime - estimatedWaitTimeMin) > 2)) {
                // @ts-ignore
                booking.estimatedWaitTime = estimatedWaitTimeMin;
                // @ts-ignore
                booking.estimatedStartTime = new Date(nextFreeTime);
                await booking.save();

                // Notify User (Email) - Only if change is large (e.g. > 10 mins) or if it's "Your turn is soon"
                // To avoid spam, maybe only send if time reduced significantly or increased?
                // For now, let's keep email logic conservative or commented out to avoid spam during testing.
                // Or user requested: "dynamically adjust... [and] update". User didn't explicitly ask for email on EVERY update, but implied "shown... accurate".
                // Display update via Socket is most important.

                // Emit socket update
                // @ts-ignore
                getIO().emit(`queue-update-${salonId}`, {
                    type: 'ESTIMATE_UPDATE',
                    bookingId: booking._id,
                    estimatedWaitTime: estimatedWaitTimeMin
                });
            }
        }

    } catch (error) {
        console.error('Queue Recalculation Error:', error);
    }
};
