import { StatusDot } from '../../ui';

export interface DriftIndicatorProps {
  drift: number; // in seconds
  onSyncNow?: () => void;
  className?: string;
}

export function DriftIndicator({ drift, onSyncNow, className = '' }: DriftIndicatorProps) {
  const abs = Math.abs(drift);
  const ms = Math.round(abs * 1000);

  let status: 'online' | 'warn' | 'offline' = 'online';
  let label = 'In sync';

  if (abs >= 2.0) {
    status = 'offline';
    label = `${(drift > 0 ? '+' : '-') + (ms / 1000).toFixed(1)}s drift`;
  } else if (abs >= 0.25) {
    status = 'warn';
    label = `${drift > 0 ? '+' : '-'}${ms}ms drift`;
  }

  return (
    <button
      type="button"
      onClick={onSyncNow}
      title="Click to sync now"
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs text-muted transition hover:border-accent hover:text-text ${className}`}
    >
      <StatusDot status={status} />
      <span>{label}</span>
      {abs >= 1.0 && (
        <span className="ml-1 rounded-sm bg-accent/20 px-1 py-0.2 text-[10px] font-medium text-accent">
          Sync now
        </span>
      )}
    </button>
  );
}
