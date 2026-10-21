import { useState, type ReactNode } from 'react';
import { Button, StatusDot, QualityBadge, Avatar } from '../../ui';
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
  isCamOn?: boolean;
  isMicOn?: boolean;
  onToggleCam?: () => void;
  onToggleMic?: () => void;
  activeNavTab?: 'theater' | 'chat' | 'settings';
  onNavTabChange?: (tab: 'theater' | 'chat' | 'settings') => void;
}

export function RoomHeader({
  roomCode,
  status,
  self,
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
  isCamOn = true,
  isMicOn = true,
  onToggleCam,
  onToggleMic,
  activeNavTab = 'theater',
  onNavTabChange,
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

      {/* Navigation tabs (Theater, Chat, Settings) */}
      <nav aria-label="Room views" className="hidden lg:flex items-center gap-1 rounded-full border border-outline/40 bg-surface-container p-1 text-xs">
        <button
          type="button"
          onClick={() => onNavTabChange?.('theater')}
          className={`rounded-full px-3 py-1 font-semibold transition cursor-pointer ${
            activeNavTab === 'theater'
              ? 'bg-primary-container text-on-primary-container shadow-xs'
              : 'text-muted hover:text-text'
          }`}
        >
          Theater
        </button>
        <button
          type="button"
          onClick={() => {
            onNavTabChange?.('chat');
            if (onToggleChat && !chatOpen) onToggleChat();
          }}
          className={`relative inline-flex items-center gap-1 rounded-full px-3 py-1 font-semibold transition cursor-pointer ${
            activeNavTab === 'chat'
              ? 'bg-primary-container text-on-primary-container shadow-xs'
              : 'text-muted hover:text-text'
          }`}
        >
          <span>Chat</span>
          {unreadCount > 0 && (
            <span className="size-2 rounded-full bg-primary" />
          )}
        </button>
        <button
          type="button"
          onClick={() => onNavTabChange?.('settings')}
          className={`rounded-full px-3 py-1 font-semibold transition cursor-pointer ${
            activeNavTab === 'settings'
              ? 'bg-primary-container text-on-primary-container shadow-xs'
              : 'text-muted hover:text-text'
          }`}
        >
          Settings
        </button>
      </nav>

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

        {/* Mic/Cam Quick Toggles */}
        {onToggleMic && (
          <button
            type="button"
            onClick={onToggleMic}
            title={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
            aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
            className={`grid size-8 place-items-center rounded-full border transition active:scale-95 cursor-pointer ${
              isMicOn
                ? 'border-outline/40 bg-surface-container text-text hover:bg-surface-container-high'
                : 'border-danger/40 bg-danger/20 text-danger'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
              <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0V4Z" />
              <path d="M5.5 9.643a.75.75 0 0 0-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.546A6.001 6.001 0 0 0 16 10v-.357a.75.75 0 0 0-1.5 0V10a4.5 4.5 0 0 1-9 0v-.357Z" />
            </svg>
          </button>
        )}

        {onToggleCam && (
          <button
            type="button"
            onClick={onToggleCam}
            title={isCamOn ? 'Turn off camera' : 'Turn on camera'}
            aria-label={isCamOn ? 'Turn off camera' : 'Turn on camera'}
            className={`grid size-8 place-items-center rounded-full border transition active:scale-95 cursor-pointer ${
              isCamOn
                ? 'border-outline/40 bg-surface-container text-text hover:bg-surface-container-high'
                : 'border-danger/40 bg-danger/20 text-danger'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
              <path d="M3.25 4A2.25 2.25 0 0 0 1 6.25v7.5A2.25 2.25 0 0 0 3.25 16h7.5A2.25 2.25 0 0 0 13 13.75v-7.5A2.25 2.25 0 0 0 10.75 4h-7.5ZM14.5 7.025v5.95l3.58 2.046a.75.75 0 0 0 1.17-.653V5.632a.75.75 0 0 0-1.17-.653L14.5 7.025Z" />
            </svg>
          </button>
        )}

        {actions}

        <ThemePicker />

        {/* Self Avatar */}
        <Avatar
          name={self?.name || 'You'}
          size="sm"
          status={status === 'connected' ? 'online' : 'muted'}
          title={`Logged in as ${self?.name || 'You'}`}
        />

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
