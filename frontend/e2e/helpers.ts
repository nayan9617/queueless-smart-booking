import { MongoClient } from 'mongodb';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const API = process.env.E2E_API_URL || 'http://localhost:5001/api';
const ROOT_ENV = path.resolve(__dirname, '../../.env');

export function loadRootEnv() {
    if (!fs.existsSync(ROOT_ENV)) return;
    for (const line of fs.readFileSync(ROOT_ENV, 'utf8').split('\n')) {
        const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
        if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
}

export async function forceVerifyEmail(email: string) {
    loadRootEnv();
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI required for E2E setup');
    const client = new MongoClient(uri);
    await client.connect();
    try {
        const dbName = process.env.DB_NAME || 'queueless';
        const db = client.db(dbName);
        await db.collection('users').updateOne(
            { email: email.toLowerCase() },
            {
                $set: {
                    emailVerified: true,
                    emailVerificationToken: null,
                    emailVerificationExpires: null,
                },
            }
        );
    } finally {
        await client.close();
    }
}

/** Prefer gated API verify; fall back to direct Mongo when flag disabled. */
export async function testVerifyEmail(email: string) {
    const res = await fetch(`${API}/auth/test/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
    });
    if (res.status === 404) {
        await forceVerifyEmail(email);
        return;
    }
    if (!res.ok) {
        const body = await res.text();
        throw new Error(`test verify failed: ${res.status} ${body}`);
    }
}

export async function registerAndLogin(opts: {
    name: string;
    email: string;
    password: string;
    role: 'customer' | 'salon_owner';
    phone: string;
}) {
    await fetch(`${API}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            name: opts.name,
            email: opts.email,
            password: opts.password,
            role: opts.role,
            phone: opts.phone,
            address: 'E2E Test Address 123',
            city: 'Jodhpur',
        }),
    });
    await testVerifyEmail(opts.email);
    const login = await fetch(`${API}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: opts.email, password: opts.password }),
    });
    const body = await login.json();
    if (!body.token) throw new Error(`Login failed: ${JSON.stringify(body)}`);
    return {
        token: body.token as string,
        user: body.user as { id: string; role: string; name: string },
        email: opts.email,
    };
}

export { API };
