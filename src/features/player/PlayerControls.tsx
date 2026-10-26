import { useEffect, useState, useRef, type ReactNode } from 'react';
import { IconButton, QualityBadge } from '../../ui';
import type { VideoStats } from '../call/webrtc';
import { formatTime } from './media';
import { SUBTITLE_FONT_SIZES, type SubtitleFontSize } from './subtitleTypes';

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
  subtitles: svg(
    <path d="M19 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm-8 7H9.5v-.5h-2v3h2V13H11v1a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1Zm7 0h-1.5v-.5h-2v3h2V13H18v1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v1Z" />
  ),
  theater: svg(
    <path d="M19 6H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Zm0 10H5V8h14v8Z" />
  ),
  sync: svg(
    <path d="M12 4V1L8 5l4 4V6a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8Z" />
  ),
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

export const toggleFullscreen = (container: HTMLElement, video?: HTMLVideoElement | null) => {
  const doc = document as Document & { webkitFullscreenElement?: Element; webkitExitFullscreen?: () => Promise<void> };
  const orientation = typeof screen !== 'undefined' && 'orientation' in screen ? screen.orientation : null;

  if (document.fullscreenElement || doc.webkitFullscreenElement) {
    if (orientation && typeof (orientation as unknown as { unlock?: () => void }).unlock === 'function') {
      try {
        (orientation as unknown as { unlock: () => void }).unlock();
      } catch {
        // ignore
      }
    }
    if (document.exitFullscreen) void document.exitFullscreen().catch(() => {});
    else if (doc.webkitExitFullscreen) void doc.webkitExitFullscreen();
  } else {
    if (container.requestFullscreen) {
      void container
        .requestFullscreen()
        .then(() => {
          if (orientation && typeof (orientation as unknown as { lock?: (o: string) => Promise<void> }).lock === 'function') {
            (orientation as unknown as { lock: (o: string) => Promise<void> }).lock('landscape').catch(() => {});
          }
        })
        .catch(() => {});
    } else if ('webkitRequestFullscreen' in container) {
      void (container as HTMLElement & { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
    } else if (video && 'webkitEnterFullscreen' in video) {
      (video as HTMLVideoElement & { webkitEnterFullscreen: () => void }).webkitEnterFullscreen();
    }
  }
};

export function resolveBackdropTap({
  playing,
  visible,
  justRevealedByPointerDown,
}: {
  playing: boolean;
  visible: boolean;
  justRevealedByPointerDown: boolean;
}): 'reveal' | 'toggle' {
  if (playing && (!visible || justRevealedByPointerDown)) {
    return 'reveal';
  }
  return 'toggle';
}

export type PlayerControlsProps = {
  video: HTMLVideoElement;
  container: HTMLElement;
  onToggleChat?: () => void;
  isStream?: boolean;
  stats?: VideoStats | null;
  // Subtitles
  hasSubtitles?: boolean;
  subtitlesVisible?: boolean;
  onToggleSubtitles?: () => void;
  subtitleFontSize?: SubtitleFontSize;
  onChangeSubtitleFontSize?: (size: SubtitleFontSize) => void;
  onLoadSubtitleFile?: (file: File) => void;
  onClearSubtitles?: () => void;
  subtitleLabel?: string | null;
  // Theater / Fullscreen
  isTheater?: boolean;
  onToggleTheater?: () => void;
  // Sync now
  onSyncNow?: () => void;
  // Screen share
  onShareScreen?: () => void;
  isScreenSharing?: boolean;
};

export function PlayerControls({
  video,
  container,
  onToggleChat,
  isStream = false,
  stats,
  hasSubtitles = false,
  subtitlesVisible = true,
  onToggleSubtitles,
  subtitleFontSize = 'md',
  onChangeSubtitleFontSize,
  onLoadSubtitleFile,
  onClearSubtitles,
  subtitleLabel,
  isTheater = false,
  onToggleTheater,
  onSyncNow,
  onShareScreen,
  isScreenSharing = false,
}: PlayerControlsProps) {
  const [s, setS] = useState(() => snapshot(video));
  const [active, setActive] = useState(true);
  const [isSpinning, setIsSpinning] = useState(false);
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPos, setHoverPos] = useState<number>(0);
  const subMenuRef = useRef<HTMLDivElement>(null);
  const subFileInputRef = useRef<HTMLInputElement>(null);

  const visible = !s.playing || active || showSubMenu;
  const visibleRef = useRef(visible);
  visibleRef.current = visible;
  const justRevealedRef = useRef(false);

  useEffect(() => {
    const update = () => setS(snapshot(video));
    EVENTS.forEach((e) => video.addEventListener(e, update));
    return () => EVENTS.forEach((e) => video.removeEventListener(e, update));
  }, [video]);

  // Unlock orientation if fullscreen is exited via Escape or Android system back gesture
  useEffect(() => {
    const onFullscreenChange = () => {
      const doc = document as Document & { webkitFullscreenElement?: Element };
      if (!document.fullscreenElement && !doc.webkitFullscreenElement) {
        const orientation = typeof screen !== 'undefined' && 'orientation' in screen ? screen.orientation : null;
        if (orientation && typeof (orientation as unknown as { unlock?: () => void }).unlock === 'function') {
          try {
            (orientation as unknown as { unlock: () => void }).unlock();
          } catch {
            // ignore
          }
        }
      }
    };
    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange);
  }, []);

  // Auto-hide controls 2.5s after pointer stops moving while video is playing (DESIGN.md: video first).
  useEffect(() => {
    if (!s.playing || showSubMenu) {
      justRevealedRef.current = false;
      return;
    }
    let timer: ReturnType<typeof setTimeout>;
    const show = () => {
      setActive(true);
      clearTimeout(timer);
      timer = setTimeout(() => setActive(false), 2500);
    };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch' && !visibleRef.current) return;
      show();
    };
    const onPointerDown = () => {
      justRevealedRef.current = !visibleRef.current;
      show();
    };

    timer = setTimeout(() => setActive(false), 2500);
    const el = container;
    el.addEventListener('pointermove', onPointerMove);
    el.addEventListener('pointerdown', onPointerDown);
    return () => {
      clearTimeout(timer);
      el.removeEventListener('pointermove', onPointerMove);
      el.removeEventListener('pointerdown', onPointerDown);
    };
  }, [s.playing, showSubMenu, container]);

  // Close sub-menu on click outside
  useEffect(() => {
    if (!showSubMenu) return;
    const handleOutside = (e: MouseEvent) => {
      if (subMenuRef.current && !subMenuRef.current.contains(e.target as Node)) {
        setShowSubMenu(false);
      }
    };
    window.addEventListener('pointerdown', handleOutside);
    return () => window.removeEventListener('pointerdown', handleOutside);
  }, [showSubMenu]);

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
    const action = resolveBackdropTap({
      playing: s.playing,
      visible,
      justRevealedByPointerDown: justRevealedRef.current,
    });
    justRevealedRef.current = false;
    // If playing and controls were hidden before this tap, reveal them first rather than abruptly pausing.
    if (action === 'reveal') {
      setActive(true);
    } else {
      toggle(video);
    }
  };

  const handleSubButtonClick = () => {
    if (!hasSubtitles) {
      subFileInputRef.current?.click();
    } else {
      onToggleSubtitles?.();
    }
  };

  return (
    <>
      {/* Hidden file input for subtitles */}
      <input
        ref={subFileInputRef}
        type="file"
        accept=".srt,.vtt,text/vtt"
        className="sr-only"
        data-testid="subtitles-file-input"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) {
            onLoadSubtitleFile?.(file);
            setShowSubMenu(false);
          }
        }}
      />

      {/* Click anywhere on the picture to summon controls or play/pause. */}
      <div className="absolute inset-0" onClick={onBackdropClick} />
      <div
        className={`absolute inset-x-0 bottom-0 flex flex-wrap items-center gap-1.5 bg-gradient-to-t from-black/95 via-black/60 to-transparent px-3 pt-10 pb-2 transition-opacity duration-200 ${
          visible ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
      >
        <IconButton label={s.playing ? 'Pause' : 'Play'} onClick={() => toggle(video)}>
          {s.playing ? icons.pause : icons.play}
        </IconButton>

        <IconButton
          label="Rewind 5 seconds"
          data-testid="rewind-5s-btn"
          onClick={() => seek(video, video.currentTime - SKIP_S)}
          className="hidden sm:grid"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M12.5 3a9 9 0 1 0 9 9h-2a7 7 0 1 1-7-7v3l5-4-5-4v3Z" />
            <text x="12" y="15" fontSize="7" fontWeight="bold" textAnchor="middle" fill="currentColor">5</text>
          </svg>
        </IconButton>

        <IconButton
          label="Forward 5 seconds"
          data-testid="forward-5s-btn"
          onClick={() => seek(video, video.currentTime + SKIP_S)}
          className="hidden sm:grid"
        >
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
            <path d="M11.5 3a9 9 0 1 1-9 9h2a7 7 0 1 0 7-7v3l-5-4 5-4v3Z" />
            <text x="12" y="15" fontSize="7" fontWeight="bold" textAnchor="middle" fill="currentColor">5</text>
          </svg>
        </IconButton>

        {isStream ? (
          <div className="flex flex-1 items-center gap-2 px-2">
            <span className="flex items-center gap-1.5 rounded-full bg-danger/20 border border-danger/40 px-2 py-0.5 text-[10px] font-bold tracking-wider text-danger uppercase">
              <span className="size-1.5 rounded-full bg-danger animate-pulse" />
              Live
            </span>
            {stats && <QualityBadge stats={stats} />}
          </div>
        ) : (
          <>
            <span className="shrink-0 px-1 font-mono text-xs tabular-nums text-text/90 font-medium">
              {formatTime(s.time)} / {formatTime(s.duration)}
            </span>
            <div
              className="group/seek relative mx-2 min-w-0 flex-1"
              onMouseMove={(e) => {
                if (!s.duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                const frac = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
                setHoverTime(frac * s.duration);
                setHoverPos(frac * 100);
              }}
              onMouseLeave={() => setHoverTime(null)}
            >
              {hoverTime !== null && (
                <div
                  className="pointer-events-none absolute -top-8 -translate-x-1/2 rounded-md bg-surface-container-highest px-2 py-0.5 text-[10px] font-mono font-bold text-text shadow-lg border border-outline/40 z-20"
                  style={{ left: `${hoverPos}%` }}
                >
                  {formatTime(hoverTime)}
                </div>
              )}
              <div className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 overflow-hidden rounded-full bg-white/20">
                <div className="absolute inset-y-0 left-0 bg-white/30" style={{ width: pct(s.buffered) }} />
                <div className="absolute inset-y-0 left-0 bg-[#e8a0bf]" style={{ width: pct(s.time) }} />
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
          </>
        )}

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

        {/* Subtitles (CC) control and popover */}
        {!isStream && (
          <div ref={subMenuRef} className="relative inline-flex items-center">
            <IconButton
              label={
                hasSubtitles
                  ? subtitlesVisible
                    ? 'Subtitles on (click to turn off)'
                    : 'Subtitles off (click to turn on)'
                  : 'Load subtitles'
              }
              onClick={handleSubButtonClick}
              className={hasSubtitles && subtitlesVisible ? 'text-accent' : 'text-text'}
              data-testid="subtitles-toggle-btn"
            >
              {icons.subtitles}
            </IconButton>

            <button
              type="button"
              onClick={() => setShowSubMenu((prev) => !prev)}
              aria-label="Subtitle settings"
              aria-expanded={showSubMenu}
              className="grid size-8 place-items-center -ml-2 rounded-full text-muted hover:text-text hover:bg-white/10"
              title="Subtitle settings"
              data-testid="subtitles-settings-btn"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                <path d="M5.22 8.22a.75.75 0 0 1 1.06 0L10 11.94l3.72-3.72a.75.75 0 1 1 1.06 1.06l-4.25 4.25a.75.75 0 0 1-1.06 0L5.22 9.28a.75.75 0 0 1 0-1.06Z" />
              </svg>
            </button>

            {showSubMenu && (
              <div
                role="menu"
                aria-label="Subtitle options"
                className="absolute bottom-12 right-0 z-50 flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-md min-w-[200px]"
              >
                <div className="flex items-center justify-between border-b border-border/60 pb-2">
                  <span className="text-xs font-semibold text-text">Subtitles</span>
                  {hasSubtitles && (
                    <button
                      type="button"
                      onClick={() => onToggleSubtitles?.()}
                      className={`text-[11px] font-medium rounded-full px-2 py-0.5 ${
                        subtitlesVisible ? 'bg-accent/20 text-accent' : 'bg-surface-2 text-muted'
                      }`}
                    >
                      {subtitlesVisible ? 'ON' : 'OFF'}
                    </button>
                  )}
                </div>

                {hasSubtitles && subtitleLabel && (
                  <div className="text-[11px] text-muted truncate max-w-[190px]">
                    Track: <span className="text-text font-mono">{subtitleLabel}</span>
                  </div>
                )}

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase font-semibold text-muted tracking-wider">Font Size</span>
                  <div className="flex items-center gap-1 rounded-sm border border-border bg-surface-2 p-1">
                    {(['sm', 'md', 'lg'] as const).map((sz) => (
                      <button
                        key={sz}
                        type="button"
                        onClick={() => onChangeSubtitleFontSize?.(sz)}
                        className={`flex-1 rounded-xs py-1 text-center text-xs transition ${
                          subtitleFontSize === sz
                            ? 'bg-accent font-bold text-bg shadow-xs'
                            : 'text-muted hover:text-text'
                        }`}
                      >
                        {SUBTITLE_FONT_SIZES[sz].label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 border-t border-border/60 pt-2">
                  <button
                    type="button"
                    onClick={() => subFileInputRef.current?.click()}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-xs text-text hover:bg-surface-2 transition text-left"
                  >
                    <span>{hasSubtitles ? 'Replace .srt/.vtt file…' : 'Load .srt/.vtt file…'}</span>
                  </button>

                  {hasSubtitles && onClearSubtitles && (
                    <button
                      type="button"
                      onClick={() => {
                        onClearSubtitles();
                        setShowSubMenu(false);
                      }}
                      className="flex items-center gap-2 rounded-md px-2 py-1 text-xs text-danger hover:bg-danger/10 transition text-left"
                    >
                      <span>Remove subtitles</span>
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Share Screen button */}
        {onShareScreen && (
          <IconButton
            label={isScreenSharing ? 'Stop sharing screen' : 'Share screen'}
            onClick={onShareScreen}
            className={isScreenSharing ? 'text-primary' : 'text-text'}
            data-testid="controls-share-screen-btn"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm4 15h8v-1.5H8V20Z" />
            </svg>
          </IconButton>
        )}

        {/* Sync Now button with spin icon */}
        {onSyncNow && !isStream && (
          <IconButton
            label="Sync now with partner"
            onClick={() => {
              setIsSpinning(true);
              onSyncNow();
              setTimeout(() => setIsSpinning(false), 700);
            }}
            data-testid="controls-sync-now-btn"
            className="group"
          >
            <span className={`inline-flex transition-transform duration-700 ${isSpinning ? 'rotate-360 animate-spin' : 'group-hover:rotate-180'}`}>
              {icons.sync}
            </span>
          </IconButton>
        )}

        {/* Theater mode toggle */}
        {onToggleTheater && (
          <IconButton
            label={isTheater ? 'Exit theater mode' : 'Theater mode'}
            onClick={onToggleTheater}
            className={isTheater ? 'text-accent' : 'text-text'}
            data-testid="theater-mode-btn"
          >
            {icons.theater}
          </IconButton>
        )}

        {/* Fullscreen */}
        {isFullscreenSupported() && (
          <IconButton label="Fullscreen" onClick={() => toggleFullscreen(container, video)}>
            {icons.fullscreen}
          </IconButton>
        )}
      </div>
    </>
  );
}
