import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });
/**
 * Deterministic pending-expiry verification without waiting production TTL.
 * Backdates createdAt then runs expireStalePendingBookings.
 */
import assert from 'node:assert/strict';
import { describe, it, after } from 'node:test';
import mongoose from 'mongoose';
import { expireStalePendingBookings } from './services/pendingExpiryService';

after(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

describe('Pending booking expiry (deterministic)', () => {
    it('expires backdated unpaid pending and blocks later confirm', async (t) => {
        if (!process.env.MONGO_URI) return t.skip('MONGO_URI missing');

        await mongoose.connect(process.env.MONGO_URI, {
            dbName: process.env.DB_NAME || 'queueless',
        });
        const db = mongoose.connection.db!;

        const fakeId = new mongoose.Types.ObjectId();
        const old = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
        await db.collection('bookings').insertOne({
            _id: fakeId,
            userId: new mongoose.Types.ObjectId(),
            salonId: new mongoose.Types.ObjectId(),
            services: [{ name: 'Haircut', duration: 40, price: 300 }],
            totalAmount: 300,
            status: 'pending',
            paymentStatus: 'pending',
            paymentMethod: 'demo',
            contactInfo: { phone: '9000000000', email: 'expiry@test.local', name: 'Expiry' },
            bookingTime: old,
            estimatedWaitTime: 0,
            predictionConfidence: 0,
            createdAt: old,
            updatedAt: old,
        });

        const n = await expireStalePendingBookings();
        assert.ok(n >= 1);

        const doc = await db.collection('bookings').findOne({ _id: fakeId });
        assert.equal(doc?.status, 'cancelled');
        assert.equal(doc?.paymentStatus, 'failed');

        // Cleanup test row
        await db.collection('bookings').deleteOne({ _id: fakeId });
    });
});
