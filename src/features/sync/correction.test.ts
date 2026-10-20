import { describe, it, expect } from 'vitest';
import { expectedPos, decideCorrection, calculateDrift } from './correction';
import type { SyncMsg } from './protocol';

describe('drift correction and expected position', () => {
  describe('expectedPos', () => {
    it('returns s.pos when video is paused', () => {
      const msg: SyncMsg = {
        seq: 1,
        from: 'u1',
        playing: false,
        pos: 15.5,
        rate: 1,
        at: 10000,
      };
      expect(expectedPos(msg, 500, 20000)).toBe(15.5);
    });

    it('advances position by elapsed time and playback rate when playing', () => {
      // Remote sent at remote clock 5000.
      // Remote offset (Remote - Local) = 1000.
      // Sent at local clock: 5000 - 1000 = 4000.
      // Now local clock is 6000 (2 seconds later).
      // Rate is 1, pos was 10. Expected = 10 + 2 = 12.
      const msg: SyncMsg = {
        seq: 1,
        from: 'u1',
        playing: true,
        pos: 10,
        rate: 1,
        at: 5000,
      };
      expect(expectedPos(msg, 1000, 6000)).toBeCloseTo(12);
    });

    it('takes playback rate into account', () => {
      const msg: SyncMsg = {
        seq: 1,
        from: 'u1',
        playing: true,
        pos: 10,
        rate: 1.5,
        at: 5000,
      };
      // 2 seconds elapsed * 1.5 = 3 seconds advanced
      expect(expectedPos(msg, 1000, 6000)).toBeCloseTo(13);
    });

    it('clamps negative elapsed time to 0', () => {
      const msg: SyncMsg = {
        seq: 1,
        from: 'u1',
        playing: true,
        pos: 10,
        rate: 1,
        at: 5000,
      };
      // sentAtLocal = 5000 - 0 = 5000. nowLocal = 4500 (earlier)
      expect(expectedPos(msg, 0, 4500)).toBe(10);
    });
  });

  describe('decideCorrection', () => {
    describe('when paused', () => {
      it('returns none if drift is within pausedSeekTolerance (<= 0.1s)', () => {
        expect(decideCorrection(10.05, 10.0, false)).toEqual({ kind: 'none' });
        expect(decideCorrection(9.95, 10.0, false)).toEqual({ kind: 'none' });
      });

      it('returns seek to expected if drift exceeds pausedSeekTolerance (> 0.1s)', () => {
        expect(decideCorrection(10.2, 10.0, false)).toEqual({ kind: 'seek', to: 10.0 });
        expect(decideCorrection(9.8, 10.0, false)).toEqual({ kind: 'seek', to: 10.0 });
      });
    });

    describe('when playing', () => {
      it('returns rate 1 when drift is under ignoreBelow (< 0.25s)', () => {
        expect(decideCorrection(10.15, 10.0, true)).toEqual({ kind: 'rate', rate: 1 });
        expect(decideCorrection(9.85, 10.0, true)).toEqual({ kind: 'rate', rate: 1 });
      });

      it('nudges rate down when local is ahead (0.25s <= drift < 2.0s)', () => {
        // local = 10.5, expected = 10.0 -> drift = +0.5s -> slow down (1 - 0.05 = 0.95)
        expect(decideCorrection(10.5, 10.0, true)).toEqual({ kind: 'rate', rate: 0.95 });
      });

      it('nudges rate up when local is behind (-2.0s < drift <= -0.25s)', () => {
        // local = 9.5, expected = 10.0 -> drift = -0.5s -> speed up (1 + 0.05 = 1.05)
        expect(decideCorrection(9.5, 10.0, true)).toEqual({ kind: 'rate', rate: 1.05 });
      });

      it('returns hard seek when drift is 2.0s or greater', () => {
        expect(decideCorrection(13.0, 10.0, true)).toEqual({ kind: 'seek', to: 10.0 });
        expect(decideCorrection(7.0, 10.0, true)).toEqual({ kind: 'seek', to: 10.0 });
      });
    });
  });

  describe('calculateDrift', () => {
    it('returns positive drift when local is ahead', () => {
      expect(calculateDrift(12.5, 12.0)).toBeCloseTo(0.5);
    });

    it('returns negative drift when local is behind', () => {
      expect(calculateDrift(11.2, 12.0)).toBeCloseTo(-0.8);
    });
  });
});
