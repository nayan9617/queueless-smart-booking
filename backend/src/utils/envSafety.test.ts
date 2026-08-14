import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isDangerousFlagEnabled, isStrictRuntime } from './envSafety';

describe('envSafety', () => {
    it('treats missing flags as disabled', () => {
        const prev = process.env.ALLOW_DEMO_PAY;
        delete process.env.ALLOW_DEMO_PAY;
        assert.equal(isDangerousFlagEnabled('ALLOW_DEMO_PAY'), false);
        if (prev !== undefined) process.env.ALLOW_DEMO_PAY = prev;
    });

    it('isStrictRuntime is true for APP_ENV=beta', () => {
        const prev = process.env.APP_ENV;
        process.env.APP_ENV = 'beta';
        assert.equal(isStrictRuntime(), true);
        if (prev === undefined) delete process.env.APP_ENV;
        else process.env.APP_ENV = prev;
    });
});
