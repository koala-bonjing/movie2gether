import { useEffect, useRef, useState } from 'react';
import { QualityBadge } from '../../ui';
import { requestKeepAwake, releaseKeepAwake } from '../../lib/keepAwake';
import type { VideoStats } from '../call/webrtc';
import { PlayerControls } from './PlayerControls';

export interface StreamPlayerViewProps {
  streamSource: MediaStream;
  container: HTMLElement | null;
  stats?: VideoStats | null;
  streamerName?: string;
  isTheater?: boolean;
  onToggleTheater?: () => void;
}

export function StreamPlayerView({
  streamSource,
  container,
  stats,
  streamerName,
  isTheater = false,
  onToggleTheater,
}: StreamPlayerViewProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = streamSource;
      videoRef.current.play().catch(() => {});
    }
  }, [streamSource]);

  // Request keep awake while actively viewing a stream
  useEffect(() => {
    void requestKeepAwake();
    return () => {
      void releaseKeepAwake();
    };
  }, []);

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
          isTheater={isTheater}
          onToggleTheater={onToggleTheater}
        />
      )}
    </div>
  );
}

export default StreamPlayerView;
