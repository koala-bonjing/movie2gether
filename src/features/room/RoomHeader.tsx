import { useState, type ReactNode } from 'react';
import { Button, StatusDot, QualityBadge } from '../../ui';
import type { RoomPeer, RoomConnectionStatus, PartnerConnectionStatus } from './useRoom';
import { isUsingMock } from '../../lib/supabase';
import type { VideoStats } from '../call/webrtc';

import { DriftIndicator } from '../sync/DriftIndicator';
import { ThemePicker } from '../theme';

export interface RoomHeaderProps {
  roomCode: string;
  status: RoomConnectionStatus;
  self: RoomPeer | null;
  partner: RoomPeer | null;
  partnerStatus?: PartnerConnectionStatus;
  drift?: number;
  onSyncNow?: () => void;
  onLeave: () => void;
  chatOpen?: boolean;
  onToggleChat?: () => void;
  unreadCount?: number;
  stats?: VideoStats | null;
  isStreamMode?: boolean;
  actions?: ReactNode;
}

export function RoomHeader({
  roomCode,
  status,
  partner,
  partnerStatus = 'waiting',
  drift = 0,
  onSyncNow,
  onLeave,
  chatOpen = true,
  onToggleChat,
  unreadCount = 0,
  stats,
  isStreamMode = false,
  actions,
}: RoomHeaderProps) {
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
                <StatusDot status="online" />
                <span className="font-medium text-text">{partner.name}</span>
              </>
            ) : partnerStatus === 'left' ? (
              <>
                <StatusDot status="warn" />
                <span className="text-warn">Partner left</span>
              </>
            ) : (
              <>
                <StatusDot status="warn" pulse />
                <span className="text-muted">Waiting for partner…</span>
              </>
            )
          ) : status === 'reconnecting' ? (
            <>
              <StatusDot status="warn" pulse label="Reconnecting" />
              <span className="text-warn">Reconnecting…</span>
            </>
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

        {partner && onSyncNow && !isStreamMode && (
          <DriftIndicator drift={drift} onSyncNow={onSyncNow} />
        )}

        {isStreamMode && (
          <span className="flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent border border-accent/30">
            <span className="size-1.5 rounded-full bg-accent motion-safe:animate-pulse" />
            Stream Mode
          </span>
        )}

        {stats && <QualityBadge stats={stats} />}

        {actions}

        <ThemePicker />

        {isUsingMock && (
          <span className="hidden sm:inline-block rounded-full bg-accent-2/10 px-2 py-0.5 text-[11px] font-medium text-accent-2 border border-accent-2/20">
            Local sync mode
          </span>
        )}

        {onToggleChat && (
          <button
            type="button"
            onClick={onToggleChat}
            aria-label={chatOpen ? 'Hide chat' : 'Show chat'}
            className={`relative inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-medium transition ${
              chatOpen
                ? 'bg-accent/20 text-text border-accent/40'
                : 'bg-surface-2 text-muted hover:text-text'
            }`}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-3.5"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M10 2c-2.236 0-4.43.18-6.57.532a2.25 2.25 0 0 0-1.88 2.2V11c0 1.25.98 2.26 2.23 2.3 1.34.04 2.68.12 4.02.24l2.67 2.14a.75.75 0 0 0 1.23-.58v-1.63c1.78-.17 3.52-.45 5.2-.83a2.25 2.25 0 0 0 1.88-2.2V4.732a2.25 2.25 0 0 0-1.88-2.2A49.19 49.19 0 0 0 10 2Z"
                clipRule="evenodd"
              />
            </svg>
            <span>Chat</span>
            {unreadCount > 0 && (
              <span
                data-testid="chat-unread-badge"
                className="rounded-full bg-accent px-1.5 py-0.2 text-[10px] font-bold text-bg leading-tight"
              >
                {unreadCount}
              </span>
            )}
          </button>
        )}

        <Button variant="ghost" onClick={onLeave} className="h-8 px-3 text-xs text-muted hover:text-danger">
          Leave
        </Button>
      </div>
    </header>
  );
}
