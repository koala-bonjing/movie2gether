import { useEffect, useState, useRef } from 'react';
import { Button, QualityBadge } from '../../ui';
import type { VideoStats } from '../call/webrtc';
import { FilePickerCard } from './FilePickerCard';
import { PlayerControls } from './PlayerControls';
import { fingerprint, formatTime, type MediaInfo } from './media';

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
}: PlayerViewProps = {}) {
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [video, setVideo] = useState<HTMLVideoElement | null>(null);
  const [source, setSource] = useState<Source | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [info, setInfo] = useState<MediaInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const load = (next: Source) => {
    setSource(next);
    setMeta(null);
    setInfo(null);
    setError(null);
    container?.focus(); // move focus to the player so keyboard shortcuts work right away
  };

  return (
    <section className="flex flex-col gap-4">
      <div
        ref={setContainer}
        tabIndex={-1}
        className="group relative aspect-video w-full overflow-hidden rounded-md bg-black outline-none"
      >
        {isStreamMode ? (
          isScreenSharing ? (
            <div className="flex flex-col items-center justify-center size-full gap-3 bg-surface-2 p-6 text-center select-none" data-testid="screen-stream-local">
              <div className="grid size-14 place-items-center rounded-full bg-accent/20 border border-accent/40 text-accent">
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
            <StreamPlayerView
              streamSource={streamSource}
              container={container}
              stats={stats}
              streamerName={streamerName}
            />
          ) : (
            <div className="grid size-full place-items-center p-4 text-center text-muted select-none">
              <div className="flex items-center gap-2">
                <span className="size-2 rounded-full bg-accent motion-safe:animate-ping" />
                <span>Connecting to screen stream…</span>
              </div>
            </div>
          )
        ) : source ? (
          <>
            <video
              ref={setVideo}
              src={source.src}
              playsInline
              className="size-full object-contain"
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
            />
            {error ? (
              <div role="alert" className="absolute inset-0 grid place-items-center overflow-auto bg-black/85 p-4">
                <div className="flex max-w-lg flex-col gap-2 text-center">
                  <p className="text-lg font-medium">{error}</p>
                  {source.file && (
                    <>
                      <p className="text-sm text-muted">
                        MP4 with H.264 video and AAC audio plays everywhere. Make a copy with ffmpeg:
                      </p>
                      <code className="rounded-sm bg-surface-2 p-2 text-left text-xs break-all">
                        ffmpeg -i input.mkv -c copy output.mp4
                      </code>
                      <p className="text-xs text-muted">Still failing (HEVC video or AC3/DTS audio)? Re-encode:</p>
                      <code className="rounded-sm bg-surface-2 p-2 text-left text-xs break-all">
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
                {video && container && <PlayerControls video={video} container={container} />}
                {partnerBuffering && (
                  <div
                    role="status"
                    className="absolute inset-0 z-30 grid place-items-center bg-black/60 pointer-events-none"
                  >
                    <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm text-text shadow-lg">
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

      {isStreamMode ? (
        <div className="flex items-center justify-between rounded-md border border-accent/20 bg-accent/5 p-3 text-xs text-muted">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-accent" />
            <span>Room is in Stream Mode. Local video file sync is paused.</span>
          </div>
          {isScreenSharing && onStopScreenShare && (
            <button
              type="button"
              onClick={onStopScreenShare}
              className="text-accent underline font-medium hover:opacity-80"
            >
              Stop Sharing
            </button>
          )}
        </div>
      ) : (
        <>
          {source && (
            <p className="text-sm break-all text-muted">
              <span className="text-text">{source.label}</span>
              {meta && ` · ${meta.width}×${meta.height} · ${formatTime(meta.duration)}`}
              {source.file && ` · ${mb.format(source.file.size / 1e6)}`}
              {info && (
                <>
                  {' · '}
                  <code title={info.hash}>{info.hash.slice(0, 12)}</code>
                </>
              )}
            </p>
          )}

          <FilePickerCard
            onFile={(file) => load({ src: URL.createObjectURL(file), label: file.name, file })}
            onUrl={(url) => load({ src: url, label: url })}
          />
        </>
      )}
    </section>
  );
}

function StreamPlayerView({
  streamSource,
  container,
  stats,
  streamerName,
}: {
  streamSource: MediaStream;
  container: HTMLElement | null;
  stats?: VideoStats | null;
  streamerName?: string;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = streamSource;
      videoRef.current.play().catch(() => {});
    }
  }, [streamSource]);

  const handleVideoRef = (el: HTMLVideoElement | null) => {
    videoRef.current = el;
    setVideoElement(el);
  };

  return (
    <div className="relative size-full" data-testid="screen-stream-remote">
      <video
        ref={handleVideoRef}
        autoPlay
        playsInline
        className="size-full object-contain"
      />
      <div className="absolute top-3 left-3 z-20 flex items-center gap-2 rounded-full bg-black/70 border border-white/10 px-3 py-1 backdrop-blur-xs select-none">
        <span className="flex items-center gap-1.5 text-xs font-semibold text-text">
          <span className="size-2 rounded-full bg-danger animate-pulse" />
          <span>Screen: {streamerName || 'Partner'}</span>
        </span>
        {stats && <QualityBadge stats={stats} />}
      </div>
      {videoElement && container && (
        <PlayerControls
          video={videoElement}
          container={container}
          isStream={true}
          stats={stats}
        />
      )}
    </div>
  );
}

