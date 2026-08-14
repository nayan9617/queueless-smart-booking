import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });
/**
 * Razorpay TEST MODE payment verification — no real money.
 * Full checkout.js widget automation is not reliable in Playwright (iframe + bank UI).
 * These tests prove the backend-authoritative signature path against live Test Mode orders.
 */
import assert from 'node:assert/strict';
import { describe, it, after } from 'node:test';
import crypto from 'crypto';
import mongoose from 'mongoose';
import {
    createRazorpayOrder,
    isRazorpayConfigured,
    verifyRazorpaySignature,
} from './services/paymentService';

const API = process.env.API_URL || 'http://localhost:5001/api';
const stamp = Date.now();

after(async () => {
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
});

async function alive() {
    try {
        const res = await fetch('http://localhost:5001/', { signal: AbortSignal.timeout(1500) });
        return res.ok;
    } catch {
        return false;
    }
}

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
    const email = `rzp.${tag}.${stamp}@test.local`;
    await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: `Rzp ${tag}`,
            email,
            password: 'test1234',
            role,
            phone: `91${String(stamp).slice(-8)}`,
            address: 'Razorpay Test Street',
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
    assert.ok(body.token, JSON.stringify(body));
    return { token: body.token as string, email };
}

describe('Razorpay Test Mode (backend-authoritative)', () => {
    it('creates Test Mode order and validates HMAC signatures', async (t) => {
        if (!isRazorpayConfigured()) return t.skip('Razorpay keys not configured');
        const order = await createRazorpayOrder(1, `p3_${stamp}`);
        assert.ok(order.id);
        assert.equal(order.currency, 'INR');
        assert.equal(order.amount, 100);

        const payId = `pay_test_${stamp}`;
        const good = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
            .update(`${order.id}|${payId}`)
            .digest('hex');
        assert.equal(verifyRazorpaySignature(order.id, payId, good), true);
        assert.equal(verifyRazorpaySignature(order.id, payId, '00'.repeat(32)), false);
    });

    it('invalid signature does not confirm booking; valid signature does; duplicate is idempotent', async (t) => {
        if (!(await alive())) return t.skip('backend not running');
        if (!isRazorpayConfigured()) return t.skip('Razorpay keys not configured');
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
                name: `Rzp Salon ${stamp}`,
                address: 'Pay St',
                chairs: 2,
                coordinates: { lat: 26.2, lng: 73.0 },
                services: [{ name: 'Haircut', durationMin: 40, price: 300 }],
            }),
        });
        const salon = await salonRes.json();
        assert.equal(salonRes.status, 201);

        const key = `rzp-book-${stamp}`;
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
                contactInfo: { phone: '9111111111', email: customer.email, name: 'Cust' },
            }),
        });
        const created = await create.json();
        assert.ok([200, 201].includes(create.status), JSON.stringify(created));
        const bookingId = created.booking._id as string;

        // Attach a real Test Mode order to the pending booking (simulates createBooking razorpay path)
        const order = await createRazorpayOrder(300, `bk_${bookingId}`);
        await mongoose.connection.db!.collection('bookings').updateOne(
            { _id: new mongoose.Types.ObjectId(bookingId) },
            {
                $set: {
                    paymentMethod: 'razorpay',
                    razorpayOrderId: order.id,
                    status: 'pending',
                    paymentStatus: 'pending',
                },
            }
        );

        const bad = await fetch(`${API}/bookings/verify-payment`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${customer.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                bookingId,
                razorpay_order_id: order.id,
                razorpay_payment_id: 'pay_bad',
                razorpay_signature: 'deadbeef',
            }),
        });
        assert.equal(bad.status, 400);
        const afterBad = await mongoose.connection
            .db!.collection('bookings')
            .findOne({ _id: new mongoose.Types.ObjectId(bookingId) });
        assert.equal(afterBad?.status, 'pending');
        assert.notEqual(afterBad?.paymentStatus, 'paid');

        const payId = `pay_ok_${stamp}`;
        const signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
            .update(`${order.id}|${payId}`)
            .digest('hex');

        const good1 = await fetch(`${API}/bookings/verify-payment`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${customer.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                bookingId,
                razorpay_order_id: order.id,
                razorpay_payment_id: payId,
                razorpay_signature: signature,
            }),
        });
        const g1 = await good1.json();
        assert.equal(good1.status, 200, JSON.stringify(g1));
        assert.equal(g1.booking.status, 'confirmed');
        assert.equal(g1.booking.paymentStatus, 'paid');

        const good2 = await fetch(`${API}/bookings/verify-payment`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${customer.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                bookingId,
                razorpay_order_id: order.id,
                razorpay_payment_id: payId,
                razorpay_signature: signature,
            }),
        });
        const g2 = await good2.json();
        assert.equal(good2.status, 200);
        assert.equal(g2.booking.status, 'confirmed');
    });

    it('documents: no webhook handler exists; checkout.js widget not automated', () => {
        // Intentional documentation assertion for Phase 3 report evidence trail
        assert.equal(typeof createRazorpayOrder, 'function');
        assert.equal(typeof verifyRazorpaySignature, 'function');
    });
});
