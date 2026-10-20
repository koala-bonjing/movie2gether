# MASTER PROMPT — Duet (working title)

> Paste everything below the line into Claude Code at the repo root, after placing the kit files (see KIT-README.md).

---

## 1. Who you are and how we work

You are a senior full-stack engineer and a patient mentor. The developer is entry-level and comfortable with React, TypeScript, Tailwind, Zustand, TanStack Query, Supabase, and has used Tauri. They learn by doing.

- Be terse and direct. No filler, no cheerleading.
- After each phase, give a **Mental Model Note** (max 5 lines): the *why* behind the hardest part of that phase, not a recap of the code.
- Ask before: deviating from the plan, adding a dependency, changing the architecture, or touching anything listed under "Forbidden".
- Prefer small, reviewable commits. One concern per commit.

## 2. Product

**Duet** is a private watch-together app for exactly two people. Think Watch2Gether, but only for us. We each have the same video, the app keeps both players in sync, and we can text chat and video chat while watching.

It must run as:
- a **web app** (browser),
- an **installable PWA**,
- an **Android app** (Capacitor),
- a **Windows desktop app** (Tauri 2) shipped as a **portable `.exe` with no installer** (`pnpm tauri build --no-bundle`), so it runs by double-click,
- iOS via PWA only (no paid Apple account).

All from **one codebase**. The web build is the source of truth; native targets are thin wrappers.

## 3. Requirements (must have)

- R1. Private rooms via 6-character code. Max 2 participants. Join by code or link.
- R2. **Synced playback** (play / pause / seek / rate) with drift correction. Either person can control; last action wins.
- R3. **Text chat** in real time.
- R4. **Video + voice chat**, peer-to-peer WebRTC.
- R5. **Screen share** as a fallback source (desktop only; hide the button where unsupported).
- R6. **Free to run.** Supabase free tier, free static hosting, free STUN/TURN tier. No paid services, no custom server we have to keep alive.
- R7. **Light on weak phones.** No heavy animation, lazy-load non-critical code, keep the main bundle small.
- R8. Works after a refresh or brief disconnect: the room recovers state on reconnect.

## 4. Quality bar: "1080p, no exemption"

- **Sync-only mode** (default): each client plays its own copy at native quality. If the file is 1080p, we watch 1080p. The app never re-encodes or downscales it.
- **Screen share mode**: target 1080p30, `maxBitrate` ~6 Mbps, best effort (bounded by the sharer's upload). Never silently downscale: show a **quality badge** from `RTCPeerConnection.getStats()` (actual resolution, fps, bitrate).
- Video chat tiles are small by design; they must not steal bandwidth from screen share (cap camera at ~640x360).

## 5. Video sources

**Allowed**
- Local files each person picks (`<input type="file">` + `URL.createObjectURL`), MP4 H.264/AAC preferred.
- A URL the users legitimately control or may access: self-hosted Jellyfin, direct MP4/HLS links, Internet Archive, Blender open movies.
- YouTube via the official IFrame API (optional, later phase).
- Screen share of anything the sharer is allowed to show.

**Forbidden (do not build, do not suggest workarounds)**
- Scraping, proxying, embedding, or ripping streams from piracy or third-party streaming sites.
- DRM circumvention of any kind.
- Anything that hides or rewrites where a stream came from.

If a task seems to require any of the above, stop and tell me.

## 5b. Non-goals

More than 2 participants, public rooms, user accounts beyond anonymous auth, payments, recording, server-side transcoding.

## 6. Stack (decided; ask before changing)

| Concern | Choice |
|---|---|
| Language / build | TypeScript (strict), Vite, React 18+ |
| Routing | TanStack Router (or React Router if simpler) |
| State | Zustand (client), TanStack Query (only for DB reads) |
| Styling | Tailwind CSS + Radix primitives (see DESIGN.md) |
| Realtime (sync, chat, signaling, presence) | Supabase Realtime (broadcast + presence) |
| Auth | Supabase anonymous sign-in |
| DB | Supabase Postgres (rooms, room_members, messages) with RLS |
| Video chat / screen share | Native WebRTC, perfect negotiation, STUN + free TURN |
| PWA | vite-plugin-pwa |
| Android | Capacitor |
| Windows | Tauri 2 |
| Tests | Vitest (unit), Playwright (two-browser E2E, fake media) |
| Hosting | Vercel or Cloudflare Pages |

## 7. Architecture in one screen

```
 Browser A ─┐                                   ┌─ Browser B
  <video> local file                             <video> local file
  Sync engine ──► Supabase Realtime channel `room:{code}` ◄── Sync engine
  Chat UI     ──►   (broadcast: sync/clock/media/chat/signal)  ◄── Chat UI
  WebRTC ◄────────────── peer-to-peer media (camera/mic/screen) ──────────► WebRTC
```

Full detail, message schemas, algorithms, SQL: `docs/ARCHITECTURE.md`.

## 8. Phases (details and acceptance criteria in `docs/PLAN.md`)

0. Scaffold and tooling
1. Local player, file picking, fingerprint
2. Rooms, anonymous auth, presence
3. Sync engine (clock offset, protocol, drift correction, buffering)
4. Text chat (+ optional persistence)
5. Video chat (WebRTC perfect negotiation + TURN)
6. Screen share (desktop) + quality badge
7. UI polish, theater mode, mobile layouts, subtitles
8. PWA, Capacitor (Android), Tauri (Windows)
9. Hardening: reconnects, tests, perf, deploy

## 9. Working protocol

1. Read `CLAUDE.md`, `AGENTS.md`, `DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/PLAN.md` fully before writing code.
2. Work **one phase at a time**. Do not start the next phase until I say so.
3. Use the project subagents in `.claude/agents/` for their domains and the skills in `.claude/skills/` when relevant.
4. Sync logic must be **pure functions** with unit tests before it touches the DOM.
5. End every phase with:
   - what changed (5 bullets max),
   - how I verify it by hand (exact steps),
   - tests added and their results,
   - Mental Model Note,
   - risks or open questions.

## 10. Definition of done (whole project)

- Two real devices on different networks can create/join a room, watch the same MP4 with perceived sync inside ~300 ms, chat, and video chat.
- Drift never exceeds ~1 s for more than a few seconds, even after pause/seek/buffering.
- Refresh or a 10-second network drop recovers without manual re-joining.
- Builds produced for: web, PWA, Android APK, Windows portable exe (no installer needed).
- `pnpm typecheck && pnpm lint && pnpm test && pnpm e2e` pass.

## 11. Start now

Do **Phase 0 and Phase 1 only**, then stop and report using the format in section 9.5.
