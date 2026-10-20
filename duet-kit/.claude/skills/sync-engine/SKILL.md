---
name: sync-engine
description: How Duet keeps two video players in sync — clock offset, drift correction, authority, echo suppression, buffering. Use when writing or debugging anything in src/features/sync or src/features/player.
---

# sync-engine

## Mental model
Two players, one shared "what we're doing" state: `{ playing, pos, rate, at }`. Each client compares its own `currentTime` to the **expected** position computed from the latest shared state and fixes the difference gently.

## Steps for any sync change
1. Express the change as a pure function in `src/features/sync/*.ts`. Add tests with explicit numbers.
2. Wire it in `useSync`. Keep the hook thin.
3. Verify: two tabs, same file, event log shows no echo loops.

## Core pieces
- **Clock offset**: ping/pong, keep lowest-RTT of 8 samples, refresh every 30 s. `offset = remoteClock − localClock`.
- **Expected position**: if playing, `pos + (now − (at − offset))/1000 * rate`; else `pos`.
- **Correction**: drift < 0.25 s → rate 1; < 2 s → rate 0.95/1.05; ≥ 2 s → hard seek. Paused: seek if > 0.1 s.
- **Authority**: last action wins via `(seq, from)` ordering; only the controller sends heartbeats (same `seq`).
- **Echo suppression**: set `suppressUntil = performance.now() + SYNC.suppressMs` before programmatic `play/pause/currentTime`, ignore `play/pause/seeked` events until then.
- **Buffering**: `waiting` → broadcast `buffering:true`; partner pauses locally without new `seq`; on `playing` → resume if controller state says playing.
- **Debounce** user seeking (150 ms) so scrubbing doesn't flood the channel.
- **Background tab**: on `visibilitychange` to visible, request/apply fresh state and re-measure clock.

## Gotchas
- `video.play()` returns a Promise and can reject (autoplay policy). First play must come from a user gesture; catch rejections and show "Tap to play".
- `playbackRate` nudges cause slight pitch change under 0.1 s drift thresholds; keep `ignoreBelow` ≥ 0.2 s.
- Never use `setInterval` drift for correctness; use message timestamps. Timers throttle in background tabs.
- Seeking to a not-yet-buffered point triggers `waiting`; don't treat that as drift.

## Tuning table
| Symptom | Adjust |
|---|---|
| Constant tiny speed changes | raise `ignoreBelow` |
| Slow to converge | raise `nudgeRate` (max 0.08) or lower `nudgeBelow` |
| Visible stutter from seeks | raise `nudgeBelow` |
| Reaction timing feels off | lower `heartbeatMs` to 1000 |
