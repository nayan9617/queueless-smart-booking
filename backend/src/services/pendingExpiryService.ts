import Booking from '../models/Booking';

const PENDING_TTL_MS = () => {
    const mins = Number(process.env.PENDING_BOOKING_TTL_MINUTES || 20);
    return Math.max(5, mins) * 60 * 1000;
};

/**
 * Expire stale unpaid pending bookings so they cannot become active later
 * and do not block the per-user-salon active booking lock forever.
 */
export const expireStalePendingBookings = async (): Promise<number> => {
    const cutoff = new Date(Date.now() - PENDING_TTL_MS());
    const result = await Booking.updateMany(
        {
            status: 'pending',
            paymentStatus: { $in: ['pending', 'failed'] },
            createdAt: { $lt: cutoff },
        },
        {
            $set: {
                status: 'cancelled',
                paymentStatus: 'failed',
                notes: 'Auto-expired: payment not completed in time',
            },
        }
    );
    const n = result.modifiedCount || 0;
    if (n > 0) {
        console.log(`Expired ${n} stale pending booking(s)`);
    }
    return n;
};

let timer: NodeJS.Timeout | null = null;

export const startPendingBookingExpiryJob = () => {
    if (timer) return;
    // Run shortly after boot, then every minute
    void expireStalePendingBookings();
    timer = setInterval(() => {
        void expireStalePendingBookings().catch((err) =>
            console.error('Pending expiry job failed:', err)
        );
    }, 60 * 1000);
    timer.unref?.();
};
