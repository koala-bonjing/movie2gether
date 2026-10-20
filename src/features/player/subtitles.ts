/**
 * Convert SubRip (.srt) subtitle string to WebVTT format for native HTML5 `<track>`.
 * Replaces comma-delimited millisecond timestamps with dot-delimited timestamps
 * and prepends the required WEBVTT header.
 */
export function srtToVtt(srtContent: string): string {
  const normalized = srtContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();
  if (!normalized) return 'WEBVTT\n';
  if (normalized.startsWith('WEBVTT')) return normalized;

  // Convert "00:01:23,456 --> 00:01:25,789" to "00:01:23.456 --> 00:01:25.789"
  const vttBody = normalized.replace(
    /(\d{2}:\d{2}:\d{2}),(\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}),(\d{3})/g,
    '$1.$2 --> $3.$4',
  );

  return `WEBVTT\n\n${vttBody}\n`;
}
