import { useEffect, useState, type ReactNode } from 'react';
import { IconButton } from '../../ui';
import { formatTime } from './media';

const SKIP_S = 5;
const EVENTS = ['play', 'pause', 'timeupdate', 'durationchange', 'progress', 'volumechange', 'seeked'];

const svg = (children: ReactNode) => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
    {children}
  </svg>
);
const line = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' } as const;
const icons = {
  play: svg(<path d="M8 5v14l11-7z" />),
  pause: svg(<path d="M6 5h4v14H6zM14 5h4v14h-4z" />),
  volume: svg(
    <>
      <path d="M3 9v6h4l5 5V4L7 9z" />
      <path d="M16 8.5a5 5 0 0 1 0 7" {...line} />
    </>,
  ),
  muted: svg(
    <>
      <path d="M3 9v6h4l5 5V4L7 9z" />
      <path d="m16 9 6 6m0-6-6 6" {...line} />
    </>,
  ),
  fullscreen: svg(<path d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5" {...line} />),
};

function snapshot(v: HTMLVideoElement) {
  let buffered = 0;
  for (let i = 0; i < v.buffered.length; i++) {
    if (v.buffered.start(i) <= v.currentTime && v.currentTime <= v.buffered.end(i)) buffered = v.buffered.end(i);
  }
  const duration = Number.isFinite(v.duration) ? v.duration : 0;
  return { playing: !v.paused, time: v.currentTime, duration, buffered, volume: v.volume, muted: v.muted };
}

// play() rejects with AbortError when a pause/new source interrupts it; that is expected, not a failure.
const toggle = (v: HTMLVideoElement) => (v.paused ? void v.play().catch(() => {}) : v.pause());
const seek = (v: HTMLVideoElement, t: number) => {
  v.currentTime = Math.min(Math.max(t, 0), v.duration || 0);
};
const toggleMute = (v: HTMLVideoElement) => {
  v.muted = !v.muted;
};
const setVolume = (v: HTMLVideoElement, x: number) => {
  v.volume = x;
  v.muted = x === 0;
};
const isFullscreenSupported = () =>
  typeof document !== 'undefined' &&
  (document.fullscreenEnabled ||
    'webkitFullscreenEnabled' in document ||
    'webkitEnterFullscreen' in HTMLVideoElement.prototype);

const toggleFullscreen = (container: HTMLElement, video: HTMLVideoElement) => {
  const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
  if (document.fullscreenElement || doc.webkitFullscreenElement) {
    if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
    else if (doc.webkitExitFullscreen) void doc.webkitExitFullscreen();
  } else {
    if (container.requestFullscreen) void container.requestFullscreen().catch(() => {});
    else if ('webkitRequestFullscreen' in container) {
      void (container as HTMLElement & { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
    } else if ('webkitEnterFullscreen' in video) {
      (video as HTMLVideoElement & { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
    }
  }
};

type Props = { video: HTMLVideoElement; container: HTMLElement; onToggleChat?: () => void };

export function PlayerControls({ video, container, onToggleChat }: Props) {
  const [s, setS] = useState(() => snapshot(video));
  const [active, setActive] = useState(true);

  useEffect(() => {
    const update = () => setS(snapshot(video));
    EVENTS.forEach((e) => video.addEventListener(e, update));
    return () => EVENTS.forEach((e) => video.removeEventListener(e, update));
  }, [video]);

  // Auto-hide controls 2.5s after pointer stops moving while video is playing (DESIGN.md: video first).
  useEffect(() => {
    if (!s.playing) return;
    let timer: ReturnType<typeof setTimeout>;
    const show = () => {
      setActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setActive(false), 2500);
    };

    timer = setTimeout(() => setActive(false), 2500);
    const el = container;
    el.addEventListener('pointermove', show);
    el.addEventListener('pointerdown', show);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('pointermove', show);
      el.removeEventListener('pointerdown', show);
    };
  }, [s.playing, container]);

  const visible = !s.playing || active;

  // Keyboard shortcuts (DESIGN.md): Space, ← → (5s), F, M, C (chat).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const el = e.target instanceof HTMLElement ? e.target : null;
      if (el?.isContentEditable || el?.matches('textarea, select, input:not([type=range])')) return;

      const onVolume = el?.matches('input[type=range]') && el.getAttribute('aria-label') === 'Volume';
      const k = e.key.toLowerCase();

      if (k === ' ' && !el?.matches('button')) toggle(video);
      else if (k === 'arrowleft' && !onVolume) seek(video, video.currentTime - SKIP_S);
      else if (k === 'arrowright' && !onVolume) seek(video, video.currentTime + SKIP_S);
      else if (k === 'm') toggleMute(video);
      else if (k === 'f' && isFullscreenSupported()) toggleFullscreen(container, video);
      else if (k === 'c') onToggleChat?.();
      else return;

      setActive(true);
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [video, container, onToggleChat]);

  const pct = (x: number) => `${s.duration ? (x / s.duration) * 100 : 0}%`;

  const onBackdropClick = () => {
    // If playing and controls were hidden, reveal them first rather than abruptly pausing.
    if (s.playing && !visible) {
      setActive(true);
    } else {
      toggle(video);
    }
  };

  return (
    <>
      {/* Click anywhere on the picture to summon controls or play/pause. */}
      <div className="absolute inset-0" onClick={onBackdropClick} />
      <div
        className={`absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/80 to-transparent px-2 pt-8 transition-opacity duration-200 ${
          visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <IconButton label={s.playing ? 'Pause' : 'Play'} onClick={() => toggle(video)}>
          {s.playing ? icons.pause : icons.play}
        </IconButton>
        <span className="shrink-0 px-1 text-xs tabular-nums text-text">
          {formatTime(s.time)} / {formatTime(s.duration)}
        </span>
        <div className="relative mx-2 min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
            <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: pct(s.buffered) }} />
            <div className="absolute inset-y-0 left-0 bg-accent" style={{ width: pct(s.time) }} />
          </div>
          <input
            type="range"
            aria-label="Seek"
            aria-valuetext={formatTime(s.time)}
            className="range relative block w-full"
            min={0}
            max={s.duration}
            step="any"
            value={s.time}
            onChange={(e) => seek(video, Number(e.target.value))}
          />
        </div>
        <IconButton label={s.muted ? 'Unmute' : 'Mute'} onClick={() => toggleMute(video)}>
          {s.muted || s.volume === 0 ? icons.muted : icons.volume}
        </IconButton>
        <input
          type="range"
          aria-label="Volume"
          className="hidden w-20 accent-accent sm:block"
          min={0}
          max={1}
          step={0.05}
          value={s.muted ? 0 : s.volume}
          onChange={(e) => setVolume(video, Number(e.target.value))}
        />
        {isFullscreenSupported() && (
          <IconButton label="Fullscreen" onClick={() => toggleFullscreen(container, video)}>
            {icons.fullscreen}
          </IconButton>
        )}
      </div>
    </>
  );
}
