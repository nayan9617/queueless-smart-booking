/**
 * Cleanup ONLY Phase-1 audit junk documents.
 * Safe patterns: audit.* emails, "Hacked Salon" name.
 *
 * Usage: cd backend && npx tsx src/scripts/cleanupAuditJunk.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

async function main() {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI required');
    await mongoose.connect(uri, { dbName: process.env.DB_NAME || 'queueless' });
    const db = mongoose.connection.db!;

    const auditUsers = await db
        .collection('users')
        .find({ email: { $regex: /^audit\./i } })
        .project({ _id: 1, email: 1, name: 1 })
        .toArray();

    console.log('Audit users matched:', auditUsers.length, auditUsers.map((u) => u.email));

    const hackedSalons = await db
        .collection('salons')
        .find({ name: { $regex: /hacked salon/i } })
        .project({ _id: 1, name: 1, ownerId: 1 })
        .toArray();

    console.log(
        'Hacked salons matched:',
        hackedSalons.length,
        hackedSalons.map((s) => s.name)
    );

    const auditUserIds = auditUsers.map((u) => u._id);
    const hackedSalonIds = hackedSalons.map((s) => s._id);

    if (auditUserIds.length) {
        const bookings = await db.collection('bookings').deleteMany({
            userId: { $in: auditUserIds },
        });
        console.log('Deleted bookings for audit users:', bookings.deletedCount);
        const salonsOwned = await db.collection('salons').deleteMany({
            ownerId: { $in: auditUserIds },
        });
        console.log('Deleted salons owned by audit users:', salonsOwned.deletedCount);
        const users = await db.collection('users').deleteMany({ _id: { $in: auditUserIds } });
        console.log('Deleted audit users:', users.deletedCount);
    }

    if (hackedSalonIds.length) {
        const bookings = await db.collection('bookings').deleteMany({
            salonId: { $in: hackedSalonIds },
        });
        console.log('Deleted bookings for hacked salons:', bookings.deletedCount);
        const salons = await db.collection('salons').deleteMany({ _id: { $in: hackedSalonIds } });
        console.log('Deleted hacked salons:', salons.deletedCount);
    }

    await mongoose.disconnect();
    console.log('Cleanup complete.');
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
