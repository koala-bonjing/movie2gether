import type { SyncMsg } from './protocol';

export const SYNC = {
  ignoreBelow: 0.25, // s
  nudgeBelow: 2.0, // s
  nudgeRate: 0.05, // 1 ± 5%
  heartbeatMs: 2000,
  suppressMs: 400, // ignore our own programmatic events
  remoteSeekTimeoutMs: 2500, // max fallback window for slow async remote seeks (>400ms)
  pausedSeekTolerance: 0.1, // s
};

export type CorrectionConfig = typeof SYNC;

export type Correction =
  | { kind: 'none' }
  | { kind: 'rate'; rate: number }
  | { kind: 'seek'; to: number };

export interface SuppressionState {
  now: number;
  suppressUntil: number;
  remoteSeeking?: boolean;
  remoteSeekUntil?: number;
  videoSeeking?: boolean;
  remotePlaying?: boolean;
}

/**
 * Returns true if a programmatic remote seek is still in flight (either the media element
 * still reports `seeking === true`, or we are still awaiting the resulting `seeked` event
 * within the fallback timeout).
 */
export function isRemoteSeekInFlight(state: {
  now: number;
  remoteSeeking?: boolean;
  remoteSeekUntil?: number;
  videoSeeking?: boolean;
}): boolean {
  if (!state.remoteSeeking) return false;
  return Boolean(state.videoSeeking) || state.now < (state.remoteSeekUntil ?? 0);
}

/**
 * Pure decision function for echo suppression of local HTMLVideoElement events.
 * Suppresses events within the fixed `suppressUntil` window, as well as async
 * `seeked`/`waiting`/`play` events that fire >400ms later while a programmatic
 * remote seek or play() promise is still settling.
 */
export function shouldSuppressLocalEvent(
  event: 'play' | 'pause' | 'seeked' | 'waiting',
  state: SuppressionState,
): boolean {
  if (state.now < state.suppressUntil) return true;
  if (state.remotePlaying && (event === 'play' || event === 'waiting')) return true;
  if ((event === 'seeked' || event === 'waiting') && isRemoteSeekInFlight(state)) {
    return true;
  }
  return false;
}

/**
 * Determines the `playing` boolean to broadcast when a local seek finishes.
 * When `video.paused` is true solely because `partnerBuffering` paused local playback
 * while the room's last sync state was playing, preserves `playing = true` so
 * playback resumes once buffering finishes.
 */
export function resolveSeekPlayingState(
  videoPaused: boolean,
  partnerBuffering: boolean,
  lastSyncPlaying: boolean | undefined,
): boolean {
  if (!videoPaused) return true;
  if (partnerBuffering && lastSyncPlaying) return true;
  return false;
}

/**
 * Determines whether the 250ms drift correction tick should skip running so it
 * never overwrites `v.currentTime` in the middle of an active seek or buffer stall.
 */
export function shouldSkipDriftTick(state: {
  hasVideo: boolean;
  hasLastSync: boolean;
  paused: boolean;
  seeking: boolean;
  remoteSeeking: boolean;
  selfBuffering: boolean;
  partnerBuffering: boolean;
}): boolean {
  return (
    !state.hasVideo ||
    !state.hasLastSync ||
    state.paused ||
    state.seeking ||
    state.remoteSeeking ||
    state.selfBuffering ||
    state.partnerBuffering
  );
}

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
