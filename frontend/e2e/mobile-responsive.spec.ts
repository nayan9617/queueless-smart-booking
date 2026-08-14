import { test, expect } from '@playwright/test';
import { API, registerAndLogin } from './helpers';

const stamp = Date.now();

const viewports = [
    { name: '375x812', width: 375, height: 812 },
    { name: '390x844', width: 390, height: 844 },
];

for (const vp of viewports) {
    test.describe(`Mobile ${vp.name}`, () => {
        test.use({
            viewport: { width: vp.width, height: vp.height },
            isMobile: true,
            hasTouch: true,
        });

        test('customer discovery + owner dashboard no major overflow', async ({ page }) => {
            const owner = await registerAndLogin({
                name: 'Mobile Owner',
                email: `mob.own.${vp.name}.${stamp}@test.local`,
                password: 'test1234',
                role: 'salon_owner',
                phone: `9444${vp.width}${String(stamp).slice(-4)}`.slice(0, 10),
            });
            await fetch(`${API}/salons`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${owner.token}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: `Mobile Salon ${vp.name} ${stamp}`,
                    address: 'Mobile Street',
                    chairs: 2,
                    coordinates: { lat: 26.2, lng: 73.0 },
                    services: [{ name: 'Haircut', durationMin: 40, price: 300 }],
                }),
            });

            await page.goto('/');
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
            ).toBeLessThan(8);

            await page.goto('/salons');
            await expect(page.getByText(/Find a Salon/i).first()).toBeVisible();
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
            ).toBeLessThan(8);

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
                        name: 'Mobile Owner',
                        email: `mob.own.${vp.name}.${stamp}@test.local`,
                        role: 'salon_owner',
                    },
                }
            );
            await page.goto('/admin/dashboard');
            await expect(page.getByText(/Dashboard|Queue|Salon|Today/i).first()).toBeVisible({
                timeout: 15000,
            });
            expect(
                await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
            ).toBeLessThan(24);
        });
    });
}
