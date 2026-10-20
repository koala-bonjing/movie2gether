import { useEffect, useRef, memo } from 'react';
import type { VideoStats } from './webrtc';

export interface CamTileProps {
  stream: MediaStream | null;
  name: string;
  isLocal?: boolean;
  isCamOn?: boolean;
  isMicOn?: boolean;
  stats?: VideoStats | null;
  className?: string;
}

export const CamTile = memo(function CamTile({
  stream,
  name,
  isLocal = false,
  isCamOn = true,
  isMicOn = true,
  stats,
  className = '',
}: CamTileProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
      if (stream) {
        videoRef.current.play().catch(() => {
          // Autoplay handled by browser policy
        });
      }
    }
  }, [stream]);

  const hasVideoTrack = stream && stream.getVideoTracks().length > 0 && isCamOn;
  const initial = name.trim().charAt(0).toUpperCase() || '?';

  return (
    <div
      className={`relative overflow-hidden rounded-xl border border-border bg-surface-2 aspect-video flex items-center justify-center select-none shadow-sm ${className}`}
      data-testid={isLocal ? 'cam-tile-local' : 'cam-tile-remote'}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`h-full w-full object-cover transition-opacity duration-200 ${
          hasVideoTrack ? 'opacity-100' : 'opacity-0'
        } ${isLocal ? 'scale-x-[-1]' : ''}`}
      />

      {/* Fallback Avatar when camera is off or audio-only */}
      {!hasVideoTrack && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-surface-2/95 text-text">
          <div className="grid size-12 place-items-center rounded-full bg-accent/20 border border-accent/40 text-base font-bold text-accent">
            {initial}
          </div>
          <span className="text-[11px] font-medium text-muted">
            {isCamOn ? 'Audio only' : 'Camera off'}
          </span>
        </div>
      )}

      {/* Name and mic indicator bar */}
      <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between pointer-events-none">
        <span className="rounded-md bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur-xs truncate max-w-[70%]">
          {name} {isLocal && '(You)'}
        </span>

        <div className="flex items-center gap-1">
          {!isMicOn && (
            <span
              title="Microphone muted"
              className="grid size-5 place-items-center rounded-md bg-danger/80 text-white shadow-xs"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="size-3"
                aria-hidden="true"
              >
                <path d="M7.5 4.5a2.5 2.5 0 0 1 4.78-.962.75.75 0 0 0 1.44-.422A4.002 4.002 0 0 0 6 4.5v3.25a.75.75 0 0 0 1.5 0V4.5Z" />
                <path d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06L15.42 14.36A6.974 6.974 0 0 0 17 9.75a.75.75 0 0 0-1.5 0 5.474 5.474 0 0 1-1.39 3.638L12.5 11.78V4.5a2.5 2.5 0 0 0-5 0v3.25a.75.75 0 0 1-1.5 0V4.5c0-.69.28-1.317.734-1.77L3.28 2.22ZM10 15.5a5.48 5.48 0 0 1-4.5-2.35.75.75 0 0 0-1.22.875A6.98 6.98 0 0 0 9.25 17v1.5a.75.75 0 0 0 1.5 0V17c.56 0 1.1-.065 1.62-.186l-1.34-1.34c-.332.018-.675.026-1.03.026Z" />
              </svg>
            </span>
          )}

          {stats?.width && stats.height && (
            <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-mono text-muted backdrop-blur-xs">
              {stats.width}x{stats.height} {stats.fps ? `${stats.fps}fps` : ''}
            </span>
          )}
        </div>
      </div>
    </div>
  );
});
