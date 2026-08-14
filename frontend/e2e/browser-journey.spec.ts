import { test, expect } from '@playwright/test';
import { API, testVerifyEmail } from './helpers';

const stamp = Date.now();
const email = `browser.cust.${stamp}@test.local`;
const password = 'test1234';
const salonName = `Browser Journey Salon ${stamp}`;

test.describe.serial('Real customer browser journey', () => {
    test('owner seeds a discoverable salon via API', async () => {
        const ownerEmail = `browser.own.${stamp}@test.local`;
        await fetch(`${API}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Browser Owner',
                email: ownerEmail,
                password,
                role: 'salon_owner',
                phone: '9777777777',
                address: 'Browser Owner Address',
                city: 'Jodhpur',
            }),
        });
        await testVerifyEmail(ownerEmail);
        const login = await fetch(`${API}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ownerEmail, password }),
        });
        const { token } = await login.json();
        const salonRes = await fetch(`${API}/salons`, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name: salonName,
                address: 'Browser Journey Street, Jodhpur',
                chairs: 2,
                coordinates: { lat: 26.2389, lng: 73.0243 },
                services: [{ name: 'Haircut', durationMin: 40, price: 300 }],
            }),
        });
        expect(salonRes.status).toBe(201);
    });

    test('homepage → find salon → signup → verify → login → book → dashboard', async ({
        page,
    }) => {
        await page.goto('/');
        await page.getByRole('link', { name: /Find a Salon/i }).first().click();
        await expect(page).toHaveURL(/\/salons/);

        await page.goto('/register');
        await page.locator('input').nth(0).fill('Browser Customer');
        await page.locator('input[type="email"]').fill(email);
        await page.locator('input[type="password"]').first().fill(password);
        await page.locator('input[type="password"]').nth(1).fill(password);
        await page.getByPlaceholder(/98765/).fill('9666666666');
        await page.getByPlaceholder('Jodhpur').fill('Jodhpur');
        await page.getByPlaceholder(/Street/).fill('Browser Customer Address 12');
        await page.getByRole('button', { name: /Create Account/i }).click();
        await expect(page.getByText(/check your email|verify/i).first()).toBeVisible({
            timeout: 15000,
        });

        await testVerifyEmail(email);

        await page.goto('/login');
        await page.locator('input[type="email"]').fill(email);
        await page.locator('input[type="password"]').fill(password);
        await page.getByRole('button', { name: /Sign In|Log In|Login/i }).click();
        await expect(page).toHaveURL(/\/salons|\/dashboard/, { timeout: 15000 });

        await page.goto('/salons');
        await page.getByPlaceholder(/Search salons/i).fill(salonName);
        await expect(page.getByText(salonName).first()).toBeVisible({ timeout: 15000 });
        await page.getByRole('button', { name: /Book Appointment/i }).first().click();
        const modal = page.locator('.fixed.inset-0').filter({ hasText: /Book at/i });
        await expect(modal).toBeVisible({ timeout: 10000 });
        await modal.getByRole('button', { name: /Haircut/i }).click();
        await modal.getByRole('button', { name: /Proceed to Checkout/i }).click();
        await expect(page).toHaveURL(/\/checkout/);

        await page.getByRole('button', { name: /Pay ₹/i }).click();
        await expect(page).toHaveURL(/\/dashboard/, { timeout: 20000 });
        await expect(page.getByText(/confirmed|Haircut|My Account/i).first()).toBeVisible({
            timeout: 15000,
        });
    });
});
