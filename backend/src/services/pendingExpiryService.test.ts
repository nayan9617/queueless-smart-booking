import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { expireStalePendingBookings } from './pendingExpiryService';

describe('pendingExpiryService', () => {
    it('exports expireStalePendingBookings function', () => {
        assert.equal(typeof expireStalePendingBookings, 'function');
    });
});
