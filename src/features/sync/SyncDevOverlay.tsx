import { useState } from 'react';
import type { UseSyncReturn } from './useSync';

export interface SyncDevOverlayProps {
  sync: UseSyncReturn;
  roomCode: string;
  isOpen?: boolean;
  onToggle?: () => void;
}

export function SyncDevOverlay({ sync, roomCode, isOpen, onToggle }: SyncDevOverlayProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 768,
  );

  const isExplicit = isOpen !== undefined;
  // If controlled, obey isOpen. Otherwise, only show in dev/test.
  if (!isExplicit && !import.meta.env.DEV && import.meta.env.MODE !== 'test') {
    return null;
  }
  if (isExplicit && !isOpen) {
    return null;
  }

  const collapsed = isExplicit ? false : internalCollapsed;
  const toggleCollapse = onToggle || (() => setInternalCollapsed(!internalCollapsed));

  const driftMs = Math.round(sync.drift * 1000);
  const offsetMs = Math.round(sync.clockOffset);

  return (
    <div
      data-testid="sync-dev-overlay"
      className="w-full rounded-xl border border-outline/30 bg-surface-container-low p-2.5 font-mono-sm text-[11px] text-text shadow-xs"
    >
      <div className={`flex items-center justify-between gap-3 ${collapsed ? '' : 'border-b border-outline/20 pb-2 mb-2'}`}>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary motion-safe:animate-pulse" />
          <span className="font-semibold text-primary uppercase tracking-wider text-[10px]">Sync Debug HUD</span>
        </div>
        <button
          type="button"
          onClick={toggleCollapse}
          className="text-muted hover:text-text px-1 text-[10px] cursor-pointer"
          title={collapsed ? 'Expand' : 'Collapse'}
        >
          {collapsed ? '▲ Expand' : '▼ Minimize'}
        </button>
      </div>

      {!collapsed && (
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5 text-muted">
          <div>
            <span className="block text-[10px] uppercase text-muted/80">Room Code:</span>
            <span className="text-primary font-bold">{roomCode}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-muted/80">Role:</span>
            <span className={sync.isController ? 'text-primary font-semibold' : 'text-text'}>
              {sync.isController ? 'Controller' : sync.controllerId ? 'Replica' : 'Unassigned'}
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-muted/80">Seq:</span>
            <span className="text-text">{sync.seq}</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-muted/80">Offset:</span>
            <span className={Math.abs(offsetMs) > 100 ? 'text-warn' : 'text-text'}>
              {offsetMs >= 0 ? `+${offsetMs}` : offsetMs} ms
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-muted/80">RTT:</span>
            <span className="text-text">{Math.round(sync.rtt)} ms</span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-muted/80">Drift:</span>
            <span className={Math.abs(sync.drift) > 0.25 ? 'text-warn font-semibold' : 'text-text'}>
              {driftMs >= 0 ? `+${driftMs}` : driftMs} ms
            </span>
          </div>
          <div>
            <span className="block text-[10px] uppercase text-muted/80">Buffering:</span>
            <span className="text-text">
              {sync.selfBuffering ? 'Self buffering' : sync.partnerBuffering ? 'Partner' : 'None'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
