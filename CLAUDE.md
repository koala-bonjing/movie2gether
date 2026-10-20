# CLAUDE.md — Duet

Private two-person watch-together app. Web + PWA + Android (Capacitor) + Windows (Tauri) from one Vite/React codebase.

## Read first
- `DESIGN.md` — visual and UX rules
- `docs/ARCHITECTURE.md` — protocols, algorithms, schema
- `docs/PLAN.md` — phases and acceptance criteria
- `AGENTS.md` — agent roster and handoffs

## Commands
```
pnpm dev            # web dev server
pnpm build          # production web build (static, dist/)
pnpm typecheck
pnpm lint
pnpm test           # vitest
pnpm e2e            # playwright, two browser contexts, fake media
pnpm cap:sync       # build + npx cap sync
pnpm cap:android    # open Android Studio
pnpm tauri dev      # desktop dev
pnpm tauri build --no-bundle   # portable Windows exe at src-tauri/target/release/ (no installer)
```

## Structure
```
src/
  app/            routes, providers
  features/
    lobby/        create/join room
    room/         room shell, layout modes
    player/       <video> wrapper, file picker, fingerprint, subtitles
    sync/         protocol types, clock, correction (PURE), hook
    chat/
    call/         WebRTC, perfect negotiation, getStats badge
  lib/            supabase client, env, utils
  ui/             design-system components (see DESIGN.md)
  stores/         zustand stores
src-tauri/        desktop wrapper
android/          capacitor android project
supabase/migrations/
docs/
.claude/agents  .claude/skills
```

## Conventions
- TypeScript strict. No `any` without a comment explaining why.
- Feature folders own their code. Cross-feature imports go through each feature's `index.ts`.
- Pure logic (sync math, clock offset, fingerprint compare, message parsing) lives in plain `.ts` files with unit tests. React hooks are thin wrappers.
- Validate every incoming realtime payload with `zod` before using it. Never trust the channel.
- No `localStorage` for anything sensitive. Store only: display name, last room code, UI prefs.
- Env via `import.meta.env.VITE_*`, typed in `src/lib/env.ts`, documented in `.env.example`.

## Sync invariants (never break these)
1. Programmatic `play/pause/seek` must not re-broadcast (use the suppression window, see skill `sync-engine`).
2. Remote action wins only if `(seq, from)` is lexicographically greater than the last accepted.
3. Only the last controller sends heartbeats; the other side only corrects.
4. Never hard-seek for drift under `SYNC.nudgeBelow`; use `playbackRate` nudging.
5. Compare file fingerprints on join; warn on mismatch, never block.
6. All sync tunables live in one `SYNC` config object.

## Forbidden
- No scraping/proxying/embedding of piracy or third-party streaming sites, no DRM circumvention.
- No new runtime dependency without asking.
- No server we must host and keep alive.
- No analytics/trackers.

## Working style
- Terse and direct. No filler.
- End each phase with a **Mental Model Note** (max 5 lines, the *why*).
- Ask before deviating from `docs/PLAN.md`.
- Small commits, conventional commit messages (`feat(sync): ...`).

## Definition of done for any task
Typecheck, lint, unit tests pass; manual verification steps written down; no TODOs left silently.
