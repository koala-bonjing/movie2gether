import { describe, it, expect } from 'vitest';
import { formatBitrate, formatResolution } from '../features/call/webrtc';

describe('QualityBadge formatting logic', () => {
  it('formats full resolution, fps and bitrate', () => {
    const stats = {
      width: 1920,
      height: 1080,
      fps: 30,
      bitrateKbps: 5800,
    };

    const res = formatResolution(stats.width, stats.height);
    const fps = `${stats.fps}fps`;
    const bitrate = formatBitrate(stats.bitrateKbps);

    expect(res).toBe('1080p');
    expect(fps).toBe('30fps');
    expect(bitrate).toBe('5.8 Mbps');
    expect([res, fps, bitrate].join(' · ')).toBe('1080p · 30fps · 5.8 Mbps');
  });

  it('formats lower resolutions and kbps bitrates', () => {
    const stats = {
      width: 1280,
      height: 720,
      fps: 24,
      bitrateKbps: 900,
    };

    const res = formatResolution(stats.width, stats.height);
    const fps = `${stats.fps}fps`;
    const bitrate = formatBitrate(stats.bitrateKbps);

    expect(res).toBe('720p');
    expect(fps).toBe('24fps');
    expect(bitrate).toBe('900 kbps');
  });

  it('handles partial stats gracefully', () => {
    const res = formatResolution(640, 360);
    expect(res).toBe('640×360');
    expect(formatBitrate(undefined)).toBe('');
  });
});
