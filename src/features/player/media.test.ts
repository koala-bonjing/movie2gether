import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { fingerprint, formatTime, mediaMismatch, type MediaInfo } from './media';

const KB = 1024;
const fileOf = (bytes: Uint8Array, name = 'movie.mp4') => new File([bytes as unknown as BlobPart], name);
const pattern = (size: number, seed = 0) => Uint8Array.from({ length: size }, (_, i) => (i * 31 + seed) % 256);

describe('fingerprint', () => {
  it('is deterministic for the same bytes (same file picked twice)', async () => {
    const bytes = pattern(600 * KB);
    const a = await fingerprint(fileOf(bytes), 10);
    const b = await fingerprint(fileOf(bytes.slice()), 10);
    expect(a.hash).toBe(b.hash);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('passes name, size and duration through', async () => {
    const info = await fingerprint(fileOf(pattern(10), 'a.mp4'), 42.5);
    expect(info).toMatchObject({ name: 'a.mp4', size: 10, duration: 42.5 });
  });

  it('matches SHA-256(head + tail + size) exactly (small file: head and tail are the whole file)', async () => {
    const bytes = pattern(1000);
    const expected = createHash('sha256').update(bytes).update(bytes).update('1000').digest('hex');
    expect((await fingerprint(fileOf(bytes), 1)).hash).toBe(expected);
  });

  it('differs when the head or tail differs', async () => {
    const base = pattern(600 * KB);
    const head = base.slice();
    head[0] = (head[0]! + 1) % 256;
    const tail = base.slice();
    tail[tail.length - 1] = (tail[tail.length - 1]! + 1) % 256;
    const [b, h, t] = await Promise.all([base, head, tail].map((x) => fingerprint(fileOf(x), 1)));
    expect(new Set([b!.hash, h!.hash, t!.hash]).size).toBe(3);
  });

  it('differs when only the size differs', async () => {
    const a = await fingerprint(fileOf(new Uint8Array(600 * KB)), 1);
    const b = await fingerprint(fileOf(new Uint8Array(601 * KB)), 1);
    expect(a.hash).not.toBe(b.hash);
  });

  it('ignores the middle of large files by design (only 512 KB is read)', async () => {
    const base = pattern(600 * KB);
    const middle = base.slice();
    middle[300 * KB] = (middle[300 * KB]! + 1) % 256;
    expect((await fingerprint(fileOf(middle), 1)).hash).toBe((await fingerprint(fileOf(base), 1)).hash);
  });

  it('ignores the file name (renamed copies still match)', async () => {
    const bytes = pattern(1000);
    expect((await fingerprint(fileOf(bytes, 'x.mp4'), 1)).hash).toBe(
      (await fingerprint(fileOf(bytes, 'y.mp4'), 1)).hash,
    );
  });

  it('handles empty 0-byte files gracefully', async () => {
    const empty = fileOf(new Uint8Array(0), 'empty.mp4');
    const info = await fingerprint(empty, 0);
    const expected = createHash('sha256').update('').update('').update('0').digest('hex');
    expect(info.hash).toBe(expected);
    expect(info.size).toBe(0);
  });

  it('handles Unicode and emoji in file names cleanly', async () => {
    const bytes = pattern(100);
    const unicodeFile = fileOf(bytes, '君の名は。🎬 1080p.mkv');
    const info = await fingerprint(unicodeFile, 120);
    expect(info.name).toBe('君の名は。🎬 1080p.mkv');
    expect(info.hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('handles large files (>4GB) without integer overflow', async () => {
    const headBytes = pattern(256 * KB, 1);
    const tailBytes = pattern(256 * KB, 2);
    const FIVE_GB = 5 * 1024 * 1024 * 1024; // 5,368,709,120 bytes (> 32-bit limit)

    const largeFileLike = {
      name: 'large_movie.mp4',
      size: FIVE_GB,
      slice(start?: number) {
        if (start === 0) return new Blob([headBytes as unknown as BlobPart]);
        return new Blob([tailBytes as unknown as BlobPart]);
      },
    } as unknown as File;

    const info = await fingerprint(largeFileLike, 7200);
    expect(info.size).toBe(FIVE_GB);
    expect(info.hash).toMatch(/^[0-9a-f]{64}$/);
    const expected = createHash('sha256')
      .update(headBytes)
      .update(tailBytes)
      .update(String(FIVE_GB))
      .digest('hex');
    expect(info.hash).toBe(expected);
  });
});

describe('mediaMismatch', () => {
  const a: MediaInfo = { name: 'a', size: 1, duration: 100, hash: 'h' };
  it.each([
    ['identical', a, false],
    ['different name only', { ...a, name: 'b' }, false],
    ['duration off by exactly 1 s', { ...a, duration: 101 }, false],
    ['duration off by 1.01 s', { ...a, duration: 98.99 }, true],
    ['hash differs', { ...a, hash: 'x' }, true],
    ['NaN duration in b', { ...a, duration: NaN }, true],
    ['Infinity duration in b', { ...a, duration: Infinity }, true],
  ])('%s', (_, b, expected) => expect(mediaMismatch(a, b)).toBe(expected));

  it('respects custom toleranceS', () => {
    const b = { ...a, duration: 101.5 };
    expect(mediaMismatch(a, b, 1)).toBe(true);
    expect(mediaMismatch(a, b, 2)).toBe(false);
  });
});

describe('formatTime', () => {
  it.each([
    [0, '0:00'],
    [5.9, '0:05'],
    [65, '1:05'],
    [2472, '41:12'],
    [3600, '1:00:00'],
    [7325, '2:02:05'],
    [NaN, '0:00'],
    [Infinity, '0:00'],
    [-3, '0:00'],
  ])('%s -> %s', (s, expected) => expect(formatTime(s)).toBe(expected));
});
