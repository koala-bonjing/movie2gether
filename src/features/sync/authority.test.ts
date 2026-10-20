import { describe, it, expect } from 'vitest';
import {
  shouldAcceptRemoteSync,
  computeNextLocalSeq,
  isController,
  compareActionAuthority,
} from './authority';

describe('authority and Lamport conflict resolution', () => {
  describe('shouldAcceptRemoteSync', () => {
    it('accepts incoming sync when there is no prior state', () => {
      expect(shouldAcceptRemoteSync({ seq: 1, from: 'user-b' }, null)).toBe(true);
    });

    it('accepts incoming sync with higher sequence number', () => {
      const current = { seq: 3, from: 'user-z' };
      expect(shouldAcceptRemoteSync({ seq: 4, from: 'user-a' }, current)).toBe(true);
    });

    it('rejects incoming sync with lower sequence number', () => {
      const current = { seq: 5, from: 'user-a' };
      expect(shouldAcceptRemoteSync({ seq: 4, from: 'user-z' }, current)).toBe(false);
    });

    describe('when sequence numbers are equal (tie-breaking)', () => {
      it('accepts if incoming sender ID is lexicographically greater', () => {
        const current = { seq: 2, from: 'alice' };
        expect(shouldAcceptRemoteSync({ seq: 2, from: 'bob' }, current)).toBe(true);
      });

      it('rejects if incoming sender ID is lexicographically smaller', () => {
        const current = { seq: 2, from: 'bob' };
        expect(shouldAcceptRemoteSync({ seq: 2, from: 'alice' }, current)).toBe(false);
      });

      it('accepts heartbeat from current controller with same sequence number', () => {
        const current = { seq: 2, from: 'alice' };
        expect(
          shouldAcceptRemoteSync({ seq: 2, from: 'alice', heartbeat: true }, current),
        ).toBe(true);
      });

      it('rejects duplicate non-heartbeat from same sender with same sequence number', () => {
        const current = { seq: 2, from: 'alice' };
        expect(
          shouldAcceptRemoteSync({ seq: 2, from: 'alice', heartbeat: false }, current),
        ).toBe(false);
      });
    });
  });

  describe('computeNextLocalSeq', () => {
    it('increments above max of local and last accepted', () => {
      expect(computeNextLocalSeq(1, 4)).toBe(5);
      expect(computeNextLocalSeq(7, 4)).toBe(8);
      expect(computeNextLocalSeq(5, 5)).toBe(6);
    });
  });

  describe('isController', () => {
    it('returns true only when controllerId matches selfId', () => {
      expect(isController('user-1', 'user-1')).toBe(true);
      expect(isController('user-2', 'user-1')).toBe(false);
      expect(isController(null, 'user-1')).toBe(false);
      expect(isController(undefined, 'user-1')).toBe(false);
    });
  });

  describe('compareActionAuthority', () => {
    it('sorts by seq first, then by sender ID', () => {
      expect(compareActionAuthority({ seq: 1, from: 'b' }, { seq: 2, from: 'a' })).toBeLessThan(0);
      expect(compareActionAuthority({ seq: 2, from: 'b' }, { seq: 1, from: 'a' })).toBeGreaterThan(0);
      expect(compareActionAuthority({ seq: 2, from: 'a' }, { seq: 2, from: 'b' })).toBeLessThan(0);
      expect(compareActionAuthority({ seq: 2, from: 'b' }, { seq: 2, from: 'a' })).toBeGreaterThan(0);
      expect(compareActionAuthority({ seq: 2, from: 'a' }, { seq: 2, from: 'a' })).toBe(0);
    });
  });
});
