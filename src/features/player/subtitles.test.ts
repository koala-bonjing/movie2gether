import { describe, expect, it } from 'vitest';
import { srtToVtt } from './subtitles';

describe('srtToVtt', () => {
  it('handles empty input gracefully', () => {
    expect(srtToVtt('')).toBe('WEBVTT\n');
    expect(srtToVtt('   \n  ')).toBe('WEBVTT\n');
  });

  it('preserves input if already WebVTT', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello';
    expect(srtToVtt(vtt)).toBe(vtt);
  });

  it('converts SRT timestamps and adds WEBVTT header', () => {
    const srt = `1
00:01:20,000 --> 00:01:23,450
We two are in sync.

2
00:01:24,100 --> 00:01:28,990
Enjoy the movie!`;

    const expected = `WEBVTT

1
00:01:20.000 --> 00:01:23.450
We two are in sync.

2
00:01:24.100 --> 00:01:28.990
Enjoy the movie!
`;

    expect(srtToVtt(srt)).toBe(expected);
  });

  it('handles Windows CRLF line breaks', () => {
    const srt = "1\r\n00:00:01,000 --> 00:00:02,000\r\nHi\r\n";
    expect(srtToVtt(srt)).toContain('00:00:01.000 --> 00:00:02.000\nHi');
  });
});
