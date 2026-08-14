import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });
/**
 * Live API concurrency / payment / no-show hardening probes.
 */
import assert from 'node:assert/strict';
import { describe, it, after } from 'node:test';
import mongoose from 'mongoose';

const API = process.env.API_URL || 'http://localhost:5001/api';
const stamp = Date.now();

after(async () => {
    if (mongoose.connection.readyState !== 0) {
        await mongoose.disconnect();
    }
});

async function alive(): Promise<boolean> {
    try {
        const res = await fetch('http://localhost:5001/', { signal: AbortSignal.timeout(1500) });
        return res.ok;
    } catch {
        return false;
    }
}

async function forceVerify(email: string) {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI required');
    if (mongoose.connection.readyState === 0) {
        await mongoose.connect(uri, { dbName: process.env.DB_NAME || 'queueless' });
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
    const email = `phase2.${tag}.${stamp}@test.local`;
    await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: tag,
            email,
            password: 'test1234',
            role,
            phone: '9000000000',
            address: 'Phase2 Addr',
            city: 'Jodhpur',
        }),
    });
    await forceVerify(email);
    const login = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'test1234' }),
    });
    const body = await login.json();
    assert.ok(body.token, `login failed for ${email}: ${JSON.stringify(body)}`);
    return { token: body.token as string, userId: body.user.id as string, email };
}

describe('Booking concurrency + no-show (live)', () => {
    it('duplicate verify-payment is idempotent; no-show blocks start', async (t) => {
        if (!(await alive())) return t.skip('backend not running');
        if (!process.env.MONGO_URI) return t.skip('MONGO_URI missing');

        const owner = await registerLogin('salon_owner', 'own');
        const customer = await registerLogin('customer', 'cust');

        const salonRes = await fetch(`${API}/salons`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${owner.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: `Phase2 Salon ${stamp}`,
                address: 'Concurrency St',
                chairs: 1,
                coordinates: { lat: 26.2, lng: 73.0 },
                services: [{ name: 'Haircut', durationMin: 40, price: 300 }],
            }),
        });
        const salon = await salonRes.json();
        assert.equal(salonRes.status, 201, JSON.stringify(salon));

        const key = `p2-${stamp}`;
        const create = await fetch(`${API}/bookings`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${customer.token}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': key,
            },
            body: JSON.stringify({
                salonId: salon._id,
                clientRequestId: key,
                services: [{ name: 'Haircut', duration: 40, price: 300 }],
                contactInfo: { phone: '9000000000', email: customer.email, name: 'Cust' },
            }),
        });
        const created = await create.json();
        assert.ok([200, 201].includes(create.status), JSON.stringify(created));
        const bookingId = created.booking._id;

        const payBody = JSON.stringify({ bookingId, demo: true });
        const [p1, p2] = await Promise.all([
            fetch(`${API}/bookings/verify-payment`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${customer.token}`,
                    'Content-Type': 'application/json',
                },
                body: payBody,
            }),
            fetch(`${API}/bookings/verify-payment`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${customer.token}`,
                    'Content-Type': 'application/json',
                },
                body: payBody,
            }),
        ]);
        assert.ok([200].includes(p1.status));
        assert.ok([200].includes(p2.status));
        const b1 = await p1.json();
        const b2 = await p2.json();
        const statuses = [b1.booking?.status, b2.booking?.status].filter(Boolean);
        assert.ok(statuses.every((s) => s === 'confirmed'));

        const noShow = await fetch(`${API}/bookings/${bookingId}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${owner.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'no-show' }),
        });
        assert.equal(noShow.status, 200);
        const ns = await noShow.json();
        assert.equal(ns.status, 'no-show');

        const start = await fetch(`${API}/bookings/${bookingId}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${owner.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'in-progress' }),
        });
        assert.equal(start.status, 400);
    });

    it('chair capacity blocks starting more than salon.chairs', async (t) => {
        if (!(await alive())) return t.skip('backend not running');
        if (!process.env.MONGO_URI) return t.skip('MONGO_URI missing');

        const owner = await registerLogin('salon_owner', 'own2');
        const c1 = await registerLogin('customer', 'c1');
        const c2 = await registerLogin('customer', 'c2');

        const salonRes = await fetch(`${API}/salons`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${owner.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: `Phase2 Cap ${stamp}`,
                address: 'Cap St',
                chairs: 1,
                coordinates: { lat: 26.2, lng: 73.0 },
                services: [{ name: 'Beard', durationMin: 20, price: 150 }],
            }),
        });
        const salon = await salonRes.json();
        assert.equal(salonRes.status, 201);

        async function bookAndPay(token: string, email: string, tag: string) {
            const key = `cap-${tag}-${stamp}`;
            const create = await fetch(`${API}/bookings`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                    'Idempotency-Key': key,
                },
                body: JSON.stringify({
                    salonId: salon._id,
                    clientRequestId: key,
                    services: [{ name: 'Beard', duration: 20, price: 150 }],
                    contactInfo: { phone: '9000000000', email, name: tag },
                }),
            });
            const created = await create.json();
            assert.ok([200, 201].includes(create.status), JSON.stringify(created));
            const pay = await fetch(`${API}/bookings/verify-payment`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ bookingId: created.booking._id, demo: true }),
            });
            assert.equal(pay.status, 200);
            return created.booking._id as string;
        }

        const b1 = await bookAndPay(c1.token, c1.email, 'c1');
        const b2 = await bookAndPay(c2.token, c2.email, 'c2');

        const s1 = await fetch(`${API}/bookings/${b1}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${owner.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'in-progress' }),
        });
        assert.equal(s1.status, 200);

        const s2 = await fetch(`${API}/bookings/${b2}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${owner.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'in-progress' }),
        });
        assert.equal(s2.status, 409);
    });

    it('parallel starts never exceed chair capacity (atomic claim)', async (t) => {
        if (!(await alive())) return t.skip('backend not running');
        if (!process.env.MONGO_URI) return t.skip('MONGO_URI missing');

        const owner = await registerLogin('salon_owner', 'race');
        const customers = await Promise.all(
            [0, 1, 2, 3, 4].map((i) => registerLogin('customer', `r${i}`))
        );

        const salonRes = await fetch(`${API}/salons`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${owner.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: `Phase3 Race ${stamp}`,
                address: 'Race St',
                chairs: 1,
                coordinates: { lat: 26.2, lng: 73.0 },
                services: [{ name: 'Beard', durationMin: 20, price: 150 }],
            }),
        });
        const salon = await salonRes.json();
        assert.equal(salonRes.status, 201);

        const bookingIds: string[] = [];
        for (let i = 0; i < customers.length; i++) {
            const c = customers[i];
            const key = `race-${i}-${stamp}`;
            const create = await fetch(`${API}/bookings`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${c.token}`,
                    'Content-Type': 'application/json',
                    'Idempotency-Key': key,
                },
                body: JSON.stringify({
                    salonId: salon._id,
                    clientRequestId: key,
                    services: [{ name: 'Beard', duration: 20, price: 150 }],
                    contactInfo: { phone: '9000000000', email: c.email, name: c.email },
                }),
            });
            const created = await create.json();
            assert.ok([200, 201].includes(create.status), JSON.stringify(created));
            const pay = await fetch(`${API}/bookings/verify-payment`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${c.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ bookingId: created.booking._id, demo: true }),
            });
            assert.equal(pay.status, 200);
            bookingIds.push(created.booking._id);
        }

        const results = await Promise.all(
            bookingIds.map((id) =>
                fetch(`${API}/bookings/${id}`, {
                    method: 'PATCH',
                    headers: {
                        Authorization: `Bearer ${owner.token}`,
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ status: 'in-progress' }),
                }).then(async (r) => ({ status: r.status, body: await r.json() }))
            )
        );

        const started = results.filter((r) => r.status === 200);
        const rejected = results.filter((r) => r.status === 409);
        assert.equal(started.length, 1, JSON.stringify(results.map((r) => r.status)));
        assert.equal(rejected.length, bookingIds.length - 1);

        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(process.env.MONGO_URI!, {
                dbName: process.env.DB_NAME || 'queueless',
            });
        }
        const inProgress = await mongoose.connection
            .db!.collection('bookings')
            .countDocuments({
                salonId: new mongoose.Types.ObjectId(salon._id),
                status: 'in-progress',
            });
        assert.equal(inProgress, 1);
        const salonDoc = await mongoose.connection
            .db!.collection('salons')
            .findOne({ _id: new mongoose.Types.ObjectId(salon._id) });
        assert.ok((salonDoc?.inProgressCount || 0) <= 1);
    });
});
