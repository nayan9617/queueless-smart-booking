import Salon from '../models/Salon';
import mongoose from 'mongoose';

/**
 * Atomically claim one chair slot for a salon.
 * Uses a compare-and-increment on Salon.inProgressCount so concurrent starts
 * cannot both succeed when at capacity (no replica-set transaction required).
 */
export const claimChairSlot = async (salonId: string | mongoose.Types.ObjectId) => {
    const claimed = await Salon.findOneAndUpdate(
        {
            _id: salonId,
            $expr: {
                $lt: [{ $ifNull: ['$inProgressCount', 0] }, { $ifNull: ['$chairs', 1] }],
            },
        },
        { $inc: { inProgressCount: 1 } },
        { new: true }
    );
    return claimed;
};

/** Release a previously claimed chair (complete / cancel mid-service). */
export const releaseChairSlot = async (salonId: string | mongoose.Types.ObjectId) => {
    await Salon.findOneAndUpdate({ _id: salonId }, [
        {
            $set: {
                inProgressCount: {
                    $max: [0, { $subtract: [{ $ifNull: ['$inProgressCount', 0] }, 1] }],
                },
            },
        },
    ]);
};
