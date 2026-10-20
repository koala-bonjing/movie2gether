import { memo } from 'react';
import { formatBitrate, formatResolution, type VideoStats } from '../features/call/webrtc';

export interface QualityBadgeProps {
  stats?: VideoStats | null;
  className?: string;
  compact?: boolean;
}

export const QualityBadge = memo(function QualityBadge({
  stats,
  className = '',
  compact = false,
}: QualityBadgeProps) {
  if (!stats || (!stats.width && !stats.fps && !stats.bitrateKbps)) {
    return null;
  }

  const res = formatResolution(stats.width, stats.height);
  const fps = stats.fps ? `${stats.fps}fps` : '';
  const bitrate = formatBitrate(stats.bitrateKbps);

  const parts = [res, fps, !compact && bitrate].filter(Boolean);
  const label = parts.join(' · ') || 'Live';

  return (
    <span
      data-testid="quality-badge"
      title={parts.join(' · ')}
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-2/90 px-2.5 py-0.5 font-mono text-[11px] font-medium text-text backdrop-blur-xs select-none ${className}`}
    >
      <span className="relative flex size-1.5">
        <span className="relative inline-flex size-1.5 rounded-full bg-accent" />
      </span>
      <span>{label}</span>
    </span>
  );
});
