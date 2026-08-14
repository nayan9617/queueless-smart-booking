import Booking from '../models/Booking';
import Salon from '../models/Salon';
import { getIO } from '../socket';
import { predictWaitTime } from './mlService';
import { logger } from '../utils/logger';
import {
    clampStartMs,
    concurrentSlotCount,
    remainingServiceMinutes,
} from './queueMath';

/**
 * Live queue: discrete-event chair simulation (ground truth for "who's next"),
 * blended with the ML hybrid so peak/weekend/load effects stay learned.
 */
export const recalculateSalonQueue = async (salonId: string) => {
    logger.event('queue_recalculated', { salonId });
    try {
        const salon = await Salon.findById(salonId);
        if (!salon) return;

        const activeBookings = await Booking.find({
            salonId,
            status: { $in: ['in-progress', 'confirmed'] },
            paymentStatus: 'paid',
        }).sort({ bookingTime: 1 });

        const inProgress = activeBookings.filter((b) => b.status === 'in-progress');
        const confirmed = activeBookings.filter((b) => b.status === 'confirmed');

        const nowMs = Date.now();
        const now = new Date(nowMs);

        // @ts-ignore
        const availableStaff = salon.staff
            ? // @ts-ignore
              salon.staff.filter((s) => s.isAvailable).length
            : 0;
        const totalStaff = salon.staff?.length || 0;
        const concurrentSlots = concurrentSlotCount(salon.chairs, availableStaff, totalStaff);
        const chairs: number[] = new Array(concurrentSlots).fill(nowMs);

        const remainingDuration = (booking: any) => {
            const durationMin = (booking.services || []).reduce(
                (acc: number, s: any) => acc + (s.duration || 30),
                0
            );
            return remainingServiceMinutes(
                durationMin,
                booking.status,
                booking.actualStartTime,
                nowMs
            );
        };

        inProgress.forEach((booking) => {
            const startTime = booking.actualStartTime
                ? new Date(booking.actualStartTime).getTime()
                : nowMs;
            const durationMin = (booking.services || []).reduce(
                (acc: number, s: any) => acc + (s.duration || 30),
                0
            );
            const endTime = startTime + durationMin * 60000;
            const earliestChairIdx = chairs.indexOf(Math.min(...chairs));
            chairs[earliestChairIdx] = Math.max(nowMs, endTime);
        });

        let peopleAhead = inProgress.length;
        let workloadAhead = inProgress.reduce((sum, b) => sum + remainingDuration(b), 0);

        const timeOfDay = now.getHours() * 60 + now.getMinutes();
        const dayOfWeek = (now.getDay() + 6) % 7;

        for (const booking of confirmed) {
            const earliestChairIdx = chairs.indexOf(Math.min(...chairs));
            const nextFreeTime = chairs[earliestChairIdx];
            const physicsWait = Math.max(0, Math.ceil((nextFreeTime - nowMs) / 60000));

            const durationMin = (booking.services || []).reduce(
                (acc: number, s: any) => acc + (s.duration || 30),
                0
            );

            chairs[earliestChairIdx] = nextFreeTime + durationMin * 60000;

            let estimatedWaitTimeMin = physicsWait;
            let confidence: number | undefined;

            try {
                const ml = await predictWaitTime({
                    queue_length: peopleAhead,
                    active_barbers: concurrentSlots,
                    service_duration_avg: durationMin || 30,
                    time_of_day: timeOfDay,
                    day_of_week: dayOfWeek,
                    total_chairs: salon.chairs,
                    queue_workload: workloadAhead,
                });
                estimatedWaitTimeMin = Math.max(
                    0,
                    Math.round(0.62 * physicsWait + 0.38 * ml.waitTime)
                );
                confidence = ml.confidence;
            } catch {
                estimatedWaitTimeMin = physicsWait;
            }

            peopleAhead += 1;
            workloadAhead += durationMin;

            // @ts-ignore
            const oldWaitTime = booking.estimatedWaitTime;
            // @ts-ignore
            const isOverridden = booking.isTimeOverridden;

            if (
                !isOverridden &&
                (oldWaitTime === undefined || Math.abs(oldWaitTime - estimatedWaitTimeMin) > 2)
            ) {
                const bookingTimeMs = booking.bookingTime
                    ? new Date(booking.bookingTime).getTime()
                    : nowMs;
                const startMs = clampStartMs(bookingTimeMs, nowMs, estimatedWaitTimeMin);
                const clampedWait = Math.max(0, Math.ceil((startMs - nowMs) / 60000));

                // @ts-ignore
                booking.estimatedWaitTime = clampedWait;
                // @ts-ignore
                booking.estimatedStartTime = new Date(startMs);
                if (typeof confidence === 'number') {
                    // @ts-ignore
                    booking.predictionConfidence = confidence;
                }
                await booking.save();

                const payload = {
                    type: 'ESTIMATE_UPDATE',
                    bookingId: booking._id,
                    estimatedWaitTime: clampedWait,
                    estimatedStartTime: new Date(startMs),
                    confidence,
                };
                getIO().to(salonId).emit('booking_updated', payload);
                getIO().emit(`queue-update-${salonId}`, payload);
                if (booking.userId) {
                    getIO().to(`user:${String(booking.userId)}`).emit('booking_updated', payload);
                }
            }
        }
    } catch (error) {
        console.error('Queue Recalculation Error:', error);
    }
};
