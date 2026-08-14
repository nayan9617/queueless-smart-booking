/**
 * Seed two controlled beta salons (idempotent by owner email).
 * Usage: cd backend && npx tsx src/scripts/seedBetaSalons.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';
import User from '../models/User';
import Salon from '../models/Salon';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function upsertOwner(email: string, name: string) {
    const existing = await User.findOne({ email });
    if (existing) {
        existing.emailVerified = true;
        existing.role = 'salon_owner';
        await existing.save();
        return existing;
    }
    return User.create({
        name,
        email,
        password: 'BetaSalon!24',
        role: 'salon_owner',
        phone: '9000000000',
        address: 'Beta Street, Jodhpur',
        city: 'Jodhpur',
        emailVerified: true,
    });
}

async function upsertSalon(ownerId: mongoose.Types.ObjectId, data: Record<string, unknown>) {
    const existing = await Salon.findOne({ ownerId });
    if (existing) {
        Object.assign(existing, data);
        await existing.save();
        return existing;
    }
    return Salon.create({ ownerId, ...data });
}

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI required');
    await mongoose.connect(uri, { dbName: process.env.DB_NAME || 'queueless' });

    const ownerA = await upsertOwner('beta.salon.a@queueless.local', 'Beta Owner A');
    const ownerB = await upsertOwner('beta.salon.b@queueless.local', 'Beta Owner B');

    const salonA = await upsertSalon(ownerA._id as mongoose.Types.ObjectId, {
        name: 'QueueLess Beta Salon A',
        address: '1 Beta Plaza, Sardarpura, Jodhpur',
        chairs: 3,
        coordinates: { lat: 26.2389, lng: 73.0243 },
        status: 'open',
        services: [
            { name: 'Haircut', durationMin: 40, price: 300 },
            { name: 'Beard', durationMin: 20, price: 150 },
            { name: 'Facial', durationMin: 60, price: 500 },
        ],
        staff: [
            { name: 'Amit', role: 'barber', isAvailable: true },
            { name: 'Ravi', role: 'barber', isAvailable: true },
        ],
        images: [],
        rating: 0,
        reviewCount: 0,
    });

    const salonB = await upsertSalon(ownerB._id as mongoose.Types.ObjectId, {
        name: 'QueueLess Beta Salon B',
        address: '22 Market Lane, Clock Tower, Jodhpur',
        chairs: 1,
        coordinates: { lat: 26.2189, lng: 73.0543 },
        status: 'open',
        services: [
            { name: 'Express Haircut', durationMin: 25, price: 200 },
            { name: 'Kids Cut', durationMin: 20, price: 180 },
            { name: 'Hair Spa', durationMin: 50, price: 700 },
        ],
        staff: [{ name: 'Kabir', role: 'barber', isAvailable: true }],
        images: [],
        rating: 0,
        reviewCount: 0,
    });

    console.log('Beta salons ready:');
    console.log('  Salon A', String(salonA._id), 'owner beta.salon.a@queueless.local / BetaSalon!24 — 3 chairs, 2 staff');
    console.log('  Salon B', String(salonB._id), 'owner beta.salon.b@queueless.local / BetaSalon!24 — 1 chair, 1 staff');

    await mongoose.disconnect();
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
