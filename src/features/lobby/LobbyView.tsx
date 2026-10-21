import { useState, type FormEvent } from 'react';
import { Button, Input, OtpInput } from '../../ui';
import { generateRoomCode, getStoredDisplayName, isValidRoomCode, setStoredDisplayName } from './code';
import { ThemePicker } from '../theme';

export interface LobbyViewProps {
  onJoin: (roomCode: string, displayName: string, isCreator?: boolean) => void;
  error?: string | null;
  isConnecting?: boolean;
}

export function LobbyView({ onJoin, error, isConnecting = false }: LobbyViewProps) {
  const [displayName, setDisplayName] = useState(() => getStoredDisplayName());
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'initial' | 'join'>('initial');
  const [localError, setLocalError] = useState<string | null>(null);

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
    onJoin(code, displayName.trim(), true);
  };

  const handleJoinSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!validateName()) return;
    if (!isValidRoomCode(joinCode)) {
      setLocalError('Please enter a valid 6-character room code.');
      return;
    }
    onJoin(joinCode.toUpperCase(), displayName.trim(), false);
  };

  const displayError = localError || error;

  return (
    <div className="flex w-full flex-col items-center justify-center py-6 sm:py-12">
      <div className="relative w-full max-w-md rounded-lg border border-border bg-surface p-6 sm:p-8 shadow-xl">
        <div className="absolute top-4 right-4">
          <ThemePicker />
        </div>
        <header className="mb-6 text-center">
          <h2 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Duet</h2>
          <p className="mt-2 text-sm text-muted">A private cinema for two. Watch in perfect sync.</p>
        </header>

        {displayError && (
          <div role="alert" className="mb-6 rounded-sm border border-danger/30 bg-danger/10 p-3 text-xs text-danger text-center">
            {displayError}
          </div>
        )}

        <div className="space-y-5">
          <div>
            <label htmlFor="display-name" className="mb-1.5 block text-xs font-medium text-muted">
              Your Name
            </label>
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

          {mode === 'initial' ? (
            <div className="flex flex-col gap-3 pt-2">
              <Button
                variant="primary"
                onClick={handleCreateRoom}
                disabled={isConnecting}
                className="w-full font-semibold"
              >
                {isConnecting ? 'Setting up room…' : 'Create a Room'}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setMode('join');
                  setLocalError(null);
                }}
                disabled={isConnecting}
                className="w-full border border-border"
              >
                Join with Code
              </Button>
            </div>
          ) : (
            <form onSubmit={handleJoinSubmit} className="flex flex-col gap-4 pt-2">
              <div>
                <label className="mb-2 block text-center text-xs font-medium text-muted">
                  Enter 6-Character Room Code
                </label>
                <OtpInput
                  value={joinCode}
                  onChange={(val) => {
                    setJoinCode(val);
                    if (localError) setLocalError(null);
                  }}
                  autoFocus
                  disabled={isConnecting}
                />
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={isConnecting || joinCode.length !== 6}
                  className="w-full font-semibold"
                >
                  {isConnecting ? 'Joining room…' : 'Join Room'}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setMode('initial');
                    setLocalError(null);
                  }}
                  disabled={isConnecting}
                  className="w-full text-xs text-muted hover:text-text"
                >
                  Back
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
