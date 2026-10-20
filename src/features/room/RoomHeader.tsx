import { useState } from 'react';
import { Button, StatusDot } from '../../ui';
import type { RoomPeer, RoomConnectionStatus } from './useRoom';
import { isUsingMock } from '../../lib/supabase';

export interface RoomHeaderProps {
  roomCode: string;
  status: RoomConnectionStatus;
  self: RoomPeer | null;
  partner: RoomPeer | null;
  onLeave: () => void;
}

export function RoomHeader({ roomCode, status, partner, onLeave }: RoomHeaderProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard?.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border/60 pb-4">
      <div className="flex items-center gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-text">Duet</h1>
          <div className="flex items-center gap-2 text-xs text-muted">
            <span>Room:</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-sm bg-surface-2 px-2 py-0.5 font-mono text-xs font-semibold text-text transition hover:border-accent hover:text-accent border border-border"
              title="Click to copy room code"
            >
              <span>{roomCode}</span>
              <span className="text-[10px] text-muted">{copied ? '✓ Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs">
          {status === 'connected' ? (
            partner ? (
              <>
                <StatusDot status="online" label="Partner connected" />
                <span className="font-medium text-text">{partner.name}</span>
              </>
            ) : (
              <>
                <StatusDot status="warn" pulse label="Waiting for partner" />
                <span className="text-muted">Waiting for partner…</span>
              </>
            )
          ) : status === 'connecting' ? (
            <>
              <StatusDot status="muted" pulse label="Connecting" />
              <span className="text-muted">Connecting…</span>
            </>
          ) : (
            <>
              <StatusDot status="offline" label="Disconnected" />
              <span className="text-danger">Disconnected</span>
            </>
          )}
        </div>

        {isUsingMock && (
          <span className="hidden sm:inline-block rounded-full bg-accent-2/10 px-2 py-0.5 text-[11px] font-medium text-accent-2 border border-accent-2/20">
            Local sync mode
          </span>
        )}

        <Button variant="ghost" onClick={onLeave} className="h-8 px-3 text-xs text-muted hover:text-danger">
          Leave
        </Button>
      </div>
    </header>
  );
}
