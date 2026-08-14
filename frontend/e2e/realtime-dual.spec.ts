import { test, expect } from '@playwright/test';
import { API, registerAndLogin } from './helpers';

const stamp = Date.now();

test('customer ↔ owner realtime UI updates across two browsers', async ({ browser }) => {
    const customer = await registerAndLogin({
        name: 'RT Customer',
        email: `rt.cust.${stamp}@test.local`,
        password: 'test1234',
        role: 'customer',
        phone: '9555000001',
    });
    const owner = await registerAndLogin({
        name: 'RT Owner',
        email: `rt.own.${stamp}@test.local`,
        password: 'test1234',
        role: 'salon_owner',
        phone: '9555000002',
    });

    const salonRes = await fetch(`${API}/salons`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${owner.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: `RT Salon ${stamp}`,
            address: 'Realtime Street',
            chairs: 2,
            coordinates: { lat: 26.2, lng: 73.0 },
            services: [{ name: 'Haircut', durationMin: 40, price: 300 }],
        }),
    });
    const salon = await salonRes.json();
    expect(salonRes.status).toBe(201);

    const key = `rt-${stamp}`;
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
            contactInfo: {
                phone: '9555000001',
                email: `rt.cust.${stamp}@test.local`,
                name: 'RT Customer',
            },
        }),
    });
    const created = await create.json();
    expect([200, 201]).toContain(create.status);
    const bookingId = created.booking._id as string;

    const pay = await fetch(`${API}/bookings/verify-payment`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${customer.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bookingId, demo: true }),
    });
    expect(pay.status).toBe(200);

    const customerCtx = await browser.newContext();
    const ownerCtx = await browser.newContext();
    const customerPage = await customerCtx.newPage();
    const ownerPage = await ownerCtx.newPage();

    await customerPage.goto('/login');
    await customerPage.evaluate(
        ({ token, user }) => {
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
        },
        {
            token: customer.token,
            user: {
                ...customer.user,
                name: 'RT Customer',
                email: `rt.cust.${stamp}@test.local`,
                role: 'customer',
            },
        }
    );
    await customerPage.goto('/dashboard');
    await expect(customerPage.getByText(/confirmed/i).first()).toBeVisible({ timeout: 15000 });

    await ownerPage.goto('/login');
    await ownerPage.evaluate(
        ({ token, user }) => {
            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(user));
        },
        {
            token: owner.token,
            user: {
                ...owner.user,
                name: 'RT Owner',
                email: `rt.own.${stamp}@test.local`,
                role: 'salon_owner',
            },
        }
    );
    await ownerPage.goto('/admin/dashboard');
    await expect(ownerPage.getByText(/confirmed/i).first()).toBeVisible({ timeout: 15000 });

    // Owner starts via API (authoritative) while both UIs are open — customer should refresh via socket/poll
    const start = await fetch(`${API}/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${owner.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'in-progress' }),
    });
    expect(start.status).toBe(200);

    await expect(customerPage.getByText(/in-progress|in progress/i).first()).toBeVisible({
        timeout: 20000,
    });
    await expect(ownerPage.getByText(/in-progress|in progress/i).first()).toBeVisible({
        timeout: 20000,
    });

    const done = await fetch(`${API}/bookings/${bookingId}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${owner.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'completed' }),
    });
    expect(done.status).toBe(200);

    await expect(customerPage.getByText(/completed/i).first()).toBeVisible({ timeout: 20000 });

    // Reconnect: refresh customer dashboard still consistent
    await customerPage.reload();
    await expect(customerPage.getByText(/completed/i).first()).toBeVisible({ timeout: 15000 });

    await customerCtx.close();
    await ownerCtx.close();
});
