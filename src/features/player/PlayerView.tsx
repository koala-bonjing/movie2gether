import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { Button, QualityBadge } from '../../ui';
import { requestKeepAwake, releaseKeepAwake } from '../../lib/keepAwake';
import type { VideoStats } from '../call/webrtc';
import { FilePickerCard } from './FilePickerCard';
import { PlayerControls } from './PlayerControls';
import { fingerprint, formatTime, type MediaInfo } from './media';
import {
  SUBTITLE_FONT_SIZES,
  type SubtitleTrack,
  type SubtitleFontSize,
} from './subtitleTypes';

const StreamPlayerView = lazy(() => import('./StreamPlayerView'));

type Source = { src: string; label: string; file?: File };
type Meta = { duration: number; width: number; height: number };

const mb = new Intl.NumberFormat(undefined, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 });

export interface PlayerViewProps {
  onVideoRef?: (el: HTMLVideoElement | null) => void;
  onMediaInfo?: (info: MediaInfo | null) => void;
  partnerBuffering?: boolean;
  isStreamMode?: boolean;
  streamSource?: MediaStream | null;
  isScreenSharing?: boolean;
  streamerName?: string;
  onStopScreenShare?: () => void;
  stats?: VideoStats | null;
  isTheater?: boolean;
  onToggleTheater?: () => void;
  onSyncNow?: () => void;
  roomCode?: string;
  onReaction?: (emoji: string) => void;
  lastReaction?: { from: string; emoji: string; time: string } | null;
  actionToasts?: Array<{ id: string; message: string }>;
  onShareScreen?: () => void;
}

export function PlayerView({
  onVideoRef,
  onMediaInfo,
  partnerBuffering = false,
  isStreamMode = false,
  streamSource = null,
  isScreenSharing = false,
  streamerName,
  onStopScreenShare,
  stats,
  isTheater = false,
  onToggleTheater,
  onSyncNow,
  roomCode,
  onReaction,
  lastReaction,
  actionToasts,
  onShareScreen,
}: PlayerViewProps = {}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Subtitle states
  const [subtitle, setSubtitle] = useState<SubtitleTrack | null>(null);
  const [subtitlesVisible, setSubtitlesVisible] = useState(true);
  const [subtitleFontSize, setSubtitleFontSize] = useState<SubtitleFontSize>('md');

  useEffect(() => {
    onVideoRef?.(video);
  }, [video, onVideoRef]);

  useEffect(() => {
    onMediaInfo?.(info);
  }, [info, onMediaInfo]);

  // Revoke the previous object URL when the source changes, and the current one on unmount.
  useEffect(
    () => () => {
      if (source?.file) URL.revokeObjectURL(source.src);
    },
    [source],
  );

  // Revoke subtitle blob URL when subtitle changes or on unmount
  useEffect(() => {
    return () => {
      if (subtitle?.blobUrl) {
        URL.revokeObjectURL(subtitle.blobUrl);
      }
    };
  }, [subtitle]);

  // Sync textTrack showing/hidden state on HTMLVideoElement
  useEffect(() => {
    const el = videoElementRef.current;
    if (!el) return;
    for (let i = 0; i < el.textTracks.length; i++) {
      const track = el.textTracks[i];
      if (track) {
        track.mode = subtitlesVisible ? 'showing' : 'hidden';
      }
    }
  }, [subtitlesVisible, subtitle]);

  useEffect(() => {
    if (!source?.file || !meta) return;
    let live = true;
    fingerprint(source.file, meta.duration)
      .then((fp) => live && setInfo(fp))
      .catch((e: unknown) => console.warn('fingerprint failed (needs HTTPS or localhost)', e));
    return () => {
      live = false;
    };
  }, [source, meta]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && videoElementRef.current && !videoElementRef.current.paused) {
        void requestKeepAwake();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      void releaseKeepAwake();
    };
  }, []);

  const load = (next: Source) => {
    setSource(next);
    setMeta(null);
    setInfo(null);
    setError(null);
    container?.focus(); // move focus to the player so keyboard shortcuts work right away
  };

  const handleLoadSubtitleFile = async (file: File) => {
    try {
      const { parseSubtitleFile, createSubtitleBlobUrl } = await import('./subtitles');
      const parsed = await parseSubtitleFile(file);
      const url = createSubtitleBlobUrl(parsed.vttContent);
      setSubtitle((prev) => {
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
        return { label: parsed.label, blobUrl: url };
      });
      setSubtitlesVisible(true);
    } catch (e) {
      console.warn('Failed to parse subtitle file:', e);
    }
  };

  const handleClearSubtitles = () => {
    if (subtitle?.blobUrl) {
      URL.revokeObjectURL(subtitle.blobUrl);
    }
    setSubtitle(null);
  };

  return (
    <section className="flex flex-col gap-4">
      {/* 16:9 Video Canvas Box with Ambient Gradients */}
      <div
        ref={setContainer}
        tabIndex={-1}
        className="group relative aspect-video w-full max-h-[calc(100vh-210px)] overflow-hidden rounded-2xl border border-outline/40 bg-black shadow-2xl outline-none"
      >
        {/* Top/bottom ambient gradients */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 via-black/20 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />

        {/* Quality Badges */}
        <div className="absolute top-3 left-3 z-20 flex items-center gap-1.5 pointer-events-none select-none">
          <span className="rounded-full bg-black/60 border border-white/10 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-mono font-medium text-white/90">
            {meta ? `${meta.height}p` : '1080p WebRip'}
          </span>
          <span className="rounded-full bg-black/60 border border-white/10 backdrop-blur-xs px-2 py-0.5 text-[10px] font-mono font-medium text-white/70">
            H.264
          </span>
          {roomCode && (
            <span className="rounded-full bg-black/60 border border-white/10 backdrop-blur-xs px-2.5 py-0.5 text-[10px] font-mono font-medium text-primary">
              Room {roomCode}
            </span>
          )}
        </div>

        {/* Floating Action Toasts inside 16:9 Video Canvas */}
        {actionToasts && actionToasts.length > 0 && (
          <div className="absolute top-3 right-3 z-30 flex flex-col gap-2 pointer-events-none" data-testid="player-canvas-toasts">
            {actionToasts.map((toast) => (
              <div
                key={toast.id}
                className="pointer-events-auto flex items-center gap-2 rounded-xl border border-white/15 bg-black/80 px-3.5 py-1.5 text-xs font-medium text-white shadow-xl backdrop-blur-md transition-all"
              >
                <span className="size-2 rounded-full bg-primary animate-pulse" />
                <span>{toast.message}</span>
              </div>
            ))}
          </div>
        )}

        {isStreamMode ? (
          isScreenSharing ? (
            <div className="flex flex-col items-center justify-center size-full gap-3 bg-surface-container p-6 text-center select-none" data-testid="screen-stream-local">
              <div className="grid size-14 place-items-center rounded-full bg-primary-container/20 border border-primary-container/40 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-7" aria-hidden="true">
                  <path d="M4 5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm4 15h8v-1.5H8V20Z" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-text">You are sharing your screen</h3>
                <p className="text-xs text-muted mt-1">Live 1080p stream active. Partner is watching.</p>
              </div>
              {stats && <QualityBadge stats={stats} />}
              {onStopScreenShare && (
                <Button variant="primary" onClick={onStopScreenShare} className="mt-2 text-xs h-9 px-4" data-testid="stop-screenshare-main-btn">
                  Stop Sharing
                </Button>
              )}
            </div>
          ) : streamSource ? (
            <Suspense fallback={<div className="grid size-full place-items-center text-muted select-none">Loading stream…</div>}>
              <StreamPlayerView
                streamSource={streamSource}
                container={container}
                stats={stats}
                streamerName={streamerName}
                isTheater={isTheater}
                onToggleTheater={onToggleTheater}
              />
            </Suspense>
          ) : (
            <div className="grid size-full place-items-center p-4 text-center text-muted select-none">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-primary motion-safe:animate-ping" />
                <span>Connecting to screen stream…</span>
              </div>
            </div>
          )
        ) : source ? (
          <>
            <video
              ref={(el) => {
                videoElementRef.current = el;
                setVideo(el);
              }}
              src={source.src}
              playsInline
              onPlay={() => void requestKeepAwake()}
              onPause={() => void releaseKeepAwake()}
              onEnded={() => void releaseKeepAwake()}
              className="size-full object-contain"
              style={{
                '--sub-font-size': SUBTITLE_FONT_SIZES[subtitleFontSize].px,
              } as React.CSSProperties}
              onLoadedMetadata={(e) => {
                const v = e.currentTarget;
                setMeta({ duration: v.duration, width: v.videoWidth, height: v.videoHeight });
                if (!v.videoWidth) {
                  setError("We can hear audio, but this browser cannot display the video stream.");
                }
              }}
              onError={(e) => {
                const v = e.currentTarget;
                const code = v.error?.code;
                if (source.file) {
                  setError(
                    code === 4
                      ? "Unsupported video format or codec (e.g. MKV/HEVC)."
                      : "This file won't play in this browser.",
                  );
                } else {
                  setError("That link didn't load. It needs to be a direct video URL this browser can open.");
                }
              }}
            >
              {subtitle && subtitlesVisible && (
                <track
                  key={subtitle.blobUrl}
                  kind="subtitles"
                  label={subtitle.label}
                  src={subtitle.blobUrl}
                  srcLang="en"
                  default
                />
              )}
            </video>

            {error ? (
              <div role="alert" className="absolute inset-0 grid place-items-center overflow-auto bg-black/85 p-4 z-20">
                <div className="flex max-w-lg flex-col gap-2 text-center">
                  <p className="text-lg font-medium">{error}</p>
                  {source.file && (
                    <>
                      <p className="text-sm text-muted">
                        MP4 with H.264 video and AAC audio plays everywhere. Make a copy with ffmpeg:
                      </p>
                      <code className="rounded-sm bg-surface-container-high p-2 text-left text-xs break-all">
                        ffmpeg -i input.mkv -c copy output.mp4
                      </code>
                      <p className="text-xs text-muted">Still failing (HEVC video or AC3/DTS audio)? Re-encode:</p>
                      <code className="rounded-sm bg-surface-container-high p-2 text-left text-xs break-all">
                        ffmpeg -i input.mkv -c:v libx264 -crf 18 -preset medium -c:a aac -b:a 192k output.mp4
                      </code>
                    </>
                  )}
                  <div className="mt-3 flex justify-center">
                    <Button variant="ghost" onClick={() => setSource(null)}>
                      Choose another video
                    </Button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {video && container && (
                  <PlayerControls
                    video={video}
                    container={container}
                    hasSubtitles={!!subtitle}
                    subtitlesVisible={subtitlesVisible}
                    onToggleSubtitles={() => setSubtitlesVisible((prev) => !prev)}
                    subtitleFontSize={subtitleFontSize}
                    onChangeSubtitleFontSize={setSubtitleFontSize}
                    onLoadSubtitleFile={handleLoadSubtitleFile}
                    onClearSubtitles={handleClearSubtitles}
                    subtitleLabel={subtitle?.label}
                    isTheater={isTheater}
                    onToggleTheater={onToggleTheater}
                    onSyncNow={onSyncNow}
                    onShareScreen={onShareScreen}
                    isScreenSharing={isScreenSharing}
                  />
                )}
                {partnerBuffering && (
                  <div
                    role="status"
                    className="absolute inset-0 z-30 grid place-items-center bg-black/60 pointer-events-none"
                  >
                    <div className="flex items-center gap-2 rounded-full border border-outline/40 bg-surface-container px-4 py-2 text-sm text-text shadow-lg">
                      <span className="relative flex size-2.5">
                        <span className="absolute inline-flex size-full animate-ping rounded-full bg-warn opacity-75" />
                        <span className="relative inline-flex size-2.5 rounded-full bg-warn" />
                      </span>
                      <span>Waiting for partner…</span>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        ) : (
          <div className="grid size-full place-items-center p-4 text-center text-muted">
            Pick a video below to start.
          </div>
        )}
      </div>

      {/* Inline Floating Emoji Reaction Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline/30 bg-surface-container-low px-4 py-2 text-xs shadow-xs">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-text select-none">Instant Reactions:</span>
          <div className="flex items-center gap-1.5">
            {['🍿', '❤️', '😂', '😭', '✨', '🫂'].map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => onReaction?.(emoji)}
                className="grid size-8 place-items-center rounded-lg bg-surface-container hover:bg-surface-container-high text-base transition-transform hover:scale-125 active:scale-95 cursor-pointer shadow-xs"
                aria-label={`React with ${emoji}`}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
        {lastReaction && (
          <div className="flex items-center gap-1.5 text-[11px] text-muted font-medium">
            <span>{lastReaction.from} sent</span>
            <span className="text-base">{lastReaction.emoji}</span>
            <span className="text-muted/70">{lastReaction.time}</span>
          </div>
        )}
      </div>

      {isStreamMode ? (
        <div className="flex items-center justify-between rounded-md border border-primary-container/30 bg-primary-container/10 p-3 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-primary" />
            <span>Room is in Stream Mode. Local video file sync is paused.</span>
          </div>
          {isScreenSharing && onStopScreenShare && (
            <button
              type="button"
              onClick={onStopScreenShare}
              className="text-primary underline font-medium hover:opacity-80"
            >
              Stop Sharing
            </button>
          )}
        </div>
      ) : (
        <>
          {source && (
            <div className="flex flex-col gap-2.5">
              {/* Video Metadata Strip */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline/30 bg-surface-container px-3.5 py-2 text-xs shadow-xs">
                <div className="flex items-center gap-2 truncate max-w-full sm:max-w-[55%]">
                  <span className="grid size-6 place-items-center rounded-md bg-primary-container/20 text-primary font-bold text-[10px] shrink-0">
                    ▶
                  </span>
                  <span className="font-semibold text-text truncate">{source.label}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-muted text-[11px] font-mono-sm">
                  {meta && (
                    <span className="rounded-md bg-surface-container-high px-2 py-0.5 text-text">
                      {meta.width}×{meta.height} · {formatTime(meta.duration)}
                    </span>
                  )}
                  {source.file && (
                    <span className="rounded-md bg-surface-container-high px-2 py-0.5">
                      {mb.format(source.file.size / 1e6)}
                    </span>
                  )}
                  {info && (
                    <code title={info.hash} className="rounded-md bg-surface-container-high px-2 py-0.5 text-primary">
                      {info.hash.slice(0, 12)}
                    </code>
                  )}
                  <button
                    type="button"
                    onClick={() => setSource(null)}
                    className="rounded-md bg-surface-container-high px-2 py-0.5 text-[11px] font-sans font-medium text-primary hover:bg-surface-variant transition cursor-pointer"
                  >
                    Change file
                  </button>
                </div>
              </div>

              {/* Subtitles status & controls bar */}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-outline/30 bg-surface-container px-3.5 py-2.5 text-xs shadow-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-text">Subtitles:</span>
                  {subtitle ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-outline/40 bg-surface-container-low px-2.5 py-0.5 text-xs text-text shadow-xs">
                      <span className="truncate max-w-[150px] font-mono-sm">{subtitle.label}</span>
                      <span className="text-[10px] text-primary">({SUBTITLE_FONT_SIZES[subtitleFontSize].label})</span>
                      <button
                        type="button"
                        onClick={() => setSubtitlesVisible((v) => !v)}
                        className="ml-1 text-[11px] font-medium underline hover:text-primary"
                      >
                        {subtitlesVisible ? 'Hide' : 'Show'}
                      </button>
                      <button
                        type="button"
                        onClick={handleClearSubtitles}
                        className="text-xs text-muted hover:text-error ml-1"
                        title="Remove subtitles"
                      >
                        ✕
                      </button>
                    </span>
                  ) : (
                    <span className="text-muted">None loaded</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <label className="cursor-pointer text-xs font-semibold text-primary hover:underline">
                    <span>{subtitle ? 'Change file (.srt / .vtt)' : '+ Add subtitles (.srt / .vtt)'}</span>
                    <input
                      type="file"
                      accept=".srt,.vtt,text/vtt"
                      className="sr-only"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        e.target.value = '';
                        if (file) void handleLoadSubtitleFile(file);
                      }}
                    />
                  </label>
                  {subtitle && (
                    <div className="flex items-center gap-1 rounded-lg border border-outline/40 bg-surface-container-low p-0.5 text-[10px]">
                      {(['sm', 'md', 'lg'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setSubtitleFontSize(sz)}
                          className={`rounded-md px-2 py-0.5 transition ${
                            subtitleFontSize === sz
                              ? 'bg-primary-container font-bold text-on-primary-container shadow-xs'
                              : 'text-muted hover:text-text'
                          }`}
                        >
                          {sz.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {!source && (
            <FilePickerCard
              onFile={(file) => load({ src: URL.createObjectURL(file), label: file.name, file })}
              onUrl={(url) => load({ src: url, label: url })}
            />
          )}
        </>
      )}
    </section>
  );
}

