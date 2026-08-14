import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
    clampStartMs,
    concurrentSlotCount,
    remainingServiceMinutes,
} from '../services/queueMath';

describe('queueMath.concurrentSlotCount', () => {
    it('uses min(chairs, available staff)', () => {
        assert.equal(concurrentSlotCount(3, 2, 2), 2);
        assert.equal(concurrentSlotCount(1, 5, 5), 1);
    });

    it('falls back to total staff or chairs when none marked available', () => {
        assert.equal(concurrentSlotCount(3, 0, 2), 2);
        assert.equal(concurrentSlotCount(4, 0, 0), 4);
    });
});

describe('queueMath.clampStartMs', () => {
    it('never returns a start before booking time', () => {
        const booked = Date.parse('2026-08-13T02:34:00.000Z');
        const now = Date.parse('2026-08-13T02:31:00.000Z');
        const start = clampStartMs(booked, now, 0);
        assert.ok(start >= booked);
    });

    it('adds wait minutes from now when after booking time', () => {
        const booked = Date.parse('2026-08-13T02:00:00.000Z');
        const now = Date.parse('2026-08-13T02:10:00.000Z');
        assert.equal(clampStartMs(booked, now, 15), now + 15 * 60000);
    });
});

describe('queueMath.remainingServiceMinutes', () => {
    it('subtracts elapsed for in-progress bookings', () => {
        const start = new Date('2026-08-13T02:00:00.000Z');
        const now = Date.parse('2026-08-13T02:10:00.000Z');
        assert.equal(remainingServiceMinutes(40, 'in-progress', start, now), 30);
    });

    it('returns full duration for confirmed bookings', () => {
        assert.equal(remainingServiceMinutes(40, 'confirmed', null, Date.now()), 40);
    });
});
