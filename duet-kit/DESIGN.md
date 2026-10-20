# DESIGN.md — Duet

## Feel
A cozy private cinema for two. Dark, warm, calm. The video is the star; everything else gets out of the way. Light enough to run on a weak phone.

## Principles
1. **Video first.** Controls auto-hide; chrome never covers the picture unless summoned.
2. **Two people, not a platform.** No lists, no feeds, no clutter. The partner is always visible (presence dot + camera tile).
3. **State is never a mystery.** Connecting, partner left, buffering, out of sync, file mismatch: each has a visible, friendly state.
4. **Thumb-friendly.** Mobile is a first-class layout, not an afterthought. Min touch target 44x44 px.
5. **Cheap to render.** CSS transitions only, no heavy blur/shadow stacks, no animation libraries.

## Tokens (CSS variables; accent is user-themable)
```css
:root {
  --bg:        #0F0D12;
  --surface:   #1A1720;
  --surface-2: #241F2C;
  --border:    #332C3D;
  --text:      #F4EFF6;
  --muted:     #A79FB3;
  --accent:    #E8A0BF;   /* default rose; theme picker swaps this */
  --accent-2:  #F2C57C;   /* warm amber, highlights */
  --success:   #7BD3A8;
  --warn:      #F2C57C;
  --danger:    #F08A8A;

  --radius-sm: 8px; --radius-md: 14px; --radius-lg: 22px; --radius-full: 999px;
  --space: 4px;                       /* scale: 1,2,3,4,6,8,12,16 x --space */
  --font: "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --fs-xs: 12px; --fs-sm: 14px; --fs-md: 16px; --fs-lg: 20px; --fs-xl: 28px;
  --ease: cubic-bezier(.2,.8,.2,1); --dur-fast: 120ms; --dur: 200ms;
}
```
Contrast: text on surface >= 7:1, muted on surface >= 4.5:1, accent on bg >= 4.5:1. Verify when the accent changes.

## Screens

### Lobby
- App name, one sentence of copy, two big actions: **Create room** and **Join with code**.
- Display name field (remembered). Nothing else.
- Joining: 6 boxes OTP-style input, auto-uppercase, paste-friendly.

### Room (desktop >= 1024 px)
```
┌──────────────────────────────────────┬──────────────┐
│                                      │ partner cam  │
│            VIDEO PLAYER              │ (self cam sm)│
│                                      ├──────────────┤
│  [controls bar, auto-hide]           │ chat         │
│                                      │              │
├──────────────────────────────────────┴──────────────┤
│ status strip: sync ● 120ms drift · 1080p · partner ● │
└──────────────────────────────────────────────────────┘
```
### Room (tablet/mobile portrait)
- Player on top (16:9), under it a tab bar: **Chat | Call**. Partner cam as a floating draggable bubble over the player.
### Room (mobile landscape / theater mode)
- Player fullscreen. Chat and cam are overlays: swipe from right for chat, tap bubble to enlarge. Messages show as transient toasts for 4 s.

## Components (build in `src/ui/`)
Button, IconButton, Input, OtpInput, Tabs, Tooltip, Toast, Dialog, Switch, Slider (seek + volume), Badge, StatusDot, Avatar (initial + color), CamTile, ChatBubble, ChatInput, PlayerControls, FilePickerCard, QualityBadge, DriftIndicator.
Use Radix primitives for Dialog, Tabs, Tooltip, Switch, Slider. Style with Tailwind using the tokens above.

## Player controls
Play/pause, seek bar with buffered range, time, volume, subtitles toggle, fullscreen, layout toggle, "sync now" button (hard-resyncs to partner), partner name. Keyboard: Space, ← → (5 s), F, M, C (chat).
Seek and play/pause actions show a tiny toast: "Maya paused" / "Sonny skipped to 41:12" using the display names.

## States (all required)
| State | UI |
|---|---|
| Creating/joining | Skeleton + "Setting up your room…" |
| Waiting for partner | Share code + copy/share-link button, gentle pulse on presence dot |
| Partner left | Banner "Partner left. Playback paused." + auto-pause |
| Partner buffering | "Waiting for partner…" pill, local pause until ready |
| Drift > 1 s | Drift indicator turns amber, auto-correct runs; tap = Sync now |
| File mismatch | Dialog: "Your files look different (duration/size). Sync may drift." [Continue] |
| Call connecting | Cam tile shows spinner; falls back to avatar if no video |
| Call failed | Inline retry + hint about TURN/network |
| Mic/cam denied | Explain how to re-enable, keep chat + sync working |
| Offline | Top banner, auto-retry with backoff |

## Motion
- Controls fade 200 ms. Toasts slide 120 ms. Nothing loops except the waiting pulse.
- Respect `prefers-reduced-motion`: disable the pulse and slides.

## Accessibility
- Full keyboard operation, visible focus ring (2 px accent).
- ARIA labels on all icon buttons; live region for chat and sync toasts.
- Captions: support user-loaded .srt/.vtt; size adjustable.
- Don't rely on color alone for state (icon + text with every color).

## Copy tone
Warm, short, a little playful, never cutesy to the point of confusion. Examples: "Your room is ready.", "Waiting for your person…", "You two are in sync."

## Responsive checklist
Test at 360x640, 390x844, 768x1024, 1280x720, 1920x1080. No horizontal scroll. Safe-area insets respected (`env(safe-area-inset-*)`). Player never overflows in landscape.

## Do not
Glassmorphism stacks, large drop shadows, autoplaying sounds, modal on top of modal, tiny tap targets, text over video without a scrim.
