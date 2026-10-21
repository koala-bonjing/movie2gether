/**
 * Reconnect backoff calculation with jitter.
 * Pure logic per CLAUDE.md conventions.
 */

export interface BackoffConfig {
  baseMs?: number;
  maxMs?: number;
  factor?: number;
  jitterRatio?: number;
}

export const DEFAULT_BACKOFF: Required<BackoffConfig> = {
  baseMs: 1000,
  maxMs: 10000,
  factor: 1.5,
  jitterRatio: 0.2, // +/- 20% jitter
};

/**
 * Computes deterministic backoff duration for a given retry attempt count.
 * @param attempt 0-indexed attempt count
 * @param config Optional backoff configuration
 * @param randomVal Optional float between 0 and 1 for deterministic unit testing
 */
export function computeBackoffDelay(
  attempt: number,
  config: BackoffConfig = {},
  randomVal = Math.random(),
): number {
  const { baseMs, maxMs, factor, jitterRatio } = {
    ...DEFAULT_BACKOFF,
    ...config,
  };

  const clampedAttempt = Math.max(0, attempt);
  const exponentialDelay = baseMs * Math.pow(factor, clampedAttempt);
  const cappedDelay = Math.min(exponentialDelay, maxMs);

  // Apply jitter: +/- (jitterRatio * cappedDelay)
  const jitterRange = cappedDelay * jitterRatio;
  const jitterDelta = (randomVal * 2 - 1) * jitterRange;

  return Math.round(Math.max(baseMs * 0.5, cappedDelay + jitterDelta));
}
