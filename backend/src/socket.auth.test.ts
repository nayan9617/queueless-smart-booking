import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.join(__dirname, '../../.env') });
/**
 * Socket.IO JWT auth smoke tests (requires live backend + JWT_SECRET).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { io as ioClient } from 'socket.io-client';
import jwt from 'jsonwebtoken';

const ROOT = process.env.API_ROOT || 'http://localhost:5001';

async function alive(): Promise<boolean> {
    try {
        const res = await fetch(`${ROOT}/`, { signal: AbortSignal.timeout(1500) });
        return res.ok;
    } catch {
        return false;
    }
}

describe('Socket.IO authentication', () => {
    it('rejects unauthenticated connections', async (t) => {
        if (!(await alive())) return t.skip('backend not running');

        await new Promise<void>((resolve, reject) => {
            const s = ioClient(ROOT, {
                transports: ['websocket'],
                autoConnect: true,
                timeout: 3000,
            });
            const timer = setTimeout(() => {
                s.close();
                reject(new Error('Expected auth failure'));
            }, 3500);
            s.on('connect_error', (err) => {
                clearTimeout(timer);
                assert.match(String(err.message), /Unauthorized|auth/i);
                s.close();
                resolve();
            });
            s.on('connect', () => {
                clearTimeout(timer);
                s.close();
                reject(new Error('Should not connect without JWT'));
            });
        });
    });

    it('accepts valid JWT and joins private user room', async (t) => {
        if (!(await alive())) return t.skip('backend not running');
        const secret = process.env.JWT_SECRET;
        if (!secret) return t.skip('JWT_SECRET not in env for this process');

        const token = jwt.sign({ id: '000000000000000000000001', role: 'customer' }, secret, {
            expiresIn: '5m',
        });

        await new Promise<void>((resolve, reject) => {
            const s = ioClient(ROOT, {
                transports: ['websocket'],
                auth: { token },
                timeout: 4000,
            });
            const timer = setTimeout(() => {
                s.close();
                reject(new Error('connect timeout'));
            }, 4500);
            s.on('connect', () => {
                clearTimeout(timer);
                assert.equal(s.connected, true);
                s.close();
                resolve();
            });
            s.on('connect_error', (err) => {
                clearTimeout(timer);
                s.close();
                reject(err);
            });
        });
    });

    it('join_salon is denied without ownership or active booking', async (t) => {
        if (!(await alive())) return t.skip('backend not running');
        const secret = process.env.JWT_SECRET;
        if (!secret) return t.skip('JWT_SECRET not in env for this process');

        const token = jwt.sign({ id: '000000000000000000000002', role: 'customer' }, secret, {
            expiresIn: '5m',
        });

        await new Promise<void>((resolve, reject) => {
            const s = ioClient(ROOT, {
                transports: ['websocket'],
                auth: { token },
                timeout: 4000,
            });
            const timer = setTimeout(() => {
                s.close();
                reject(new Error('timeout'));
            }, 4500);
            s.on('connect', () => {
                s.emit('join_salon', '000000000000000000000099', (ack: { ok: boolean; error?: string }) => {
                    clearTimeout(timer);
                    try {
                        assert.equal(ack.ok, false);
                        s.close();
                        resolve();
                    } catch (e) {
                        s.close();
                        reject(e);
                    }
                });
            });
            s.on('connect_error', (err) => {
                clearTimeout(timer);
                s.close();
                reject(err);
            });
        });
    });
});
