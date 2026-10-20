---
name: supabase-room-channel
description: Duet's Supabase layer — anonymous auth, room codes, Realtime broadcast/presence channel, RLS for 2-person rooms, optional chat persistence. Use when touching src/lib/supabase, src/features/lobby, or src/features/room.
---

# supabase-room-channel

## Mental model
Postgres answers "who is allowed in this room". Realtime broadcast answers "what is happening right now". Never mix: nothing time-critical goes through the database.

## Steps
1. Anonymous sign-in on first load: `supabase.auth.signInAnonymously()`; persist session (Supabase does this).
2. **Create room**: generate code from alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O/1/I), insert into `rooms` then `room_members`. On unique violation, regenerate.
3. **Join room**: upsert into `room_members` (RLS enforces max 2). Handle the "room full" error with a friendly message.
4. **Subscribe**: `supabase.channel('room:'+code, { config: { broadcast: { self: false }, presence: { key: userId } } })`, register handlers for `sync`, `clock`, `media`, `chat`, `signal`, then `.subscribe(cb)`; `track()` presence only after `SUBSCRIBED`.
5. **Cleanup**: `channel.unsubscribe()` and `supabase.removeChannel(channel)` on leave/unmount (watch React StrictMode double-mount).

## Reconnect
Listen to channel status (`CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED`). Retry with backoff (1 s, 2 s, 4 s, max 15 s). After resubscribe: re-track presence, re-send `media`, request sync state, re-measure clock.

## Validation
Parse every payload with zod schemas from `src/features/sync/protocol.ts`. Drop and `console.warn` on failure.

## Free-tier hygiene
- Broadcast payloads are tiny; keep heartbeats ≥ 1 s.
- Don't write to Postgres per sync event. Only chat (optional) and membership.
- Optional: purge rooms older than 7 days.

## Hardening (Phase 9)
Use **private channels** with `realtime.messages` RLS policies referencing `is_member(room_code)`, so only members can publish/subscribe.

## Gotchas
- `broadcast.self: false` means you never receive your own messages; update local state optimistically.
- Presence `sync` fires frequently; diff before updating React state.
- Don't put the anon key's power in the client: RLS is the security boundary, test it with a third user.
