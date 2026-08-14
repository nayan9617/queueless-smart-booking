import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });
/**
 * Security regression tests — run against a live local API when available.
 * Skips cleanly if backend is down so `npm test` still works offline.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

const API = process.env.API_URL || 'http://localhost:5001/api';

async function alive(): Promise<boolean> {
    try {
        const res = await fetch('http://localhost:5001/', { signal: AbortSignal.timeout(1500) });
        return res.ok;
    } catch {
        return false;
    }          
}

describe('Security regressions (live API)', () => {
    it('rejects missing JWT on protected booking route', async (t) => {
        if (!(await alive())) return t.skip('backend not running');
        const res = await fetch(`${API}/bookings/my-bookings`);
        assert.equal(res.status, 401);
    });

    it('rejects malformed JWT', async (t) => {
        if (!(await alive())) return t.skip('backend not running');
        const res = await fetch(`${API}/bookings/my-bookings`, {
            headers: { Authorization: 'Bearer not.a.jwt' },
        });
        assert.equal(res.status, 401);
    });

    it('public salon list does not expose owner email', async (t) => {
        if (!(await alive())) return t.skip('backend not running');
        const res = await fetch(`${API}/salons?limit=5`);
        assert.equal(res.status, 200);
        const body = await res.json();
        const rows = Array.isArray(body) ? body : body.data || [];
        for (const s of rows) {
            if (s.ownerId && typeof s.ownerId === 'object') {
                assert.equal('email' in s.ownerId, false);
            }
            assert.equal('password' in s, false);
        }
        assert.ok(body.pagination, 'pagination envelope required');
        assert.ok(typeof body.pagination.limit === 'number');
        assert.ok(body.pagination.limit <= 50);
    });

    it('rejects expired JWT', async (t) => {
        if (!(await alive())) return t.skip('backend not running');
        const secret = process.env.JWT_SECRET;
        if (!secret) return t.skip('JWT_SECRET missing');
        const jwt = await import('jsonwebtoken');
        const token = jwt.default.sign(
            {
                id: '000000000000000000000099',
                role: 'customer',
                exp: Math.floor(Date.now() / 1000) - 60,
            },
            secret
        );
        const res = await fetch(`${API}/bookings/my-bookings`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        assert.equal(res.status, 401);
    });
});
