/**
 * Convert SubRip (.srt) subtitle string to WebVTT format for native HTML5 `<track>`.
 * Replaces comma-delimited millisecond timestamps with dot-delimited timestamps
 * and prepends the required WEBVTT header.
 */
export function srtToVtt(srtContent: string): string {
  // Strip BOM if present
  const clean = srtContent.replace(/^\uFEFF/, '');
  const normalized = clean.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return 'WEBVTT\n';
  if (normalized.startsWith('WEBVTT')) return `${normalized}\n`;

  // Convert "00:01:23,456 --> 00:01:25,789" to "00:01:23.456 --> 00:01:25.789"
  const vttBody = normalized.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    '$1.$2 --> $3.$4',
  );

  return `WEBVTT\n\n${vttBody}\n`;
}

export {
  SUBTITLE_FONT_SIZES,
  type SubtitleFontSize,
  type SubtitleTrack,
} from './subtitleTypes';

export function createSubtitleBlobUrl(vttContent: string): string {
  if (typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) {
    return '';
  }
  const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
  return URL.createObjectURL(blob);
}

export async function parseSubtitleFile(file: File): Promise<{ vttContent: string; label: string }> {
  const text = await file.text();
  const isSrt = file.name.toLowerCase().endsWith('.srt') || !text.trim().startsWith('WEBVTT');
  const vttContent = isSrt ? srtToVtt(text) : (text.trim().startsWith('WEBVTT') ? text : `WEBVTT\n\n${text}`);
  return {
    vttContent,
    label: file.name.replace(/\.(srt|vtt)$/i, ''),
  };
}
