import { getRequestContext } from './requestContext';

type LogLevel = 'info' | 'warn' | 'error';

const SENSITIVE = /(password|token|jwt|secret|authorization|razorpay_signature|razorpay_key|emailVerification)/i;

function scrub(value: unknown): unknown {
    if (value == null) return value;
    if (typeof value === 'string') {
        if (SENSITIVE.test(value) && value.length > 20) return '[redacted]';
        return value;
    }
    if (Array.isArray(value)) return value.map(scrub);
    if (typeof value === 'object') {
        const out: Record<string, unknown> = {};
        for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
            out[k] = SENSITIVE.test(k) ? '[redacted]' : scrub(v);
        }
        return out;
    }
    return value;
}

export function log(level: LogLevel, message: string, meta?: Record<string, unknown>) {
    const ctx = getRequestContext();
    const line = {
        ts: new Date().toISOString(),
        level,
        msg: message,
        requestId: ctx.requestId,
        userId: ctx.userId,
        salonId: ctx.salonId,
        bookingId: ctx.bookingId,
        ...(meta ? (scrub(meta) as object) : {}),
    };
    const text = JSON.stringify(line);
    if (level === 'error') console.error(text);
    else if (level === 'warn') console.warn(text);
    else console.log(text);
}

export const logger = {
    info: (message: string, meta?: Record<string, unknown>) => log('info', message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log('warn', message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log('error', message, meta),
    event: (event: string, meta?: Record<string, unknown>) =>
        log('info', event, { event, ...meta }),
};
