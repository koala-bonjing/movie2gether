import { useEffect, useState } from 'react';
import { Button } from '../../ui';
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
}

export function PlayerView({
  onVideoRef,
  onMediaInfo,
  partnerBuffering = false,
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
        {source ? (
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
    </section>
  );
}
