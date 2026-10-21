import { useState } from 'react';
import type { UseSyncReturn } from './useSync';

export interface SyncDevOverlayProps {
  sync: UseSyncReturn;
  roomCode: string;
}

export function SyncDevOverlay({ sync, roomCode }: SyncDevOverlayProps) {
  const [collapsed, setCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );

  // In non-dev environments, do not render unless explicitly in test/preview
  if (!import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    return null;
  }

  const driftMs = Math.round(sync.drift * 1000);
  const offsetMs = Math.round(sync.clockOffset);

  return (
    <div
      data-testid="sync-dev-overlay"
      className="fixed bottom-4 left-4 z-40 max-w-xs rounded-md border border-border/80 bg-surface/95 p-3 font-mono text-[11px] text-text shadow-xl backdrop-blur-md"
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-1.5 mb-2">
        <span className="font-semibold text-accent uppercase tracking-wider text-[10px]">Sync Debug HUD</span>
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="text-muted hover:text-text px-1 text-[10px]"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▲' : '▼'}
        </button>
      </div>

      {!collapsed && (
        <div className="space-y-1 text-muted">
          <div className="flex justify-between gap-4">
            <span>Room Code:</span>
            <span className="text-text font-bold">{roomCode}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Role:</span>
            <span className={sync.isController ? 'text-accent font-semibold' : 'text-text'}>
              {sync.isController ? 'Controller (Local)' : sync.controllerId ? 'Replica (Partner dictating)' : 'Unassigned'}
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Seq:</span>
            <span className="text-text">{sync.seq}</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Clock Offset:</span>
            <span className={Math.abs(offsetMs) > 100 ? 'text-warn' : 'text-text'}>
              {offsetMs >= 0 ? `+${offsetMs}` : offsetMs} ms
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span>RTT:</span>
            <span className="text-text">{Math.round(sync.rtt)} ms</span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Current Drift:</span>
            <span className={Math.abs(sync.drift) > 0.25 ? 'text-warn font-semibold' : 'text-text'}>
              {driftMs >= 0 ? `+${driftMs}` : driftMs} ms
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span>Buffering:</span>
            <span className="text-text">
              {sync.selfBuffering ? 'Self buffering' : sync.partnerBuffering ? 'Partner buffering' : 'None'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
