/**
 * NTP-style clock offset estimation (ARCHITECTURE.md §4).
 * A sends ping at t0 (local clock).
 * B receives and replies pong at t1 (remote clock).
 * A receives pong at t2 (local clock).
 * RTT = t2 - t0.
 * Offset (Remote - Local) = t1 - (t0 + RTT / 2).
 */

export interface ClockSample {
  rtt: number;
  offset: number; // remoteClock - localClock in ms
}

export function calculateClockSample(t0: number, t1: number, t2: number): ClockSample {
  const rtt = Math.max(0, t2 - t0);
  const offset = t1 - (t0 + rtt / 2);
  return { rtt, offset };
}

export function selectLowestRttSample(samples: ClockSample[]): ClockSample | null {
  const first = samples[0];
  if (!first) return null;
  let best: ClockSample = first;
  for (let i = 1; i < samples.length; i++) {
    const sample = samples[i];
    if (sample && sample.rtt < best.rtt) {
      best = sample;
    }
  }
  return best;
}

export function applyEma(currentOffset: number | null, newSampleOffset: number, alpha = 0.2): number {
  if (currentOffset === null || !Number.isFinite(currentOffset)) {
    return newSampleOffset;
  }
  return alpha * newSampleOffset + (1 - alpha) * currentOffset;
}

export class ClockEstimator {
  private samples: ClockSample[] = [];
  private maxSamples: number;
  private smoothedOffset: number | null = null;
  private lowestRtt: number = 0;

  constructor(maxSamples = 8) {
    this.maxSamples = maxSamples;
  }

  addSample(t0: number, t1: number, t2: number): ClockSample {
    const sample = calculateClockSample(t0, t1, t2);
    this.samples.push(sample);
    if (this.samples.length > this.maxSamples) {
      this.samples.shift();
    }

    const best = selectLowestRttSample(this.samples);
    if (best) {
      this.lowestRtt = best.rtt;
      this.smoothedOffset = applyEma(this.smoothedOffset, best.offset);
    }
    return sample;
  }

  reset(): void {
    this.samples = [];
    this.smoothedOffset = null;
    this.lowestRtt = 0;
  }

  getOffset(): number {
    return this.smoothedOffset ?? 0;
  }

  getLowestRtt(): number {
    return this.lowestRtt;
  }

  getSampleCount(): number {
    return this.samples.length;
  }
}
