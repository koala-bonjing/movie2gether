import { useState, type ReactNode } from 'react';
import { Button, StatusDot, QualityBadge, Avatar } from '../../ui';
import type { RoomPeer, RoomConnectionStatus, PartnerConnectionStatus } from './useRoom';
import { isUsingMock, supabase } from '../../lib/supabase';
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
  activeNavTab?: 'theater' | 'library' | 'synclab' | 'settings';
  onNavTabChange?: (tab: 'theater' | 'library' | 'synclab' | 'settings') => void;
  onToggleSyncLab?: () => void;
  isMobile?: boolean;
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
  onToggleSyncLab,
  isMobile = false,
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

  if (isMobile) {
    return (
      <header className="sticky top-0 z-40 flex items-center justify-between gap-2 border-b border-outline/30 bg-surface/95 px-3 py-2.5 pt-safe backdrop-blur-md shadow-xs">
        {/* Brand with Twin-Ring Cinema Motif */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-tr from-[#e8a0bf] via-[#ffd8e6] to-[#f2c57c] p-[1.5px] shadow-sm">
            <div className="flex size-full items-center justify-center rounded-full bg-surface-container-lowest text-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-3 translate-x-0.5"
                aria-hidden="true"
              >
                <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
            </div>
          </div>
          <h1 className="text-base font-bold tracking-tight text-text">Duet</h1>
        </div>

        {/* Mobile Partner Status Pill: Sonny (In sync) [CODE] */}
        <div className="flex items-center gap-1.5 rounded-full border border-outline/40 bg-surface-container px-2.5 py-1 text-xs shadow-xs min-w-0 max-w-[210px]">
          {status === 'connected' ? (
            partner ? (
              <div className="flex items-center gap-1 min-w-0 truncate">
                <span className="relative flex size-2 shrink-0">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-tertiary opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-tertiary" />
                </span>
                <span className="font-semibold text-text truncate text-[11px]">{partner.name}</span>
                <span className="text-[10px] text-tertiary font-medium shrink-0">
                  ({Math.abs(drift) < 0.05 ? 'In sync' : `${Math.round(Math.abs(drift) * 1000)}ms`})
                </span>
              </div>
            ) : partnerStatus === 'left' ? (
              <div className="flex items-center gap-1 text-warn text-[11px] font-medium truncate">
                <StatusDot status="warn" />
                <span className="truncate">Partner left</span>
              </div>
            ) : (
              <div className="flex items-center gap-1 text-muted text-[11px] truncate">
                <StatusDot status="warn" pulse />
                <span className="truncate">Waiting for partner…</span>
              </div>
            )
          ) : (
            <div className="flex items-center gap-1 text-muted text-[11px] truncate">
              <StatusDot status="muted" pulse />
              <span className="truncate">Connecting…</span>
            </div>
          )}

          {/* Room Code Badge */}
          <button
            type="button"
            onClick={handleCopy}
            className="shrink-0 font-mono-sm text-[10px] font-bold text-primary hover:underline ml-0.5 border-l border-outline/40 pl-1.5"
            title="Click to copy code"
            aria-label={`Copy room code ${roomCode}`}
          >
            <span className="text-muted font-normal">Room: </span>
            <span>[{roomCode}]</span>
          </button>
        </div>

        {/* Right actions: Theme & Leave */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ThemePicker />
          <Button
            variant="ghost"
            size="sm"
            onClick={onLeave}
            className="text-error hover:bg-error/15 border border-error/30 hover:border-error/50 font-medium text-xs px-2.5 py-1 h-7 cursor-pointer"
          >
            Leave
          </Button>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-outline/30 bg-surface/95 backdrop-blur-md shadow-xs select-none">
      {/* Fixed h-12 Header Bar with drag region, branding, center nav tabs, right AV controls */}
      <div data-tauri-drag-region className="flex h-12 w-full max-w-[1920px] mx-auto items-center justify-between px-4">
        {/* Left: Branding & Room Code Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-full bg-gradient-to-tr from-[#e8a0bf] via-[#ffd8e6] to-[#f2c57c] p-[1.5px] shadow-sm">
              <div className="flex size-full items-center justify-center rounded-full bg-surface-container-lowest text-primary">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="size-3 translate-x-0.5"
                  aria-hidden="true"
                >
                  <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                </svg>
              </div>
            </div>
            <h1 className="text-base font-bold tracking-tight text-text">Duet</h1>
          </div>

          {/* Room Code Badge */}
          <div className="flex items-center gap-1.5 rounded-full border border-outline/40 bg-surface-container-low px-2.5 py-0.5 text-xs shadow-xs">
            <span className="text-[11px] font-medium text-muted">Room:</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1 font-mono-sm text-xs font-bold text-primary transition hover:underline cursor-pointer"
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
              className="text-[10px] text-muted hover:text-text border-l border-outline/40 pl-1.5 transition cursor-pointer"
              title="Copy invite link"
              aria-label="Copy invite link"
            >
              {copiedKind === 'link' ? '✓ Link copied' : 'Share'}
            </button>
          </div>
        </div>

        {/* Center: Nav Tabs (Theater, Media Library, Sync Lab, Settings) */}
        <nav className="hidden md:flex items-center gap-1 rounded-full border border-outline/30 bg-surface-container-low p-1 shadow-xs text-xs font-semibold">
          <button
            type="button"
            onClick={() => onNavTabChange?.('theater')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition cursor-pointer ${
              activeNavTab === 'theater'
                ? 'bg-primary-container text-on-primary-container shadow-xs font-bold'
                : 'text-muted hover:text-text'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
              <path d="M3.25 4A2.25 2.25 0 0 0 1 6.25v7.5A2.25 2.25 0 0 0 3.25 16h7.5A2.25 2.25 0 0 0 13 13.75v-7.5A2.25 2.25 0 0 0 10.75 4h-7.5ZM14.5 7.025v5.95l3.58 2.046a.75.75 0 0 0 1.17-.653V5.632a.75.75 0 0 0-1.17-.653L14.5 7.025Z" />
            </svg>
            <span>Theater</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavTabChange?.('library');
              const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
              fileInput?.click();
            }}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition cursor-pointer ${
              activeNavTab === 'library'
                ? 'bg-primary-container text-on-primary-container shadow-xs font-bold'
                : 'text-muted hover:text-text'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
              <path d="M2 4.25A2.25 2.25 0 0 1 4.25 2h2.5A2.25 2.25 0 0 1 9 4.25v.75h7A2 2 0 0 1 18 7v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4.25Z" />
            </svg>
            <span>Media Library</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onNavTabChange?.('synclab');
              onToggleSyncLab?.();
            }}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition cursor-pointer ${
              activeNavTab === 'synclab'
                ? 'bg-primary-container text-on-primary-container shadow-xs font-bold'
                : 'text-muted hover:text-text'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
              <path fillRule="evenodd" d="M15.312 11.424a5.5 5.5 0 0 1-9.201 2.466l-.312-.311h2.433a.75.75 0 0 0 0-1.5H3.75a.75.75 0 0 0-.75.75v4.482a.75.75 0 0 0 1.5 0v-2.099l.348.348a7 7 0 0 0 11.758-3.136.75.75 0 0 0-1.294-.7Z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M4.688 8.576a5.5 5.5 0 0 1 9.201-2.466l.312.311h-2.433a.75.75 0 0 0 0 1.5H16.25a.75.75 0 0 0 .75-.75V2.69a.75.75 0 0 0-1.5 0v2.099l-.348-.348A7 7 0 0 0 3.394 7.577a.75.75 0 1 0 1.294.699Z" clipRule="evenodd" />
            </svg>
            <span>Sync Lab</span>
          </button>

          <button
            type="button"
            onClick={() => onNavTabChange?.('settings')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 transition cursor-pointer ${
              activeNavTab === 'settings'
                ? 'bg-primary-container text-on-primary-container shadow-xs font-bold'
                : 'text-muted hover:text-text'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
              <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
            </svg>
            <span>Settings</span>
          </button>
        </nav>

        {/* Right: AV controls (mic, cam), Theme toggle, and user avatar */}
        <div className="flex items-center gap-2">
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

          <ThemePicker />

          <Avatar
            name={self?.name || 'You'}
            size="sm"
            status={status === 'connected' ? 'online' : 'muted'}
            title={`Logged in as ${self?.name || 'You'}`}
          />
        </div>
      </div>

      {/* Top Sync Control Bar: Full-width container */}
      <div className="w-full border-t border-outline/20 bg-surface-container/60 px-4 py-1.5">
        <div className="flex w-full max-w-[1920px] mx-auto items-center justify-between gap-3 text-xs">
          {/* Partner presence pill + status chips */}
          <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
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

            {(isUsingMock || supabase.isMock) && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-container/15 px-2.5 py-0.5 text-[11px] font-medium text-primary border border-primary-container/30">
                <span className="size-1.5 rounded-full bg-primary" />
                Local sync mode
              </span>
            )}

            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-surface-container-low border border-outline/30 px-2.5 py-0.5 text-[11px] font-medium text-muted">
              <span className="size-1.5 rounded-full bg-tertiary" />
              WebRTC P2P Direct
            </span>

            {isStreamMode && (
              <span className="flex items-center gap-1.5 rounded-full bg-primary-container/20 px-2.5 py-0.5 text-xs font-semibold text-primary border border-primary-container/40 shadow-xs">
                <span className="size-1.5 rounded-full bg-primary motion-safe:animate-pulse" />
                Stream Mode
              </span>
            )}

            {stats && <QualityBadge stats={stats} />}
            {actions}
          </div>

          {/* Right area: Chat toggle button with unread counter, Leave button */}
          <div className="flex items-center gap-2 shrink-0">
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
              className="text-error hover:bg-error/15 border border-error/30 hover:border-error/50 font-medium text-xs px-3 py-1 h-7 cursor-pointer"
            >
              Leave
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
