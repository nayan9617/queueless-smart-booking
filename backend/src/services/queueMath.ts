/**
 * Pure helpers used by the queue engine — unit-tested without Mongo.
 */

export const concurrentSlotCount = (
    chairs: number,
    availableStaff: number,
    totalStaff: number
): number => {
    const staffCapacity =
        availableStaff > 0 ? availableStaff : Math.max(1, totalStaff || chairs || 1);
    return Math.max(1, Math.min(Math.max(1, chairs || 1), staffCapacity));
};

export const clampStartMs = (
    bookingTimeMs: number,
    nowMs: number,
    waitMinutes: number
): number => {
    const wait = Math.max(0, waitMinutes || 0);
    return Math.max(bookingTimeMs || nowMs, nowMs + wait * 60000);
};

export const remainingServiceMinutes = (
    durationMin: number,
    status: string,
    actualStartTime: Date | string | null | undefined,
    nowMs: number
): number => {
    const duration = Math.max(0, durationMin || 0);
    if (status === 'in-progress' && actualStartTime) {
        const elapsed = Math.max(0, (nowMs - new Date(actualStartTime).getTime()) / 60000);
        return Math.max(0, duration - elapsed);
    }
    return duration;
};
