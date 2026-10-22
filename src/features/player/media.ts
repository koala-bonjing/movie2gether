const CHUNK = 256 * 1024;

export type MediaInfo = {
  name: string;
  size: number;
  duration: number;
  hash: string;
  url?: string;
  mediaType?: 'file' | 'direct' | 'youtube';
};

export type ParsedVideoSource =
  | { type: 'youtube'; videoId: string; url: string; label: string }
  | { type: 'direct'; url: string; label: string };

export function parseVideoSource(raw: string): ParsedVideoSource | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // YouTube URLs (watch, embed, shorts, youtu.be)
  const ytMatch = trimmed.match(
    /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/i,
  );
  if (ytMatch && ytMatch[1]) {
    const videoId = ytMatch[1];
    return {
      type: 'youtube',
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      label: `YouTube (${videoId})`,
    };
  }

  // Direct HTTP/HTTPS or local root paths
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith('/')) {
    try {
      const parsedUrl = trimmed.startsWith('/') ? new URL(trimmed, 'http://localhost') : new URL(trimmed);
      const pathname = parsedUrl.pathname;
      const fileName = pathname.split('/').filter(Boolean).pop() || 'Direct Video Stream';
      return {
        type: 'direct',
        url: trimmed,
        label: decodeURIComponent(fileName),
      };
    } catch {
      return {
        type: 'direct',
        url: trimmed,
        label: 'Direct Video Stream',
      };
    }
  }

  return null;
}

/**
 * Cheap, stable identity for a local file (ARCHITECTURE §9):
 * SHA-256 of first 256 KB + last 256 KB + decimal size. Only the slices are read, never the whole file.
 * Needs a secure context (HTTPS or localhost) for crypto.subtle.
 */
export async function fingerprint(file: File, duration: number): Promise<MediaInfo> {
  const bytes = new Blob([file.slice(0, CHUNK), file.slice(Math.max(0, file.size - CHUNK)), String(file.size)]);
  const digest = await crypto.subtle.digest('SHA-256', await bytes.arrayBuffer());
  const hash = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return { name: file.name, size: file.size, duration, hash };
}

/** Non-blocking mismatch rule: hashes differ, durations are non-finite, or durations differ by more than `toleranceS`. */
export const mediaMismatch = (a: MediaInfo, b: MediaInfo, toleranceS = 1) =>
  a.hash !== b.hash ||
  !Number.isFinite(a.duration) ||
  !Number.isFinite(b.duration) ||
  Math.abs(a.duration - b.duration) > toleranceS;

/** 65 -> "1:05", 2472 -> "41:12", 3600 -> "1:00:00". Non-finite or negative -> "0:00". */
export function formatTime(seconds: number): string {
  const t = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
