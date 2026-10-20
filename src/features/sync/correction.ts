import type { SyncMsg } from './protocol';

export const SYNC = {
  ignoreBelow: 0.25, // s
  nudgeBelow: 2.0, // s
  nudgeRate: 0.05, // 1 ± 5%
  heartbeatMs: 2000,
  suppressMs: 400, // ignore our own programmatic events
  pausedSeekTolerance: 0.1, // s
};

export type CorrectionConfig = typeof SYNC;

export type Correction =
  | { kind: 'none' }
  | { kind: 'rate'; rate: number }
  | { kind: 'seek'; to: number };

/**
 * Predicts the expected video position at `nowLocal`, given a reference SyncMsg
 * and the estimated clock offset (offset = remoteClock - localClock).
 */
export function expectedPos(s: SyncMsg, offsetRemoteMinusLocal: number, nowLocal: number): number {
  if (!s.playing) return s.pos;
  const sentAtLocal = s.at - offsetRemoteMinusLocal;
  const elapsedSeconds = Math.max(0, (nowLocal - sentAtLocal) / 1000);
  return s.pos + elapsedSeconds * s.rate;
}

/**
 * Calculates drift between local player position and expected position.
 * Positive drift means the local player is ahead of expected.
 * Negative drift means the local player is behind expected.
 */
export function calculateDrift(local: number, expected: number): number {
  return local - expected;
}

/**
 * Decides whether to do nothing, nudge playbackRate, or hard-seek based on drift.
 */
export function decideCorrection(
  local: number,
  expected: number,
  playing: boolean,
  cfg: CorrectionConfig = SYNC,
): Correction {
  const drift = local - expected; // + means we're ahead
  const a = Math.abs(drift);

  if (!playing) {
    return a > cfg.pausedSeekTolerance ? { kind: 'seek', to: expected } : { kind: 'none' };
  }

  if (a < cfg.ignoreBelow) {
    return { kind: 'rate', rate: 1 };
  }

  if (a < cfg.nudgeBelow) {
    return { kind: 'rate', rate: drift > 0 ? 1 - cfg.nudgeRate : 1 + cfg.nudgeRate };
  }

  return { kind: 'seek', to: expected };
}
