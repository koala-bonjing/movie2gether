import { useEffect, useRef, useState, useCallback } from 'react';
import type { DuetChannel } from '../../lib/supabase';
import { safeParseSyncMsg } from '../sync/protocol';
import { expectedPos } from '../sync/correction';

export interface YouTubePlayerViewProps {
  videoId: string;
  channel?: DuetChannel | null;
  selfUserId?: string | null;
  roomCode?: string;
  onDuration?: (duration: number) => void;
  actionToasts?: Array<{ id: string; message: string }>;
  isTheater?: boolean;
}

// Minimal YouTube IFrame API typings (zero unnecessary 3rd party deps)
interface YTPlayer {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  getCurrentTime: () => number;
  getDuration: () => number;
  getPlayerState: () => number;
  destroy: () => void;
}

declare global {
  interface Window {
    YT?: {
      Player: new (
        elementId: string | HTMLElement,
        options: {
          width?: string | number;
          height?: string | number;
          videoId?: string;
          playerVars?: Record<string, unknown>;
          events?: {
            onReady?: (event: { target: YTPlayer }) => void;
            onStateChange?: (event: { data: number; target: YTPlayer }) => void;
            onError?: (event: { data: number }) => void;
          };
        },
      ) => YTPlayer;
      PlayerState?: {
        PLAYING: number;
        PAUSED: number;
        BUFFERING: number;
        ENDED: number;
      };
    };
    onYouTubeIframeAPIReady?: () => void;
  }
}

export function YouTubePlayerView({
  videoId,
  channel,
  selfUserId,
  roomCode,
  onDuration,
  actionToasts,
  isTheater: _isTheater = false,
}: YouTubePlayerViewProps) {
  const containerId = useRef(`yt-player-${Math.random().toString(36).slice(2, 9)}`);
  const playerRef = useRef<YTPlayer | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);
  const isApplyingRemoteRef = useRef(false);
  const lastSyncSeqRef = useRef(0);

  // Broadcast sync event to partner
  const broadcastSync = useCallback(
    (playing: boolean, pos: number) => {
      if (!channel || !selfUserId || isApplyingRemoteRef.current) return;
      lastSyncSeqRef.current += 1;
      channel.send({
        type: 'broadcast',
        event: 'sync',
        payload: {
          seq: lastSyncSeqRef.current,
          from: selfUserId,
          playing,
          pos,
          rate: 1,
          at: Date.now(),
        },
      });
    },
    [channel, selfUserId],
  );

  // Toggle playback and broadcast to partner
  const togglePlay = useCallback(() => {
    if (!playerRef.current) return;
    try {
      if (isPlaying) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
        broadcastSync(false, playerRef.current.getCurrentTime());
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
        broadcastSync(true, playerRef.current.getCurrentTime());
      }
    } catch (e) {
      console.warn('Failed to toggle YouTube playback:', e);
    }
  }, [isPlaying, broadcastSync]);

  // Spacebar and arrow key shortcuts for YouTube
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        if (!playerRef.current) return;
        const cur = playerRef.current.getCurrentTime() || 0;
        const next = Math.max(0, cur - 5);
        playerRef.current.seekTo(next, true);
        broadcastSync(isPlaying, next);
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        if (!playerRef.current) return;
        const cur = playerRef.current.getCurrentTime() || 0;
        const dur = playerRef.current.getDuration() || 0;
        const next = Math.min(dur, cur + 5);
        playerRef.current.seekTo(next, true);
        broadcastSync(isPlaying, next);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay, isPlaying, broadcastSync]);

  // Initialize YouTube IFrame API
  useEffect(() => {
    let isMounted = true;

    const initPlayer = () => {
      if (!window.YT?.Player || !document.getElementById(containerId.current)) return;

      try {
        if (playerRef.current) {
          playerRef.current.destroy();
          playerRef.current = null;
        }

        playerRef.current = new window.YT.Player(containerId.current, {
          width: '100%',
          height: '100%',
          videoId,
          playerVars: {
            autoplay: 1,
            controls: 1,
            modestbranding: 1,
            rel: 0,
            playsinline: 1,
            enablejsapi: 1,
          },
          events: {
            onReady: (event) => {
              if (!isMounted) return;
              setIsReady(true);
              const dur = event.target.getDuration();
              if (dur && Number.isFinite(dur)) {
                onDuration?.(dur);
              }
              try {
                event.target.playVideo();
              } catch {
                // browser policy may require user click
              }
            },
            onStateChange: (event) => {
              if (!isMounted) return;
              const state = event.data;
              const target = event.target;
              // 1 = PLAYING, 2 = PAUSED
              if (state === 1) {
                setIsPlaying(true);
                if (!isApplyingRemoteRef.current) {
                  broadcastSync(true, target.getCurrentTime());
                }
              } else if (state === 2) {
                setIsPlaying(false);
                if (!isApplyingRemoteRef.current) {
                  broadcastSync(false, target.getCurrentTime());
                }
              }
            },
            onError: (event) => {
              if (!isMounted) return;
              const code = event.data;
              if (code === 101 || code === 150) {
                setYtError('The video owner does not allow embedding outside YouTube.');
              } else if (code === 100) {
                setYtError('YouTube video not found or has been removed.');
              } else {
                setYtError('Failed to load YouTube video.');
              }
            },
          },
        });
      } catch (err) {
        console.warn('Failed to construct YT.Player:', err);
      }
    };

    if (window.YT && window.YT.Player) {
      initPlayer();
    } else {
      // Inject YouTube IFrame API script if not present
      if (!document.getElementById('yt-iframe-api-script')) {
        const tag = document.createElement('script');
        tag.id = 'yt-iframe-api-script';
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
      }

      const prevCallback = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prevCallback?.();
        if (isMounted) initPlayer();
      };
    }

    return () => {
      isMounted = false;
      if (playerRef.current) {
        try {
          playerRef.current.destroy();
        } catch {
          // ignore
        }
        playerRef.current = null;
      }
    };
  }, [videoId, onDuration, broadcastSync]);

  // Listen for remote sync events
  useEffect(() => {
    if (!channel || !selfUserId) return;

    const handleSync = ({ payload }: { payload: unknown }) => {
      const msg = safeParseSyncMsg(payload);
      if (!msg || msg.from === selfUserId || !playerRef.current) return;

      const player = playerRef.current;
      isApplyingRemoteRef.current = true;

      try {
        const currentPos = player.getCurrentTime();
        const expected = expectedPos(msg, 0, Date.now());

        if (msg.playing) {
          const drift = Math.abs(currentPos - expected);
          if (drift > 1.5) {
            player.seekTo(expected, true);
          }
          player.playVideo();
          setIsPlaying(true);
        } else {
          player.pauseVideo();
          if (Math.abs(currentPos - msg.pos) > 1.0) {
            player.seekTo(msg.pos, true);
          }
          setIsPlaying(false);
        }
      } catch (e) {
        console.warn('YouTube sync action failed:', e);
      } finally {
        setTimeout(() => {
          isApplyingRemoteRef.current = false;
        }, 300);
      }
    };

    channel.on('broadcast', { event: 'sync' }, handleSync);
  }, [channel, selfUserId]);

  return (
    <div className="relative size-full overflow-hidden bg-black flex items-center justify-center select-none">
      {/* Top Floating Badge with Interactive Play/Pause button */}
      <div className="absolute top-2.5 sm:top-3 left-2.5 sm:left-3 z-30 flex items-center gap-1.5 select-none">
        <span className="rounded-full bg-red-600/90 text-white px-2 py-0.5 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider shadow-sm">
          YouTube
        </span>
        {roomCode && (
          <span className="rounded-full bg-black/70 border border-white/10 backdrop-blur-xs px-2 py-0.5 text-[9px] sm:text-[10px] font-mono font-medium text-primary">
            Room {roomCode}
          </span>
        )}
        <button
          type="button"
          onClick={togglePlay}
          className="rounded-full bg-black/70 hover:bg-black/90 border border-white/10 backdrop-blur-xs px-2.5 py-0.5 text-[9px] sm:text-[10px] text-tertiary font-medium cursor-pointer transition active:scale-95 shadow-sm flex items-center gap-1"
          aria-label={isPlaying ? 'Pause video' : 'Play video'}
        >
          <span>{isPlaying ? '❚❚' : '▶'}</span>
          <span>{isPlaying ? 'Playing' : 'Paused'}</span>
        </button>
      </div>

      {/* Action Toasts */}
      {actionToasts && actionToasts.length > 0 && (
        <div className="absolute top-2 sm:top-3 right-2 sm:right-3 z-30 flex flex-col items-end gap-1 pointer-events-none max-w-[60%] sm:max-w-xs">
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

      {/* YouTube IFrame Mount Target (full bleed inside container) */}
      <div className="relative size-full [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:size-full [&>iframe]:border-0">
        <div id={containerId.current} className="size-full" />
      </div>

      {/* Center Cinematic Play Button Overlay when Paused */}
      {!isPlaying && isReady && (
        <button
          type="button"
          onClick={togglePlay}
          className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/45 backdrop-blur-[2px] transition-all hover:bg-black/35 cursor-pointer group"
          aria-label="Play YouTube Video"
        >
          <div className="flex size-16 sm:size-20 items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-2xl transition-transform group-hover:scale-110 active:scale-95">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-8 sm:size-10 translate-x-0.5">
              <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
            </svg>
          </div>
          <span className="mt-2.5 text-xs font-semibold text-white/95 tracking-wide drop-shadow-md">
            Click to Play in Sync
          </span>
        </button>
      )}

      {/* Loading Overlay */}
      {!isReady && !ytError && (
        <div className="absolute inset-0 grid place-items-center bg-black/90 z-25 select-none">
          <div className="flex flex-col items-center gap-2">
            <span className="size-3 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs text-muted font-medium">Connecting YouTube Player…</span>
          </div>
        </div>
      )}

      {/* Error Overlay */}
      {ytError && (
        <div role="alert" className="absolute inset-0 grid place-items-center bg-black/95 p-4 z-30 text-center select-none">
          <div className="max-w-md flex flex-col items-center gap-2">
            <span className="text-2xl">⚠️</span>
            <p className="text-sm font-semibold text-danger">{ytError}</p>
            <p className="text-xs text-muted">
              Tip: You can also use <strong>Share Screen</strong> in the call panel to stream any YouTube video directly to your partner!
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
