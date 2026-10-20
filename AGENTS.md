# AGENTS.md — Duet

Instructions for any coding agent working in this repo (Claude Code, Codex, etc.). `CLAUDE.md` has the full detail; this file is the short version plus the agent roster.

## Rules for every agent
- Read `CLAUDE.md`, `DESIGN.md`, `docs/ARCHITECTURE.md`, `docs/PLAN.md` before coding.
- One phase at a time. Stop at the end of each phase and report.
- Pure logic gets unit tests first. Validate all realtime payloads with zod.
- Forbidden: scraping/embedding piracy or third-party streaming sites, DRM circumvention, unrequested dependencies, always-on servers, trackers.
- Terse output. End phases with a Mental Model Note (max 5 lines).

## Roster (Claude Code subagents live in `.claude/agents/`)

| Agent | Owns | Phases |
|---|---|---|
| `sync-engineer` | `features/sync`, `features/player`, clock + drift math | 1, 3 |
| `realtime-engineer` | Supabase channel, presence, chat, WebRTC, screen share | 2, 4, 5, 6 |
| `ui-designer` | `ui/`, layouts, `DESIGN.md` compliance, a11y | 0, 7 |
| `platform-packager` | PWA, Capacitor, Tauri, builds, permissions | 8 |
| `qa-tester` | Vitest, Playwright, manual test scripts, perf checks | all, esp. 9 |

## Handoffs
- `sync-engineer` → `qa-tester`: pure functions + test vectors before DOM wiring.
- `realtime-engineer` → `ui-designer`: stable hook APIs (`useRoom`, `useChat`, `useCall`) before UI is built on them.
- `ui-designer` → `platform-packager`: responsive layouts verified at 360 px width before packaging.
- `qa-tester` signs off each phase's acceptance criteria in `docs/PLAN.md`.

## Skills (`.claude/skills/`)
`sync-engine`, `webrtc-perfect-negotiation`, `supabase-room-channel`, `cross-platform-packaging`, `local-video-files`.
