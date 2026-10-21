import { describe, expect, it } from 'vitest';
import { srtToVtt, SUBTITLE_FONT_SIZES, parseSubtitleFile } from './subtitles';

describe('srtToVtt', () => {
  it('handles empty input gracefully', () => {
    expect(srtToVtt('')).toBe('WEBVTT\n');
    expect(srtToVtt('   \n  ')).toBe('WEBVTT\n');
  });

  it('preserves input if already WebVTT', () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:04.000\nHello';
    expect(srtToVtt(vtt)).toBe(`${vtt}\n`);
  });

  it('strips UTF-8 BOM if present', () => {
    const srt = '\uFEFF1\n00:00:01,000 --> 00:00:02,000\nHello\n';
    const result = srtToVtt(srt);
    expect(result.startsWith('WEBVTT')).toBe(true);
    expect(result).not.toContain('\uFEFF');
    expect(result).toContain('00:00:01.000 --> 00:00:02.000');
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
    const srt = '1\r\n00:00:01,000 --> 00:00:02,000\r\nHi\r\n';
    expect(srtToVtt(srt)).toContain('00:00:01.000 --> 00:00:02.000\nHi');
  });
});

describe('SUBTITLE_FONT_SIZES', () => {
  it('defines sm, md, and lg font sizes matching design spec', () => {
    expect(SUBTITLE_FONT_SIZES.sm.px).toBe('14px');
    expect(SUBTITLE_FONT_SIZES.md.px).toBe('18px');
    expect(SUBTITLE_FONT_SIZES.lg.px).toBe('24px');
  });
});

describe('parseSubtitleFile', () => {
  it('parses an SRT File and produces WebVTT content', async () => {
    const srt = '1\n00:00:01,500 --> 00:00:03,500\nSubtitles loaded!';
    const file = new File([srt], 'sample_sub.srt', { type: 'text/plain' });
    const parsed = await parseSubtitleFile(file);
    expect(parsed.label).toBe('sample_sub');
    expect(parsed.vttContent).toContain('WEBVTT');
    expect(parsed.vttContent).toContain('00:00:01.500 --> 00:00:03.500');
  });

  it('parses a VTT File directly', async () => {
    const vtt = 'WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nDirect VTT';
    const file = new File([vtt], 'movie.vtt', { type: 'text/vtt' });
    const parsed = await parseSubtitleFile(file);
    expect(parsed.label).toBe('movie');
    expect(parsed.vttContent).toBe(vtt);
  });
});
