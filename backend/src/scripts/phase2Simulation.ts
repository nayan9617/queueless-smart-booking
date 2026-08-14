/**
 * Phase 2 final real-world simulation (API-level, evidence script).
 * Salon A: 3 chairs, 2 staff; Haircut 40 / Beard 20 / Facial 60.
 * Customers A–D book; owner starts A+B; capacity; no-show; cancel; queue math.
 *
 * Usage: cd backend && npx tsx src/scripts/phase2Simulation.ts
 */
import dotenv from 'dotenv';
import path from 'path';
import mongoose from 'mongoose';

dotenv.config({ path: path.join(__dirname, '../../../.env') });

const API = process.env.API_URL || 'http://localhost:5001/api';
const stamp = Date.now();

async function forceVerify(email: string) {
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(process.env.MONGO_URI!, {
            dbName: process.env.DB_NAME || 'queueless',
        });
    }
    await mongoose.connection.db!.collection('users').updateOne(
        { email: email.toLowerCase() },
        {
            $set: {
                emailVerified: true,
                emailVerificationToken: null,
                emailVerificationExpires: null,
            },
        }
    );
}

async function registerLogin(role: 'customer' | 'salon_owner', tag: string) {
    const email = `sim.${tag}.${stamp}@test.local`.toLowerCase();
    const phone = `98${String(stamp).slice(-8)}${tag.charCodeAt(0) % 10}`;
    const reg = await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: `Sim ${tag}`,
            email,
            password: 'test1234',
            role,
            phone,
            address: 'Sim Addr Street',
            city: 'Jodhpur',
        }),
    });
    const regBody = await reg.json();
    if (![200, 201].includes(reg.status) && !String(regBody.message || '').match(/exists|already/i)) {
        // continue — may already exist from retry
        console.warn('register', tag, reg.status, regBody);
    }
    await forceVerify(email);
    const login = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'test1234' }),
    });
    const body = await login.json();
    if (!body.token) throw new Error(`login failed ${email}: ${JSON.stringify(body)} (reg=${reg.status})`);
    return { token: body.token as string, email, tag };
}

async function bookPay(
    token: string,
    email: string,
    salonId: string,
    service: { name: string; duration: number; price: number },
    tag: string
) {
    const key = `sim-${tag}-${stamp}`;
    const create = await fetch(`${API}/bookings`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Idempotency-Key': key,
        },
        body: JSON.stringify({
            salonId,
            clientRequestId: key,
            services: [service],
            contactInfo: { phone: '9888888888', email, name: tag },
        }),
    });
    const created = await create.json();
    if (![200, 201].includes(create.status)) {
        throw new Error(`create ${tag}: ${JSON.stringify(created)}`);
    }
    const pay = await fetch(`${API}/bookings/verify-payment`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId: created.booking._id, demo: true }),
    });
    const paid = await pay.json();
    if (pay.status !== 200) throw new Error(`pay ${tag}: ${JSON.stringify(paid)}`);
    return paid.booking;
}

async function patch(ownerToken: string, id: string, status: string) {
    const res = await fetch(`${API}/bookings/${id}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${ownerToken}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
    });
    return { status: res.status, body: await res.json() };
}

async function main() {
    console.log('=== Phase 2 simulation', stamp, '===');
    const owner = await registerLogin('salon_owner', 'owner');
    const A = await registerLogin('customer', 'A');
    const B = await registerLogin('customer', 'B');
    const C = await registerLogin('customer', 'C');
    const D = await registerLogin('customer', 'D');

    const salonRes = await fetch(`${API}/salons`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${owner.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: `Sim Salon A ${stamp}`,
            address: 'Sim Street',
            chairs: 3,
            coordinates: { lat: 26.2389, lng: 73.0243 },
            services: [
                { name: 'Haircut', durationMin: 40, price: 300 },
                { name: 'Beard', durationMin: 20, price: 150 },
                { name: 'Facial', durationMin: 60, price: 500 },
            ],
            staff: [
                { name: 'Barber 1', role: 'barber', isAvailable: true },
                { name: 'Barber 2', role: 'barber', isAvailable: true },
            ],
        }),
    });
    const salon = await salonRes.json();
    if (salonRes.status !== 201) throw new Error(JSON.stringify(salon));
    console.log('Salon', salon._id, 'chairs', salon.chairs);

    const bA = await bookPay(A.token, A.email, salon._id, { name: 'Haircut', duration: 40, price: 300 }, 'A');
    const bB = await bookPay(B.token, B.email, salon._id, { name: 'Beard', duration: 20, price: 150 }, 'B');
    const bC = await bookPay(C.token, C.email, salon._id, { name: 'Facial', duration: 60, price: 500 }, 'C');
    const bD = await bookPay(D.token, D.email, salon._id, { name: 'Haircut', duration: 40, price: 300 }, 'D');
    console.log('Booked A–D confirmed');

    console.log('Start A', await patch(owner.token, bA._id, 'in-progress'));
    console.log('Start B', await patch(owner.token, bB._id, 'in-progress'));
    // With 3 chairs / 2 staff, concurrent slots = 2 — C and D remain confirmed
    const list = await fetch(`${API}/bookings/salon-bookings`, {
        headers: { Authorization: `Bearer ${owner.token}` },
    });
    const lb = (await list.json()) as { bookings?: Array<{ _id: string; status: string }> };
    const statuses = Object.fromEntries(
        (lb.bookings || []).map((b) => [String(b._id), b.status])
    );
    console.log('Statuses after A+B start', {
        A: statuses[bA._id],
        B: statuses[bB._id],
        C: statuses[bC._id],
        D: statuses[bD._id],
    });

    console.log('Complete B early', await patch(owner.token, bB._id, 'completed'));
    console.log('Start D', await patch(owner.token, bD._id, 'in-progress'));
    console.log('No-show C', await patch(owner.token, bC._id, 'no-show'));
    console.log('Cancel attempt D by customer…');
    const cancel = await fetch(`${API}/bookings/${bD._id}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${D.token}` },
    });
    console.log('Cancel D (expect fail if in-progress)', cancel.status, await cancel.json());

    const cancelA = await fetch(`${API}/bookings/${bA._id}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${owner.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'completed' }),
    });
    console.log('Complete A', cancelA.status);

    const final = await fetch(`${API}/bookings/salon-bookings`, {
        headers: { Authorization: `Bearer ${owner.token}` },
    });
    const fb = (await final.json()) as {
        bookings?: Array<{ _id: string; status: string; estimatedWaitTime?: number }>;
    };
    console.log(
        'Final',
        (fb.bookings || []).map((b) => ({
            id: b._id,
            status: b.status,
            wait: b.estimatedWaitTime,
        }))
    );

    await mongoose.disconnect();
    console.log('=== simulation OK ===');
}

main().catch(async (e) => {
    console.error(e);
    try {
        await mongoose.disconnect();
    } catch {
        /* ignore */
    }
    process.exit(1);
});
