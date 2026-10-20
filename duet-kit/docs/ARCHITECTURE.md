# ARCHITECTURE — Duet

## 1. Mental model

Two independent players + a tiny chat of "what I just did" messages. We never move video between peers in the default mode. We move **timestamps**.

```
 A: <video> ──events──► sync engine ──► Realtime channel ──► sync engine ──► <video> :B
                              ▲  clock offset + drift correction  ▲
 A: camera/mic ◄══════════ WebRTC (peer-to-peer) ═══════════► camera/mic :B
```

Supabase Realtime carries **small JSON** (sync, chat, signaling, presence). WebRTC carries **media**. Postgres stores rooms, membership, and optional chat history.

## 2. Channel

One channel per room: `room:{CODE}`.
```ts
const channel = supabase.channel(`room:${code}`, {
  config: { broadcast: { self: false, ack: false }, presence: { key: userId } },
});
```
Broadcast events: `sync`, `clock`, `media`, `chat`, `signal`. Presence payload: `{ userId, name, joinedAt, canScreenShare }`.

MVP: public channel + unguessable code. Hardening (Phase 9): private channel with `realtime.messages` RLS tied to `room_members`.

## 3. Message schemas (validate with zod)

```ts
type SyncMsg = {
  seq: number;          // Lamport-style counter
  from: string;         // userId
  playing: boolean;
  pos: number;          // seconds, at time `at`
  rate: number;         // playbackRate, normally 1
  at: number;           // sender clock, ms since epoch
  heartbeat?: boolean;  // true = periodic re-send, same seq, no new user action
};
type ClockMsg =
  | { kind: 'ping'; id: string; from: string; t0: number }
  | { kind: 'pong'; id: string; from: string; t0: number; t1: number };
type MediaMsg = { from: string; name: string; size: number; duration: number; hash: string };
type BufferMsg = { from: string; buffering: boolean };       // sent on `sync` channel event with kind
type ChatMsg  = { id: string; from: string; text: string; at: number };
type SignalMsg = { from: string; to: string;
  data: { type: 'description'; description: RTCSessionDescriptionInit }
      | { type: 'candidate'; candidate: RTCIceCandidateInit | null } };
```

## 4. Clock offset (so "sent at" means something)

Device clocks differ by seconds. Estimate the offset with a mini-NTP over the channel:
1. A sends `ping {t0}` (A's clock). B replies `pong {t0, t1}` where `t1` = B's clock on receipt.
2. A receives at `t2`. `rtt = t2 - t0`. `offset(B−A) = t1 - (t0 + rtt/2)`.
3. Take 8 samples on join and every 30 s; **keep the sample with the lowest RTT**; smooth lightly (EMA 0.2).

```ts
export function expectedPos(s: SyncMsg, offsetRemoteMinusLocal: number, nowLocal: number): number {
  if (!s.playing) return s.pos;
  const sentAtLocal = s.at - offsetRemoteMinusLocal;
  return s.pos + ((nowLocal - sentAtLocal) / 1000) * s.rate;
}
```

## 5. Drift correction (pure, unit-tested)

```ts
export const SYNC = {
  ignoreBelow: 0.25,   // s
  nudgeBelow: 2.0,     // s
  nudgeRate: 0.05,     // 1 ± 5%
  heartbeatMs: 2000,
  suppressMs: 400,     // ignore our own programmatic events
  pausedSeekTolerance: 0.1,
};

export type Correction =
  | { kind: 'none' }
  | { kind: 'rate'; rate: number }
  | { kind: 'seek'; to: number };

export function decideCorrection(
  local: number, expected: number, playing: boolean, cfg = SYNC,
): Correction {
  const drift = local - expected;            // + means we're ahead
  const a = Math.abs(drift);
  if (!playing) return a > cfg.pausedSeekTolerance ? { kind: 'seek', to: expected } : { kind: 'none' };
  if (a < cfg.ignoreBelow) return { kind: 'rate', rate: 1 };
  if (a < cfg.nudgeBelow)  return { kind: 'rate', rate: drift > 0 ? 1 - cfg.nudgeRate : 1 + cfg.nudgeRate };
  return { kind: 'seek', to: expected };
}
```

## 6. Conflict and authority

No host. **Last action wins.**
- On a local user action: `seq = max(localSeq, lastAcceptedSeq) + 1`, broadcast, become the *controller*.
- Accept a remote `sync` if `(seq, from) > (lastAcceptedSeq, lastAcceptedFrom)` lexicographically.
- Only the controller sends heartbeats (same `seq`, `heartbeat: true`). Non-controllers only apply corrections.
- A new join: the joiner requests state (`sync` with `request: true` variant or presence-triggered) and the existing peer replies with a full `sync`.

## 7. Echo suppression

When the engine calls `video.play()/pause()/currentTime=`, the browser fires `play/pause/seeked` events. Those must not be rebroadcast.
```ts
let suppressUntil = 0;
function applyRemote(fn: () => void) { suppressUntil = performance.now() + SYNC.suppressMs; fn(); }
video.addEventListener('pause', () => { if (performance.now() < suppressUntil) return; broadcast(); });
```

## 8. Buffering

On `waiting`/`stalled`: broadcast `buffering: true`. Partner pauses locally ("Waiting for partner…") without sending a new `seq`. On `canplay`/`playing`: broadcast `buffering: false`; both resume if the controller state says `playing`.

## 9. Media match check

On file selection compute `{ name, size, duration, hash }` where `hash` = SHA-256 of the first 256 KB + last 256 KB + size (cheap, stable). Exchange via `media`. If `|durationA - durationB| > 1 s` or hash differs → mismatch dialog (non-blocking).

## 10. WebRTC (video chat + screen share)

- One `RTCPeerConnection`, **perfect negotiation**, polite peer = `myId < peerId`.
- Camera/mic: `getUserMedia({ video: { width: 640, height: 360, frameRate: 24 }, audio: { echoCancellation, noiseSuppression } })`.
- Screen share (desktop only): `getDisplayMedia({ video: { width: 1920, height: 1080, frameRate: 30 }, audio: true })`, then `sender.setParameters({ encodings: [{ maxBitrate: 6_000_000 }] })`, `contentHint = 'motion'`.
- ICE: STUN + TURN from env (`VITE_STUN_URLS`, `VITE_TURN_URL`, `VITE_TURN_USER`, `VITE_TURN_CRED`).
- Quality badge from `getStats()` every 2 s (`frameWidth`, `frameHeight`, `framesPerSecond`, `availableOutgoingBitrate`).
- Signaling goes over the `signal` broadcast event. Trickle ICE.

## 11. Database (Supabase)

```sql
create table rooms (
  code text primary key check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now()
);
create table room_members (
  room_code text not null references rooms(code) on delete cascade,
  user_id uuid not null default auth.uid(),
  display_name text not null check (char_length(display_name) between 1 and 40),
  joined_at timestamptz not null default now(),
  primary key (room_code, user_id)
);
create table messages (
  id uuid primary key default gen_random_uuid(),
  room_code text not null references rooms(code) on delete cascade,
  user_id uuid not null default auth.uid(),
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
create index on messages (room_code, created_at);

create function is_member(code text) returns boolean
language sql security definer set search_path = public as $$
  select exists (select 1 from room_members where room_code = code and user_id = auth.uid());
$$;
create function member_count(code text) returns int
language sql security definer set search_path = public as $$
  select count(*)::int from room_members where room_code = code;
$$;

alter table rooms enable row level security;
alter table room_members enable row level security;
alter table messages enable row level security;

create policy rooms_select  on rooms for select to authenticated using (true);
create policy rooms_insert  on rooms for insert to authenticated with check (created_by = auth.uid());
create policy members_select on room_members for select to authenticated using (is_member(room_code));
create policy members_insert on room_members for insert to authenticated
  with check (user_id = auth.uid() and member_count(room_code) < 2);
create policy messages_select on messages for select to authenticated using (is_member(room_code));
create policy messages_insert on messages for insert to authenticated
  with check (user_id = auth.uid() and is_member(room_code));
```
Optional cleanup: scheduled delete of rooms older than 7 days (pg_cron if available on the free tier, else skip).

## 12. Platform matrix

| Capability | Web | PWA | Android (Capacitor) | Windows (Tauri, portable exe) | iOS PWA |
|---|---|---|---|---|---|
| Local file playback (MP4 H.264/AAC) | ✅ | ✅ | ✅ | ✅ | ✅ (Safari limits) |
| MKV / HEVC | ⚠ browser-dependent | ⚠ | ❌ mostly | ⚠ WebView2 codecs | ❌ |
| Camera/mic | ✅ | ✅ | ✅ (permissions) | ✅ | ✅ |
| Screen share send | ✅ desktop | ✅ desktop | ❌ | ✅ | ❌ |
| Keep screen awake | Wake Lock API | Wake Lock | keep-awake plugin | OS | limited |
Hide unsupported features; never show a dead button.

## 13. Env

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_STUN_URLS=stun:stun.l.google.com:19302
VITE_TURN_URL=
VITE_TURN_USER=
VITE_TURN_CRED=
```

## 14. Failure modes to design for
Clock skew, echo loops, one side buffering, tab throttling in background (timers slow down: use `visibilitychange` to re-sync on return), reconnect storms, TURN unavailable, mic/cam permission denial, file mismatch, user seeking repeatedly (debounce 150 ms), Safari autoplay rules (first play must be a user gesture).
