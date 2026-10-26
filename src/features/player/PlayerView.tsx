import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { Button, QualityBadge } from '../../ui';
import { requestKeepAwake, releaseKeepAwake } from '../../lib/keepAwake';
import type { VideoStats } from '../call/webrtc';
import { PlayerControls } from './PlayerControls';
import { fingerprint, formatTime, parseVideoSource, type MediaInfo } from './media';
import { YouTubePlayerView } from './YouTubePlayerView';
import type { DuetChannel } from '../../lib/supabase';
import type { MediaMsg } from '../sync/protocol';
import {
  SUBTITLE_FONT_SIZES,
  type SubtitleTrack,
  type SubtitleFontSize,
} from './subtitleTypes';

const StreamPlayerView = lazy(() => import('./StreamPlayerView'));

type Source = {
  src: string;
  label: string;
  file?: File;
  mediaType?: 'file' | 'direct' | 'youtube';
  videoId?: string;
};
type Meta = { duration: number; width: number; height: number };

const mb = new Intl.NumberFormat(undefined, { style: 'unit', unit: 'megabyte', maximumFractionDigits: 1 });

export interface PlayerViewProps {
  children?: React.ReactNode;
  onVideoRef?: (el: HTMLVideoElement | null) => void;
  onMediaInfo?: (info: MediaInfo | null) => void;
  channel?: DuetChannel | null;
  selfUserId?: string | null;
  partnerMedia?: MediaMsg | null;
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
  isMobile?: boolean;
  isLandscape?: boolean;
}

export function PlayerView({
  children,
  onVideoRef,
  onMediaInfo,
  channel,
  selfUserId,
  partnerMedia,
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
  isMobile = false,
  isLandscape = false,
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

  // Drag and drop / Direct URL state
  const [isDragging, setIsDragging] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [directUrl, setDirectUrl] = useState('');

  useEffect(() => {
    onVideoRef?.(video);
  }, [video, onVideoRef]);

  useEffect(() => {
    onMediaInfo?.(info);
  }, [info, onMediaInfo]);

  // Auto-mount partner's media URL (Direct or YouTube) if local player has no media loaded
  useEffect(() => {
    if (!source && partnerMedia?.url) {
      const parsed = parseVideoSource(partnerMedia.url);
      if (parsed) {
        if (parsed.type === 'youtube') {
          setSource({
            src: parsed.url,
            label: partnerMedia.name || parsed.label,
            mediaType: 'youtube',
            videoId: parsed.videoId,
          });
        } else {
          setSource({
            src: parsed.url,
            label: partnerMedia.name || parsed.label,
            mediaType: 'direct',
          });
        }
      }
    }
  }, [partnerMedia, source]);

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
    <section className={`flex flex-col gap-3 ${isLandscape ? 'size-full' : ''}`}>
      {/* 16:9 Video Canvas Box with Ambient Gradients */}
      <div
        ref={setContainer}
        tabIndex={-1}
        className={`group relative w-full ${
          isLandscape
            ? 'h-full max-h-none rounded-none border-none'
            : isTheater
              ? 'h-[calc(100vh-80px)] max-h-none rounded-none border-none'
              : 'aspect-video min-h-[300px] sm:min-h-[380px] lg:min-h-[460px] xl:min-h-[540px] max-h-[calc(100vh-150px)] rounded-2xl border border-outline/40 shadow-2xl'
        } [&:fullscreen]:h-full [&:fullscreen]:max-h-none [&:fullscreen]:rounded-none [&:fullscreen]:border-none overflow-hidden bg-black outline-none transition-all duration-200`}
      >
        {/* Top/bottom ambient gradients */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-black/70 via-black/20 to-transparent z-10" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/80 via-black/20 to-transparent z-10" />

        {/* Quality Badges */}
        {source && (
          <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 z-20 flex items-center gap-1.5 pointer-events-none select-none">
            {meta?.height ? (
              <span className="rounded-full bg-black/60 border border-white/10 backdrop-blur-xs px-2 py-0.5 text-[9px] sm:text-[10px] font-mono font-medium text-white/90">
                {meta.height}p
              </span>
            ) : null}
            {roomCode && (
              <span className="rounded-full bg-black/60 border border-white/10 backdrop-blur-xs px-2 py-0.5 text-[9px] sm:text-[10px] font-mono font-medium text-primary">
                Room {roomCode}
              </span>
            )}
          </div>
        )}

        {/* Floating Action Toasts inside 16:9 Video Canvas */}
        {actionToasts && actionToasts.length > 0 && (
          <div className="absolute top-2 sm:top-3 right-2 sm:right-3 z-30 flex flex-col items-end gap-1 pointer-events-none max-w-[60%] sm:max-w-xs" data-testid="player-canvas-toasts">
            {actionToasts.map((toast) => (
              <div
                key={toast.id}
                className="pointer-events-auto inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/85 px-2.5 py-0.5 sm:py-1 text-[10px] sm:text-xs font-medium text-white shadow-lg backdrop-blur-md whitespace-nowrap overflow-hidden text-ellipsis max-w-full"
              >
                <span className="size-1.5 rounded-full bg-primary animate-pulse shrink-0" />
                <span className="truncate">{toast.message}</span>
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
        ) : source?.mediaType === 'youtube' && source.videoId ? (
          <YouTubePlayerView
            videoId={source.videoId}
            channel={channel}
            selfUserId={selfUserId}
            roomCode={roomCode}
            actionToasts={actionToasts}
            isTheater={isTheater}
            onDuration={(d) => {
              setMeta({ duration: d, width: 1920, height: 1080 });
              setInfo({
                name: source.label,
                size: 0,
                duration: d,
                hash: `yt:${source.videoId}`,
                url: source.src,
                mediaType: 'youtube',
              });
            }}
          />
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
                } else if (!source.file && source.src) {
                  setInfo({
                    name: source.label || 'Direct Video Stream',
                    size: 0,
                    duration: v.duration,
                    hash: `url:${source.src}`,
                    url: source.src,
                    mediaType: 'direct',
                  });
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
                  setError("That link didn't load as a video. If this is a streaming website (like Braflix or Netflix), open it in your browser and use 'Share Screen' in the call panel to watch together!");
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
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              const f = e.dataTransfer.files?.[0];
              if (f) {
                load({ src: URL.createObjectURL(f), label: f.name, file: f });
              }
            }}
            className={`relative size-full flex flex-col items-center justify-center p-6 bg-surface-container-lowest overflow-hidden select-none transition-all duration-200 ${
              isDragging
                ? 'ring-2 ring-primary bg-primary/10'
                : ''
            }`}
          >
            {/* Ambient cinematic glow */}
            <div className="absolute inset-0 bg-radial from-primary/10 via-transparent to-black/80 pointer-events-none" />

            {/* Room code indicator at top-right if present */}
            {roomCode && (
              <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-surface-container-high/80 border border-outline/30 text-primary font-mono-sm text-[11px] font-bold shadow-sm">
                Room {roomCode}
              </div>
            )}

            {/* Center Cinema File Picker */}
            <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto">
              {/* Twin-Ring Cinema Motif (hidden on mobile to preserve height) */}
              <div className="mb-3.5 hidden sm:flex size-14 sm:size-16 items-center justify-center rounded-full bg-gradient-to-tr from-[#e8a0bf] via-[#ffd8e6] to-[#f2c57c] p-[2px] shadow-lg">
                <div className="flex size-full items-center justify-center rounded-full bg-surface-container-lowest text-primary">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="size-7 sm:size-8 translate-x-0.5"
                    aria-hidden="true"
                  >
                    <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                  </svg>
                </div>
              </div>

              <h3 className="font-headline-md text-base sm:text-xl font-bold text-text">
                {isDragging ? 'Drop video file here' : 'Private Cinema Stage'}
              </h3>
              <p className="font-body-md text-xs sm:text-sm text-muted mt-0.5 sm:mt-1 max-w-md hidden sm:block">
                Choose or drag &amp; drop a local video (MP4/MKV) or enter a video link to watch together in sync.
              </p>

              {/* Action Buttons */}
              <div className="mt-3 sm:mt-4 flex flex-wrap items-center justify-center gap-2 sm:gap-2.5">
                <label className="cursor-pointer inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl bg-primary-container text-on-primary-container font-headline-md text-xs sm:text-sm font-bold shadow-md hover:bg-primary transition active:scale-95">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5 sm:size-4">
                    <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 4.636v8.614Z" />
                    <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                  </svg>
                  <span>Choose File</span>
                  <input
                    type="file"
                    accept="video/*,.mkv"
                    className="sr-only"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) load({ src: URL.createObjectURL(file), label: file.name, file });
                    }}
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setShowUrlInput((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3 sm:px-3.5 py-2 sm:py-2.5 rounded-xl bg-surface-container-high border border-outline/30 text-text font-medium text-xs sm:text-sm hover:bg-surface-variant transition active:scale-95 cursor-pointer shadow-sm"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5 sm:size-4 text-muted">
                    <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
                    <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
                  </svg>
                  <span>Video Link</span>
                </button>

                <button
                  type="button"
                  onClick={() => load({ src: '/sample.mp4', label: 'Big Buck Bunny (Sample)', mediaType: 'direct' })}
                  className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 sm:py-2.5 rounded-xl bg-surface-container-high border border-outline/30 text-muted hover:text-text font-medium text-xs sm:text-sm hover:bg-surface-variant transition active:scale-95 cursor-pointer shadow-sm"
                  title="Play local sample MP4"
                >
                  <span>🎬</span>
                  <span>Sample</span>
                </button>
              </div>

              {/* Inline URL Input (Supports YouTube & Direct Video URLs) */}
              {showUrlInput && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!directUrl.trim()) return;
                    const parsed = parseVideoSource(directUrl.trim());
                    if (!parsed) {
                      setError("Please enter a valid YouTube link or direct video (.mp4/.webm) URL.");
                      return;
                    }
                    if (parsed.type === 'youtube') {
                      load({
                        src: parsed.url,
                        label: parsed.label,
                        mediaType: 'youtube',
                        videoId: parsed.videoId,
                      });
                      setInfo({
                        name: parsed.label,
                        size: 0,
                        duration: 0,
                        hash: `yt:${parsed.videoId}`,
                        url: parsed.url,
                        mediaType: 'youtube',
                      });
                    } else {
                      load({
                        src: parsed.url,
                        label: parsed.label,
                        mediaType: 'direct',
                      });
                    }
                  }}
                  className="mt-3 flex w-full max-w-sm flex-col gap-1.5 rounded-xl border border-outline/40 bg-surface-container p-2 shadow-sm"
                >
                  <div className="flex items-center gap-1.5 w-full">
                    <input
                      type="text"
                      value={directUrl}
                      onChange={(e) => setDirectUrl(e.target.value)}
                      placeholder="YouTube or direct MP4/web URL"
                      autoFocus
                      className="flex-1 bg-transparent px-2.5 py-1 text-xs text-text placeholder:text-muted/60 focus:outline-hidden"
                    />
                    <button
                      type="submit"
                      disabled={!directUrl.trim()}
                      className="rounded-lg bg-primary-container px-3 py-1.5 text-xs font-bold text-on-primary-container hover:bg-primary transition disabled:opacity-40 cursor-pointer"
                    >
                      Play
                    </button>
                  </div>
                  <span className="text-[10px] text-muted text-left px-1">
                    Paste YouTube links or direct .mp4/.webm streams to watch together.
                  </span>
                </form>
              )}

              <span className="mt-3 text-[10px] sm:text-[11px] text-tertiary font-medium">
                Direct P2P Sync · Zero lag playback · Audio 48kHz
              </span>
            </div>
          </div>
        )}
        {children}
      </div>

      {/* Video Metadata Strip & Subtitles Row (Desktop only; on mobile this lives in Call & Media tab) */}
      {!isStreamMode && !isMobile && (
        <div className="flex flex-col gap-2">
          {source && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline/30 bg-surface-container px-3.5 py-1.5 text-xs shadow-xs">
              <div className="flex items-center gap-2 truncate max-w-full sm:max-w-[45%]">
                <span className="grid size-5 place-items-center rounded-md bg-primary-container/20 text-primary font-bold text-[9px] shrink-0">
                  ▶
                </span>
                <span className="font-semibold text-text truncate text-xs">{source.label}</span>
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
                    {info.hash.slice(0, 10)}
                  </code>
                )}
                <div className="flex items-center gap-1.5 border-l border-outline/30 pl-2">
                  {subtitle ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-outline/40 bg-surface-container-low px-2 py-0.5 text-[10px] text-text shadow-xs">
                      <span className="truncate max-w-[110px] font-mono-sm">{subtitle.label}</span>
                      <span className="text-[10px] text-primary">({SUBTITLE_FONT_SIZES[subtitleFontSize].label})</span>
                      <button
                        type="button"
                        onClick={() => setSubtitlesVisible((v) => !v)}
                        className="ml-0.5 text-[10px] font-medium underline hover:text-primary cursor-pointer"
                      >
                        {subtitlesVisible ? 'Hide' : 'Show'}
                      </button>
                      <button
                        type="button"
                        onClick={handleClearSubtitles}
                        className="text-xs text-muted hover:text-error ml-0.5 cursor-pointer"
                        title="Remove subtitles"
                      >
                        ✕
                      </button>
                    </span>
                  ) : (
                    <span className="text-muted text-[10px]">None loaded</span>
                  )}
                  <label className="cursor-pointer text-[11px] font-semibold text-primary hover:underline">
                    <span>{subtitle ? 'Change' : '+ Subtitles'}</span>
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
                    <div className="flex items-center gap-0.5 rounded-lg border border-outline/40 bg-surface-container-low p-0.5 text-[9px]">
                      {(['sm', 'md', 'lg'] as const).map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => setSubtitleFontSize(sz)}
                          className={`rounded-md px-1.5 py-0.2 transition cursor-pointer ${
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
                <button
                  type="button"
                  onClick={() => setSource(null)}
                  className="rounded-md bg-surface-container-high px-2 py-0.5 text-[11px] font-sans font-medium text-primary hover:bg-surface-variant transition cursor-pointer"
                >
                  Change file
                </button>
              </div>
            </div>
          )}

          {/* Instant Reactions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-outline/30 bg-surface-container-low px-3.5 py-1.5 text-xs shadow-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-text select-none text-[11px]">Instant Reactions:</span>
              <div className="flex items-center gap-1">
                {['🍿', '❤️', '😂', '😭', '✨', '🫂'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => onReaction?.(emoji)}
                    className="grid size-7 place-items-center rounded-lg bg-surface-container hover:bg-surface-container-high text-sm transition-transform hover:scale-125 active:scale-95 cursor-pointer shadow-xs"
                    aria-label={`React with ${emoji}`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-[11px] text-muted font-medium">
              {lastReaction ? (
                <>
                  <span>{lastReaction.from} sent</span>
                  <span className="text-sm">{lastReaction.emoji}</span>
                  <span className="text-muted/70">{lastReaction.time}</span>
                </>
              ) : (
                <span className="text-muted/60">Click emoji to react</span>
              )}
            </div>
          </div>
        </div>
      )}

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
              className="text-primary underline font-medium hover:opacity-80 cursor-pointer"
            >
              Stop Sharing
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}

