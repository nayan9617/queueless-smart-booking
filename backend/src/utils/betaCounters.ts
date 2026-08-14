/** In-memory beta counters (single instance). Reset on process restart. */
const counters = {
    mlRequested: 0,
    mlSucceeded: 0,
    mlFallback: 0,
    paymentVerifySucceeded: 0,
    paymentVerifyFailed: 0,
    bookingIdempotencyConflict: 0,
    rateLimitRejected: 0,
    socketAuthFailed: 0,
};

export const bump = (key: keyof typeof counters, n = 1) => {
    counters[key] += n;
};

export const snapshotCounters = () => ({ ...counters });
