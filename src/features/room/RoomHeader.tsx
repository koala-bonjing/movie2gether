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
  const [copiedKind, setCopiedKind] = useState<'code' | 'link' | null>(null);

  const handleCopy = async () => {
    try {
      await navigator.clipboard?.writeText(roomCode);
      setCopiedKind('code');
      setTimeout(() => setCopiedKind(null), 2000);
    } catch {
      // ignore
    }
  };

  const handleCopyLink = async () => {
    if (typeof window !== 'undefined') {
      try {
        const url = `${window.location.origin}?room=${roomCode}`;
        await navigator.clipboard?.writeText(url);
        setCopiedKind('link');
        setTimeout(() => setCopiedKind(null), 2000);
      } catch {
        // ignore
      }
    }
  };

  return (
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-outline/30 pb-4">
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Brand with Twin-Ring Cinema Motif */}
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-full bg-gradient-to-tr from-[#e8a0bf] via-[#ffd8e6] to-[#f2c57c] p-[1.5px] shadow-sm">
            <div className="flex size-full items-center justify-center rounded-full bg-surface-container-lowest text-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-3.5 translate-x-0.5"
                aria-hidden="true"
              >
                <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
            </div>
          </div>
          <h1 className="text-lg font-bold tracking-tight text-text">Duet</h1>
        </div>

        {/* Room Code Badge */}
        <div className="flex items-center gap-1.5 rounded-full border border-outline/40 bg-surface-container-low px-3 py-1 text-xs shadow-xs">
          <span className="text-[11px] font-medium text-muted">Room:</span>
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 font-mono-sm text-xs font-bold text-primary transition hover:underline"
            title="Click to copy room code"
            aria-label={`Copy room code ${roomCode}`}
          >
            <span>{roomCode}</span>
            <span className="text-[10px] text-muted">
              {copiedKind === 'code' ? '✓ Copied' : '⧉'}
            </span>
          </button>
          <button
            type="button"
            onClick={handleCopyLink}
            className="text-[10px] text-muted hover:text-text border-l border-outline/40 pl-2 transition"
            title="Copy invite link"
            aria-label="Copy invite link"
          >
            {copiedKind === 'link' ? '✓ Link copied' : 'Share'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {/* Partner Presence & Sync Status Pill */}
        <div className="flex items-center gap-2 rounded-full border border-outline/40 bg-surface-container px-3 py-1 text-xs shadow-xs">
          {status === 'connected' ? (
            partner ? (
              <div className="flex items-center gap-1.5">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-tertiary opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-tertiary" />
                </span>
                <span className="font-semibold text-text">{partner.name}</span>
                <span className="text-[11px] text-tertiary">· Connected</span>
              </div>
            ) : partnerStatus === 'left' ? (
              <>
                <StatusDot status="warn" />
                <span className="text-warn font-medium">Partner left</span>
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
              <span className="text-warn font-medium">Reconnecting…</span>
            </>
          ) : status === 'connecting' ? (
            <>
              <StatusDot status="muted" pulse label="Connecting" />
              <span className="text-muted">Connecting…</span>
            </>
          ) : (
            <>
              <StatusDot status="offline" label="Disconnected" />
              <span className="text-error font-medium">Disconnected</span>
            </>
          )}
        </div>

        {partner && onSyncNow && !isStreamMode && (
          <DriftIndicator drift={drift} onSyncNow={onSyncNow} />
        )}

        {/* WebRTC P2P Direct Status Indicator */}
        <span className="hidden md:flex items-center gap-1.5 rounded-full bg-surface-container-low border border-outline/30 px-2.5 py-1 text-[11px] font-medium text-muted">
          <span className="size-1.5 rounded-full bg-tertiary" />
          WebRTC P2P Direct
        </span>

        {/* Local sync mode chip */}
        {isUsingMock && (
          <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-primary-container/15 px-2.5 py-1 text-[11px] font-medium text-primary border border-primary-container/30">
            <span className="size-1.5 rounded-full bg-primary" />
            Local sync mode
          </span>
        )}

        {isStreamMode && (
          <span className="flex items-center gap-1.5 rounded-full bg-primary-container/20 px-2.5 py-1 text-xs font-semibold text-primary border border-primary-container/40 shadow-xs">
            <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
            Stream Mode
          </span>
        )}

        {stats && <QualityBadge stats={stats} />}

        {actions}

        <ThemePicker />

        {onToggleChat && (
          <button
            type="button"
            onClick={onToggleChat}
            aria-label={chatOpen ? 'Hide chat' : 'Show chat'}
            className={`relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition active:scale-95 cursor-pointer ${
              chatOpen
                ? 'bg-primary-container/20 text-text border-primary-container/50 shadow-xs'
                : 'bg-surface-container text-muted border-outline/40 hover:text-text'
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
                className="rounded-full bg-primary-container px-1.5 py-0.2 text-[10px] font-bold text-on-primary-container leading-tight"
              >
                {unreadCount}
              </span>
            )}
          </button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={onLeave}
          className="text-error hover:bg-error/15 border border-error/30 hover:border-error/50 font-medium"
        >
          Leave
        </Button>
      </div>
    </header>
  );
}
