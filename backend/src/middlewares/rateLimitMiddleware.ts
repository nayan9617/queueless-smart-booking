import rateLimit from 'express-rate-limit';
import { isDangerousFlagEnabled } from '../utils/envSafety';
import { bump } from '../utils/betaCounters';
import { logger } from '../utils/logger';

const skipWhenDisabled = () => isDangerousFlagEnabled('DISABLE_RATE_LIMIT');

/** Soft limit for auth endpoints (brute-force resistance). */
export const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipWhenDisabled,
    handler: (req, res, _next, options) => {
        bump('rateLimitRejected');
        logger.warn('rate_limit_rejected', { kind: 'auth', path: req.path });
        res.status(options.statusCode).json({
            message: 'Too many auth attempts. Try again in a few minutes.',
        });
    },
    message: { message: 'Too many auth attempts. Try again in a few minutes.' },
});

/** Soft limit for booking creation (double-click / spam). */
export const bookingCreateLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 8,
    standardHeaders: true,
    legacyHeaders: false,
    skip: skipWhenDisabled,
    handler: (req, res, _next, options) => {
        bump('rateLimitRejected');
        logger.warn('rate_limit_rejected', { kind: 'booking_create', path: req.path });
        res.status(options.statusCode).json({
            message: 'Too many booking requests. Please wait a moment.',
        });
    },
    message: { message: 'Too many booking requests. Please wait a moment.' },
});
