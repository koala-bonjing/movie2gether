---
name: local-video-files
description: Handling local video files in Duet — picking, object URLs, fingerprinting, codec problems, ffmpeg remux, subtitles. Use when working in src/features/player.
---

# local-video-files

## Mental model
The browser plays a file straight from disk through a temporary URL. Nothing is uploaded. The only thing we exchange with the partner is a small **fingerprint** to check that you both have the same cut.

## Picking and playing
```ts
const url = URL.createObjectURL(file);
video.src = url;
// on change/unmount:
URL.revokeObjectURL(url);
```
Use `<input type="file" accept="video/*,.mkv">`. Show name, size, duration once `loadedmetadata` fires.

## Fingerprint
```ts
async function fingerprint(file: File, duration: number) {
  const head = await file.slice(0, 262144).arrayBuffer();
  const tail = await file.slice(Math.max(0, file.size - 262144)).arrayBuffer();
  const size = new TextEncoder().encode(String(file.size));
  const buf = new Uint8Array(head.byteLength + tail.byteLength + size.length);
  buf.set(new Uint8Array(head), 0);
  buf.set(new Uint8Array(tail), head.byteLength);
  buf.set(size, head.byteLength + tail.byteLength);
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return { name: file.name, size: file.size, duration, hash: toHex(digest) };
}
```
Mismatch rule: duration differs by > 1 s or hash differs → non-blocking warning.

## Codec problems
Symptoms: audio but no picture, `video.error.code === 4`, or `videoWidth === 0`.
- Supported everywhere: **MP4, H.264 video, AAC audio**.
- MKV or HEVC often fails on phones and some browsers.
- Fix without re-encoding (if codecs are already H.264/AAC):
```
ffmpeg -i input.mkv -c copy output.mp4
```
- If video is HEVC or audio is AC3/DTS, re-encode:
```
ffmpeg -i input.mkv -c:v libx264 -crf 18 -preset medium -c:a aac -b:a 192k output.mp4
```
Show this hint in the UI error state.

## Subtitles
- Load `.vtt` directly via `<track>` and a Blob URL. Convert `.srt` → `.vtt` client-side (replace `,` with `.` in timestamps, add `WEBVTT` header).
- Subtitles are local to each person; do not sync them.
- Offer size and offset controls (±0.5 s steps).

## Gotchas
- Large files: never read them fully into memory; only slice.
- iOS Safari: requires `playsInline` and a user gesture for the first play.
- Revoke object URLs on file change to avoid leaks.
