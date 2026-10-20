# PLAN — Duet implementation, phase by phase

Sizes: S (≤ half day), M (1–2 days), L (3+ days). Work one phase at a time. `qa-tester` signs off each phase.

---

## Phase 0 — Scaffold and tooling (S) · owner: ui-designer + qa-tester
**Tasks**
- Vite + React + TS strict, pnpm, ESLint, Prettier, Vitest, Playwright installed.
- Tailwind configured with tokens from `DESIGN.md` (CSS variables).
- Folder structure from `CLAUDE.md`. `src/lib/env.ts` (zod-validated env) and `.env.example`.
- Base `ui/` components: Button, IconButton, Input, Toast, StatusDot.
- CI script: `typecheck && lint && test`.
**Acceptance**
- `pnpm dev` shows a styled placeholder page; `pnpm build` outputs static `dist/`.
- All scripts in `CLAUDE.md` exist (native ones can be stubs until Phase 8).

## Phase 1 — Local player, file picker, fingerprint (M) · owner: sync-engineer
**Tasks**
- `PlayerView` wrapping `<video>`; `FilePickerCard`; `URL.createObjectURL` with cleanup (`revokeObjectURL`).
- Controls per `DESIGN.md`: play/pause, seek with buffered range, volume, fullscreen, keyboard shortcuts.
- `fingerprint(file)` = `{ name, size, duration, hash }` (first+last 256 KB + size, SHA-256).
- Unsupported codec detection: if `video.error` or no video track, show a helpful message with the ffmpeg remux hint (see skill `local-video-files`).
- Optional URL source input (direct MP4/HLS). HLS via `hls.js` only if asked.
**Acceptance**
- Pick a 1080p MP4: plays at native resolution, seek and volume work, keyboard works.
- Fingerprint is identical for the same file picked twice; differs for different files.
- Unit tests: fingerprint determinism, duration-compare helper.

## Phase 2 — Rooms, anonymous auth, presence (M) · owner: realtime-engineer
**Tasks**
- Supabase project + migration from `docs/ARCHITECTURE.md §11`. Anonymous sign-in enabled.
- Lobby: create room (generate code, no ambiguous characters), join by code, display name.
- `useRoom(code)`: subscribe to channel, track presence, expose `{ self, partner, status }`.
- Partner-left and reconnect handling; leaving unsubscribes cleanly.
- Third join attempt is rejected with a friendly message (RLS `member_count < 2`).
**Acceptance**
- Two browsers: A creates, B joins by code; both show each other's name and online dot.
- Close B's tab → A sees "partner left" within ~10 s. Refresh B → rejoins same room.
- A third browser cannot join.

## Phase 3 — Sync engine (L) · owner: sync-engineer
**Tasks**
- Pure modules with tests first: `clock.ts` (offset estimation), `correction.ts` (`expectedPos`, `decideCorrection`), `authority.ts` (seq/accept rules), `protocol.ts` (zod schemas).
- `useSync(videoRef, channel)`: user actions → broadcast; remote → apply with suppression window; heartbeat from controller; 250 ms correction tick while playing.
- Buffering protocol ("Waiting for partner…").
- Media match exchange and mismatch dialog.
- `visibilitychange` re-sync; "Sync now" button; drift indicator in status strip.
- All tunables in `SYNC` config; dev-only overlay showing offset, RTT, drift, seq.
**Acceptance**
- Unit tests cover: offset with symmetric/asymmetric RTT, drift decision table, seq conflict resolution, heartbeat ownership.
- Two tabs, same file: play/pause/seek mirror in < 300 ms perceived; no echo loops (verify with event log).
- Throttle one tab to Slow 3G and seek: other side shows waiting state; both resume together.
- Simultaneous pause/play clicks resolve deterministically to the same final state.

## Phase 4 — Text chat (S–M) · owner: realtime-engineer
**Tasks**
- `useChat`: broadcast, optimistic local append, dedupe by id, auto-scroll, unread badge when chat is hidden.
- Optional persistence: insert into `messages`, load last 100 on join (toggle in config).
- Chat sanitized (render as text, linkify only http/https).
**Acceptance**
- Messages appear on both sides < 300 ms. Refresh restores history (if persistence on).
- Pasting HTML does not render HTML.

## Phase 5 — Video chat (L) · owner: realtime-engineer
**Tasks**
- `useCall`: perfect negotiation per `ARCHITECTURE.md §10` and skill `webrtc-perfect-negotiation`.
- Camera/mic toggles, device selection, permission-denied UX, graceful audio-only.
- STUN + TURN from env; connection state UI; ICE restart on failure.
- `CamTile` components and the mobile floating bubble.
**Acceptance**
- Two devices on **different networks** (one on mobile data) connect; with TURN disabled and symmetric NAT, UI explains the failure and offers retry.
- Mute/camera-off reflect on the other side. No echo with headphones.
- Glare test: both press "Start call" at once → one connection, no errors.

## Phase 6 — Screen share (M) · owner: realtime-engineer
**Tasks**
- Desktop-only button (feature-detect `getDisplayMedia`). Replace/add track without renegotiation storms.
- 1080p30 constraints, 6 Mbps cap, `contentHint = 'motion'`.
- `QualityBadge` from `getStats()`; show actual resolution/fps/bitrate.
- When sharing, switch the room into "stream mode": the local `<video>` sync is paused and the partner sees the shared stream; stopping returns to sync mode.
**Acceptance**
- Share a browser tab with audio: partner hears audio, sees ≥ 720p (1080p if upload allows), badge accurate.
- Button hidden on Android/iOS.

## Phase 7 — UI polish, layouts, subtitles (M) · owner: ui-designer
**Tasks**
- Implement all layouts and states from `DESIGN.md`: desktop, mobile portrait, landscape/theater, floating cam bubble, toasts for partner actions.
- Subtitles: load .srt/.vtt (convert SRT→VTT client-side), size control, local only.
- Accent theme picker (3–5 presets), reduced-motion support, keyboard + ARIA audit.
**Acceptance**
- Manual pass at 360x640, 390x844, 768x1024, 1280x720, 1920x1080; no horizontal scroll, safe areas OK.
- Lighthouse: Accessibility ≥ 90, Performance ≥ 85 on mobile profile.

## Phase 8 — PWA, Android, Windows portable exe (L) · owner: platform-packager
**Tasks**
- PWA: `vite-plugin-pwa`, manifest, icons (192/512 + maskable), offline shell, install prompt UI.
- Android (Capacitor): `@capacitor/core`, `@capacitor/android`; permissions CAMERA, RECORD_AUDIO, MODIFY_AUDIO_SETTINGS; keep-awake plugin; orientation handling; verify file picker + `createObjectURL` playback on a real device; produce a debug APK to sideload.
- Windows (Tauri 2): `src-tauri` config, window defaults (min size 900x600), WebView2 camera/mic permission handling, app icon, `pnpm tauri build --no-bundle` → **portable `duet.exe`**; document the SmartScreen "Run anyway" step in `docs/SHIPPING.md`.
- `docs/SHIPPING.md`: how to build and share each target.
**Acceptance**
- Web deploy live on Vercel/Cloudflare Pages over HTTPS (required for camera/mic).
- APK installs on a physical Android phone; camera, mic, file playback, sync all work.
- `duet.exe` runs by double-click on a clean Windows machine with no install step; camera/mic prompt appears; screen share works.
- iOS: PWA install steps documented and tested on Safari.

## Phase 9 — Hardening (M) · owner: qa-tester
**Tasks**
- Reconnect with exponential backoff and state recovery (re-request sync, re-negotiate call).
- Private Realtime channels with RLS tied to `room_members`.
- Playwright E2E: two contexts with fake media (`--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`): join, sync, chat, call connects.
- Perf pass: bundle analysis, lazy-load call/subtitle code, memory check on long playback (2 h).
- Error boundary + friendly crash screen; log to console only (no telemetry).
**Acceptance**
- `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e` all green.
- 2-hour soak test: drift stays < 1 s for > 99% of the time; no memory growth trend.
- Airplane-mode toggle for 10 s on one device recovers without manual action.

---

## Risk register
| Risk | Mitigation |
|---|---|
| Echo loops in sync | Suppression window + event log test (Phase 3) |
| NAT blocks P2P | TURN from day one of Phase 5 |
| Phone codec limits | Standardize on MP4 H.264/AAC; remux hint |
| Background tab throttling | `visibilitychange` re-sync |
| Free-tier limits | Two users only; messages are tiny; no media through Supabase |
| iOS Safari quirks | Treat iOS as PWA best-effort; test early on a real device |
| Scope creep | Non-goals in `PROMPT.md`; ask before adding features |
