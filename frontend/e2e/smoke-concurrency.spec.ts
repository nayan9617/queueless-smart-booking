import { test, expect } from '@playwright/test';
import { API, registerAndLogin } from './helpers';

const stamp = Date.now();

test('homepage loads brand + CTA', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    await expect(page.getByRole('link', { name: /Find Salon|Browse|Salons/i }).first()).toBeVisible({
        timeout: 15000,
    });
});

test('two customers can both hold confirmed seats; chair start is serialized', async () => {
    const owner = await registerAndLogin({
        name: 'E2E Cap Owner',
        email: `e2e.cap.own.${stamp}@test.local`,
        password: 'test1234',
        role: 'salon_owner',
        phone: '9444444444',
    });
    const c1 = await registerAndLogin({
        name: 'E2E Cap C1',
        email: `e2e.cap.c1.${stamp}@test.local`,
        password: 'test1234',
        role: 'customer',
        phone: '9555555551',
    });
    const c2 = await registerAndLogin({
        name: 'E2E Cap C2',
        email: `e2e.cap.c2.${stamp}@test.local`,
        password: 'test1234',
        role: 'customer',
        phone: '9555555552',
    });

    const salonRes = await fetch(`${API}/salons`, {
        method: 'POST',
        headers: {
            Authorization: `Bearer ${owner.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            name: `E2E Cap Salon ${stamp}`,
            address: 'Cap Lane',
            chairs: 1,
            coordinates: { lat: 26.2, lng: 73.0 },
            services: [{ name: 'Haircut', durationMin: 40, price: 300 }],
        }),
    });
    expect(salonRes.status).toBe(201);
    const salon = await salonRes.json();

    async function bookPay(token: string, email: string, tag: string) {
        const key = `cap-e2e-${tag}-${stamp}`;
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
                services: [{ name: 'Haircut', duration: 40, price: 300 }],
                contactInfo: { phone: '9555555555', email, name: tag },
            }),
        });
        const created = await create.json();
        if (![200, 201].includes(create.status)) {
            throw new Error(`bookPay failed ${create.status}: ${JSON.stringify(created)}`);
        }
        const pay = await fetch(`${API}/bookings/verify-payment`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ bookingId: created.booking._id, demo: true }),
        });
        expect(pay.status).toBe(200);
        return created.booking._id as string;
    }

    const b1 = await bookPay(c1.token, c1.email, 'c1');
    const b2 = await bookPay(c2.token, c2.email, 'c2');

    const s1 = await fetch(`${API}/bookings/${b1}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${owner.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'in-progress' }),
    });
    expect(s1.status).toBe(200);

    const s2 = await fetch(`${API}/bookings/${b2}`, {
        method: 'PATCH',
        headers: {
            Authorization: `Bearer ${owner.token}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'in-progress' }),
    });
    expect(s2.status).toBe(409);
});
