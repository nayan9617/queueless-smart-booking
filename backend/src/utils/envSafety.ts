/**
 * Dev/test flags that must never silently apply in a real beta/production runtime.
 */
const DANGEROUS_FLAGS = [
    'ALLOW_DEMO_PAY',
    'ALLOW_TEST_EMAIL_VERIFY',
    'DISABLE_RATE_LIMIT',
] as const;

export type DangerousFlag = (typeof DANGEROUS_FLAGS)[number];

export const isStrictRuntime = () => {
    const appEnv = (process.env.APP_ENV || '').toLowerCase();
    return (
        process.env.NODE_ENV === 'production' ||
        appEnv === 'beta' ||
        appEnv === 'production'
    );
};

export const isDangerousFlagRequested = (name: DangerousFlag) =>
    process.env[name] === 'true';

/** Effective value: always false in beta/production even if env is true. */
export const isDangerousFlagEnabled = (name: DangerousFlag) => {
    if (!isDangerousFlagRequested(name)) return false;
    if (isStrictRuntime()) return false;
    return true;
};

export const warnUnsafeEnvFlags = () => {
    const strict = isStrictRuntime();
    for (const name of DANGEROUS_FLAGS) {
        if (!isDangerousFlagRequested(name)) continue;
        if (strict) {
            console.warn(
                JSON.stringify({
                    ts: new Date().toISOString(),
                    level: 'warn',
                    msg: `Ignoring dangerous flag ${name}=true (APP_ENV/NODE_ENV is beta/production)`,
                    flag: name,
                })
            );
        } else {
            console.warn(
                JSON.stringify({
                    ts: new Date().toISOString(),
                    level: 'warn',
                    msg: `DEV FLAG ON: ${name}=true — do not use this in a real user beta`,
                    flag: name,
                })
            );
        }
    }

    const secret = process.env.JWT_SECRET || '';
    if (strict && (!secret || secret === 'change-me')) {
        throw new Error(
            'JWT_SECRET must be a strong unique value when APP_ENV/NODE_ENV is beta or production'
        );
    }
};
