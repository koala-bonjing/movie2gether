import { describe, it, expect } from 'vitest';
import {
  calculateClockSample,
  selectLowestRttSample,
  applyEma,
  ClockEstimator,
} from './clock';

describe('clock sync estimation (NTP)', () => {
  it('calculates offset correctly with symmetric RTT', () => {
    // Local ping sent at 1000
    // Remote received at 2050
    // Local received pong at 1100
    // RTT = 100ms. Half RTT = 50ms.
    // Remote clock was ahead by 1000ms.
    const sample = calculateClockSample(1000, 2050, 1100);
    expect(sample.rtt).toBe(100);
    expect(sample.offset).toBe(1000);
  });

  it('calculates offset with asymmetric RTT', () => {
    // Local ping at 1000
    // Remote pong at 2030
    // Local received at 1200
    // RTT = 200ms. Half RTT = 100ms.
    // Offset = 2030 - (1000 + 100) = 930ms
    const sample = calculateClockSample(1000, 2030, 1200);
    expect(sample.rtt).toBe(200);
    expect(sample.offset).toBe(930);
  });

  it('selects the sample with the lowest RTT', () => {
    const samples = [
      { rtt: 150, offset: 500 },
      { rtt: 40, offset: 520 }, // lowest
      { rtt: 80, offset: 510 },
      { rtt: 200, offset: 480 },
    ];
    const best = selectLowestRttSample(samples);
    expect(best).toEqual({ rtt: 40, offset: 520 });
  });

  it('returns null when selecting from empty samples', () => {
    expect(selectLowestRttSample([])).toBeNull();
  });

  it('applies EMA smoothing properly', () => {
    // Initial offset is 1000. New sample is 1100.
    // EMA = 0.2 * 1100 + 0.8 * 1000 = 220 + 800 = 1020.
    const smoothed = applyEma(1000, 1100, 0.2);
    expect(smoothed).toBeCloseTo(1020);

    // Initial offset is null
    expect(applyEma(null, 500)).toBe(500);
  });

  it('ClockEstimator windows samples and updates offset and lowest RTT', () => {
    const estimator = new ClockEstimator(4);

    estimator.addSample(1000, 2000, 1200); // RTT 200, offset 900
    expect(estimator.getSampleCount()).toBe(1);
    expect(estimator.getLowestRtt()).toBe(200);
    expect(estimator.getOffset()).toBe(900);

    estimator.addSample(2000, 3050, 2100); // RTT 100, offset 1000 (lower RTT)
    expect(estimator.getLowestRtt()).toBe(100);
    // EMA: 0.2 * 1000 + 0.8 * 900 = 920
    expect(estimator.getOffset()).toBeCloseTo(920);

    estimator.reset();
    expect(estimator.getSampleCount()).toBe(0);
    expect(estimator.getOffset()).toBe(0);
  });
});
