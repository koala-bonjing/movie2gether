import { useState, type FormEvent } from 'react';
import { Input, OtpInput, Avatar } from '../../ui';
import {
  generateRoomCode,
  getStoredDisplayName,
  isValidRoomCode,
  setStoredDisplayName,
  getRecentRoom,
  setRecentRoom,
  type RecentRoom,
} from './code';
import { ThemePicker } from '../theme';

export interface LobbyViewProps {
  onJoin: (roomCode: string, displayName: string, isCreator?: boolean) => void;
  error?: string | null;
  isConnecting?: boolean;
}

export function LobbyView({ onJoin, error, isConnecting = false }: LobbyViewProps) {
  const [displayName, setDisplayName] = useState(() => getStoredDisplayName());
  const [joinCode, setJoinCode] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
  const [recentRoom] = useState<RecentRoom | null>(() => getRecentRoom());

  const handleNameChange = (name: string) => {
    setDisplayName(name);
    setStoredDisplayName(name);
    if (localError) setLocalError(null);
  };

  const validateName = (): boolean => {
    const trimmed = displayName.trim();
    if (!trimmed) {
      setLocalError('Please enter your name first.');
      return false;
    }
    if (trimmed.length > 40) {
      setLocalError('Name must be 40 characters or fewer.');
      return false;
    }
    return true;
  };

  const handleCreateRoom = () => {
    if (!validateName()) return;
    const code = generateRoomCode();
    setRecentRoom(code, displayName.trim());
    onJoin(code, displayName.trim(), true);
  };

  const handleJoinSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validateName()) return;
    if (!isValidRoomCode(joinCode)) {
      setLocalError('Please enter a valid 6-character room code.');
      return;
    }
    const cleanCode = joinCode.toUpperCase();
    setRecentRoom(cleanCode, displayName.trim());
    onJoin(cleanCode, displayName.trim(), false);
  };

  const displayError = localError || error;

  return (
    <div className="flex w-full flex-col items-center justify-center py-6 sm:py-12">
      {/* Stitch Lobby Screen: Card Container */}
      <div className="relative w-full max-w-[440px] rounded-2xl bg-surface-container-low p-[36px] shadow-2xl overflow-hidden border border-outline/30">
        {/* Crown Glow Rim Accent */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#e8a0bf]/40 to-transparent" />

        <div className="absolute top-5 right-5">
          <ThemePicker />
        </div>

        {/* Brand Header */}
        <header className="mb-6 flex flex-col items-center text-center">
          {/* Twin-Ring Cinema Motif */}
          <div className="mb-3.5 flex size-[44px] items-center justify-center rounded-full bg-gradient-to-tr from-[#e8a0bf] via-[#ffd8e6] to-[#f2c57c] p-[1.5px] shadow-lg">
            <div className="flex size-full items-center justify-center rounded-full bg-surface-container-lowest text-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-5 translate-x-0.5"
                aria-hidden="true"
              >
                <path d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
              </svg>
            </div>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Duet</h2>
          <p className="mt-1 text-sm text-muted">A private cinema for two.</p>
        </header>

        {displayError && (
          <div
            role="alert"
            className="mb-5 flex items-center gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 shrink-0">
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
                clipRule="evenodd"
              />
            </svg>
            <span>{displayError}</span>
          </div>
        )}

        <div className="space-y-5">
          {/* Display Name Input with pulsing green readiness indicator */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label htmlFor="display-name" className="text-xs font-medium text-muted">
                Your Display Name
              </label>
              {displayName.trim() && (
                <span className="flex items-center gap-1.5 text-[11px] font-medium text-tertiary">
                  <span className="relative flex size-2">
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-tertiary opacity-75" />
                    <span className="relative inline-flex size-2 rounded-full bg-tertiary" />
                  </span>
                  Ready
                </span>
              )}
            </div>
            <div className="relative flex items-center gap-2.5">
              <Avatar name={displayName} size="lg" aria-hidden="true" />
              <Input
                id="display-name"
                type="text"
                placeholder="What should your partner call you?"
                value={displayName}
                maxLength={40}
                disabled={isConnecting}
                onChange={(e) => handleNameChange(e.target.value)}
                autoFocus={!displayName}
              />
            </div>
          </div>

          {/* 'Create a Room' Button */}
          <div className="pt-1">
            <button
              type="button"
              onClick={handleCreateRoom}
              disabled={isConnecting}
              className="flex h-12 w-full cursor-pointer items-center justify-center gap-2.5 rounded-lg bg-primary-container font-headline-md text-on-primary-container shadow-md transition hover:bg-primary active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="currentColor"
                className="size-5"
                aria-hidden="true"
              >
                <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3h-15ZM3 7.5a1.5 1.5 0 0 1 1.5-1.5h15a1.5 1.5 0 0 1 1.5 1.5v9a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 16.5v-9Zm6 2.25a.75.75 0 0 1 1.13-.65l5.25 3a.75.75 0 0 1 0 1.3l-5.25 3A.75.75 0 0 1 9 15.75v-6Z" />
              </svg>
              <span>{isConnecting ? 'Setting up room…' : 'Create a Room'}</span>
            </button>
          </div>

          {/* Divider: OR ENTER CODE */}
          <div className="flex items-center gap-3 pt-2">
            <div className="h-px flex-1 bg-outline/40" />
            <span className="font-mono-sm text-xs font-semibold uppercase tracking-widest text-outline select-none">
              OR ENTER CODE
            </span>
            <div className="h-px flex-1 bg-outline/40" />
          </div>

          {/* 6 individual OTP input boxes & Join Room Button */}
          <form onSubmit={handleJoinSubmit} className="flex flex-col gap-4">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-xs font-medium text-muted">6-character room code</span>
              <button
                type="button"
                onClick={() => {
                  if (typeof document !== 'undefined') {
                    const firstInput = document.querySelector<HTMLInputElement>(
                      '[role="group"][aria-label="Room code"] input',
                    );
                    firstInput?.focus();
                  }
                }}
                className="text-xs font-medium text-primary hover:underline"
              >
                Join with Code
              </button>
            </div>

            <OtpInput
              value={joinCode}
              onChange={(val) => {
                setJoinCode(val);
                if (localError) setLocalError(null);
              }}
              disabled={isConnecting}
            />

            <button
              type="submit"
              disabled={isConnecting || joinCode.length !== 6}
              className="flex h-12 w-full cursor-pointer items-center justify-center rounded-lg border border-outline/40 bg-surface-container font-headline-md text-on-surface shadow-sm transition hover:bg-surface-variant active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40"
            >
              {isConnecting ? 'Joining room…' : 'Join Room'}
            </button>
          </form>

          {/* Quick Reconnect Card */}
          {recentRoom && (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-outline/30 bg-surface-container p-3.5 shadow-xs">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="relative flex size-2.5 shrink-0">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-tertiary opacity-75" />
                  <span className="relative inline-flex size-2.5 rounded-full bg-tertiary" />
                </span>
                <div className="flex flex-col min-w-0">
                  <span className="font-mono-sm text-xs font-bold uppercase tracking-wider text-text">
                    Room: {recentRoom.code}
                  </span>
                  {recentRoom.name && (
                    <span className="truncate text-[11px] text-muted">
                      Last with {recentRoom.name}
                    </span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => onJoin(recentRoom.code, displayName.trim() || 'Guest', false)}
                className="shrink-0 rounded-full border border-primary-container/40 bg-primary-container/15 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary-container hover:text-on-primary-container transition active:scale-95 cursor-pointer"
              >
                Connect →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="mt-8 flex items-center justify-center gap-2 text-center text-xs text-muted max-w-md px-4">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="size-3.5 shrink-0 opacity-70"
          aria-hidden="true"
        >
          <path
            fillRule="evenodd"
            d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
            clipRule="evenodd"
          />
        </svg>
        <span>Direct P2P WebRTC sync · No video uploaded to servers · End-to-end private</span>
      </footer>
    </div>
  );
}

