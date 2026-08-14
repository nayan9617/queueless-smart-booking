import { test, expect } from '@playwright/test';
import { API, registerAndLogin } from './helpers';

const stamp = Date.now();

test.describe.serial('QueueLess customer ↔ owner realtime flow', () => {
    let customer: { token: string; user: { id: string } };
    let owner: { token: string; user: { id: string } };
    let salonId: string;
    let bookingId: string;

    test('setup users + salon via API', async () => {
        customer = await registerAndLogin({
            name: 'E2E Customer',
            email: `e2e.cust.${stamp}@test.local`,
            password: 'test1234',
            role: 'customer',
            phone: '9111111111',
        });
        owner = await registerAndLogin({
            name: 'E2E Owner',
            email: `e2e.own.${stamp}@test.local`,
            password: 'test1234',
            role: 'salon_owner',
            phone: '9222222222',
        });

        const salonRes = await fetch(`${API}/salons`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${owner.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: `E2E Salon ${stamp}`,
                address: 'E2E Street 1, Jodhpur',
                chairs: 3,
                coordinates: { lat: 26.2389, lng: 73.0243 },
                services: [
                    { name: 'Haircut', durationMin: 40, price: 300 },
                    { name: 'Beard', durationMin: 20, price: 150 },
                    { name: 'Facial', durationMin: 60, price: 500 },
                ],
            }),
        });
        const salon = await salonRes.json();
        expect(salonRes.status).toBe(201);
        salonId = salon._id;

        await fetch(`${API}/staff`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${owner.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: 'E2E Barber 1', role: 'barber' }),
        });
        await fetch(`${API}/staff`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${owner.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: 'E2E Barber 2', role: 'barber' }),
        });
    });

    test('customer books + demo pays', async () => {
        const key = `e2e-${stamp}`;
        const create = await fetch(`${API}/bookings`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${customer.token}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': key,
            },
            body: JSON.stringify({
                salonId,
                clientRequestId: key,
                services: [{ name: 'Haircut', duration: 40, price: 300 }],
                contactInfo: {
                    phone: '9111111111',
                    email: `e2e.cust.${stamp}@test.local`,
                    name: 'E2E Customer',
                },
            }),
        });
        const created = await create.json();
        expect([200, 201]).toContain(create.status);
        bookingId = created.booking._id;

        const pay = await fetch(`${API}/bookings/verify-payment`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${customer.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ bookingId, demo: true }),
        });
        const paid = await pay.json();
        expect(pay.status).toBe(200);
        expect(paid.booking.status).toBe('confirmed');
        expect(paid.booking.paymentStatus).toBe('paid');
    });

    test('owner sees booking and starts then completes', async () => {
        const list = await fetch(`${API}/bookings/salon-bookings`, {
            headers: { Authorization: `Bearer ${owner.token}` },
        });
        const body = await list.json();
        expect(list.status).toBe(200);
        const found = (body.bookings || []).find((b: any) => b._id === bookingId);
        expect(found).toBeTruthy();

        const start = await fetch(`${API}/bookings/${bookingId}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${owner.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'in-progress' }),
        });
        expect(start.status).toBe(200);

        const done = await fetch(`${API}/bookings/${bookingId}`, {
            method: 'PATCH',
            headers: {
                Authorization: `Bearer ${owner.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ status: 'completed' }),
        });
        expect(done.status).toBe(200);
        const completed = await done.json();
        expect(completed.status).toBe('completed');
    });

    test('customer UI shows login + dashboard after injecting auth', async ({ page }) => {
        await page.goto('/login');
        await page.evaluate(
            ({ token, user }) => {
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(user));
            },
            { token: customer.token, user: { ...customer.user, name: 'E2E Customer', email: `e2e.cust.${stamp}@test.local`, role: 'customer' } }
        );
        await page.goto('/dashboard');
        await expect(page.getByRole('heading', { name: /My Account/i })).toBeVisible({
            timeout: 15000,
        });
    });

    test('owner UI dashboard loads', async ({ page }) => {
        await page.goto('/login');
        await page.evaluate(
            ({ token, user }) => {
                localStorage.setItem('token', token);
                localStorage.setItem('user', JSON.stringify(user));
            },
            {
                token: owner.token,
                user: {
                    ...owner.user,
                    name: 'E2E Owner',
                    email: `e2e.own.${stamp}@test.local`,
                    role: 'salon_owner',
                },
            }
        );
        await page.goto('/admin/dashboard');
        await expect(page.getByText(/Dashboard|Queue|Salon/i).first()).toBeVisible({
            timeout: 15000,
        });
    });

    test('authz: customer cannot create salon', async () => {
        const res = await fetch(`${API}/salons`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${customer.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ name: 'Nope', address: 'x', chairs: 1 }),
        });
        expect(res.status).toBe(403);
    });

    test('idempotent booking replay returns same id', async () => {
        const key = `e2e-idem-${stamp}`;
        // Need a fresh customer without active booking — use owner as second customer path skipped;
        // create another customer
        const c2 = await registerAndLogin({
            name: 'E2E Cust2',
            email: `e2e.cust2.${stamp}@test.local`,
            password: 'test1234',
            role: 'customer',
            phone: '9333333333',
        });
        const r1 = await fetch(`${API}/bookings`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${c2.token}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': key,
            },
            body: JSON.stringify({
                salonId,
                clientRequestId: key,
                services: [{ name: 'Beard', duration: 20, price: 150 }],
                contactInfo: { phone: '9333333333', email: `e2e.cust2.${stamp}@test.local`, name: 'C2' },
            }),
        });
        const b1 = await r1.json();
        const r2 = await fetch(`${API}/bookings`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${c2.token}`,
                'Content-Type': 'application/json',
                'Idempotency-Key': key,
            },
            body: JSON.stringify({
                salonId,
                clientRequestId: key,
                services: [{ name: 'Beard', duration: 20, price: 150 }],
                contactInfo: { phone: '9333333333', email: `e2e.cust2.${stamp}@test.local`, name: 'C2' },
            }),
        });
        const b2 = await r2.json();
        expect(r1.status).toBe(201);
        expect(r2.status).toBe(200);
        expect(b1.booking._id).toBe(b2.booking._id);
        expect(b2.payment?.reused).toBe(true);
    });
});
