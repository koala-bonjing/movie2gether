import { describe, it, expect } from 'vitest';
import { computeBackoffDelay } from './reconnect';

describe('computeBackoffDelay', () => {
  it('calculates exponential progression with 0 jitter', () => {
    // randomVal = 0.5 produces 0 delta in ((0.5 * 2 - 1) * jitter) = 0
    const delay0 = computeBackoffDelay(0, {}, 0.5);
    expect(delay0).toBe(1000);

    const delay1 = computeBackoffDelay(1, {}, 0.5);
    expect(delay1).toBe(1500);

    const delay2 = computeBackoffDelay(2, {}, 0.5);
    expect(delay2).toBe(2250);

    const delay3 = computeBackoffDelay(3, {}, 0.5);
    expect(delay3).toBe(3375);
  });

  it('caps at maxMs (10000 ms)', () => {
    const delay10 = computeBackoffDelay(10, {}, 0.5);
    expect(delay10).toBe(10000);

    const delay20 = computeBackoffDelay(20, {}, 0.5);
    expect(delay20).toBe(10000);
  });

  it('applies jitter within expected bounds', () => {
    // min jitter when randomVal = 0 -> -20%
    const minDelay = computeBackoffDelay(0, {}, 0);
    expect(minDelay).toBe(800);

    // max jitter when randomVal = 1 -> +20%
    const maxDelay = computeBackoffDelay(0, {}, 1);
    expect(maxDelay).toBe(1200);
  });

  it('handles negative attempts safely', () => {
    const delayNeg = computeBackoffDelay(-5, {}, 0.5);
    expect(delayNeg).toBe(1000);
  });
});
