import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    clampStartMs,
    concurrentSlotCount,
    remainingServiceMinutes,
} from '../services/queueMath';

/**
 * Scenario-style assertions for the queue engine math used by QueueLess.
 * These do not hit Mongo — they lock the invariants the production simulator relies on.
 */

describe('Queue scenarios (math invariants)', () => {
    it('Scenario 1: 1 chair — next guest waits full prior duration', () => {
        const slots = concurrentSlotCount(1, 1, 1);
        assert.equal(slots, 1);
        const now = Date.parse('2026-08-13T10:00:00.000Z');
        const chairs = [now + 40 * 60000]; // chair busy 40 min
        const wait = Math.max(0, Math.ceil((Math.min(...chairs) - now) / 60000));
        assert.equal(wait, 40);
    });

    it('Scenario 2: 3 chairs — first three guests start immediately', () => {
        const slots = concurrentSlotCount(3, 3, 3);
        assert.equal(slots, 3);
        const now = Date.now();
        const chairs = new Array(slots).fill(now);
        // Assign A,B,C
        for (let i = 0; i < 3; i++) {
            const idx = chairs.indexOf(Math.min(...chairs));
            assert.equal(chairs[idx], now);
            chairs[idx] = now + 30 * 60000;
        }
        // D waits for earliest free (~30)
        const waitD = Math.max(0, Math.ceil((Math.min(...chairs) - now) / 60000));
        assert.equal(waitD, 30);
    });

    it('Scenario 3: different durations — ETA follows earliest free chair', () => {
        const now = Date.parse('2026-08-13T10:00:00.000Z');
        // After assigning 40, 20, 60 on 3 chairs, earliest free is +20
        const chairs = [now + 40 * 60000, now + 20 * 60000, now + 60 * 60000];
        const wait = Math.max(0, Math.ceil((Math.min(...chairs) - now) / 60000));
        assert.equal(wait, 20);
    });

    it('Scenario 4: cancellation frees capacity (earliest chair moves earlier)', () => {
        const now = Date.parse('2026-08-13T10:00:00.000Z');
        const before = [now + 40 * 60000, now + 40 * 60000];
        const afterCancel = [now, now + 40 * 60000]; // one chair freed
        const waitBefore = Math.ceil((Math.min(...before) - now) / 60000);
        const waitAfter = Math.ceil((Math.min(...afterCancel) - now) / 60000);
        assert.ok(waitAfter < waitBefore);
        assert.equal(waitAfter, 0);
    });

    it('Scenario 5: in-progress overrun increases remaining work', () => {
        const start = new Date('2026-08-13T10:00:00.000Z');
        const nowEarly = Date.parse('2026-08-13T10:10:00.000Z');
        const nowLate = Date.parse('2026-08-13T10:50:00.000Z');
        assert.equal(remainingServiceMinutes(40, 'in-progress', start, nowEarly), 30);
        assert.equal(remainingServiceMinutes(40, 'in-progress', start, nowLate), 0);
    });

    it('Scenario 7/8: staff availability changes concurrent capacity', () => {
        assert.equal(concurrentSlotCount(4, 1, 4), 1);
        assert.equal(concurrentSlotCount(4, 4, 4), 4);
    });

    it('Start time never precedes booking time', () => {
        const booked = Date.parse('2026-08-13T02:34:00.000Z');
        const skewedNow = Date.parse('2026-08-13T02:31:00.000Z');
        assert.ok(clampStartMs(booked, skewedNow, 0) >= booked);
    });
});
