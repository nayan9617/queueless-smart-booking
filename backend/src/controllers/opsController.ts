import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Booking from '../models/Booking';
import { snapshotCounters } from '../utils/betaCounters';
import { probeMlHealth } from '../services/mlService';

/** Public, low-detail health for beta uptime checks. */
export const getHealth = async (_req: Request, res: Response) => {
    const mongo = mongoose.connection.readyState === 1;
    const ml = await probeMlHealth();
    const ok = mongo;
    res.status(ok ? 200 : 503).json({
        ok,
        services: {
            api: true,
            mongo,
            ml: ml.ok,
        },
    });
};

/** Founder-only beta snapshot. Requires BETA_OPS_SECRET header. No PII. */
export const getBetaStats = async (_req: Request, res: Response) => {
    const secret = process.env.BETA_OPS_SECRET;
    if (!secret) {
        return res.status(404).json({ message: 'Not found' });
    }

    const start = new Date();
    start.setHours(0, 0, 0, 0);

    const [byStatus, pendingUnpaid, completedToday, organicCompleted] = await Promise.all([
        Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
        Booking.countDocuments({ status: 'pending', paymentStatus: { $in: ['pending', 'failed'] } }),
        Booking.countDocuments({ status: 'completed', updatedAt: { $gte: start } }),
        Booking.countDocuments({
            status: 'completed',
            dataOrigin: { $ne: 'synthetic' },
            actualWaitMinutes: { $exists: true },
        }),
    ]);

    const statusMap = Object.fromEntries(byStatus.map((r) => [r._id, r.count]));

    res.json({
        generatedAt: new Date().toISOString(),
        bookings: {
            pending: statusMap.pending || 0,
            pendingUnpaid,
            confirmed: statusMap.confirmed || 0,
            inProgress: statusMap['in-progress'] || 0,
            completed: statusMap.completed || 0,
            completedToday,
            cancelled: statusMap.cancelled || 0,
            noShow: statusMap['no-show'] || 0,
            organicCompletedWithActualWait: organicCompleted,
        },
        processCounters: snapshotCounters(),
    });
};
