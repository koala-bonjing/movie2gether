import type { CallConnectionState } from './useCall';

export interface CallControlsProps {
  connectionState: CallConnectionState;
  isCamOn: boolean;
  isMicOn: boolean;
  isAudioOnly: boolean;
  onStartCall: () => void;
  onEndCall: () => void;
  onToggleCam: () => void;
  onToggleMic: () => void;
  onRetry?: () => void;
  disabled?: boolean;
}

export function CallControls({
  connectionState,
  isCamOn,
  isMicOn,
  isAudioOnly,
  onStartCall,
  onEndCall,
  onToggleCam,
  onToggleMic,
  onRetry,
  disabled = false,
}: CallControlsProps) {
  if (connectionState === 'requesting-media') {
    return (
      <div className="flex items-center gap-2 rounded-full border border-border bg-surface-2 px-3 py-1.5 text-xs text-muted shadow-xs">
        <span className="size-2 rounded-full bg-accent motion-safe:animate-ping" />
        <span>Starting…</span>
      </div>
    );
  }

  const isInCall =
    connectionState === 'connected' ||
    connectionState === 'connecting';

  if (!isInCall) {
    return (
      <div className="flex items-center gap-2">
        {connectionState === 'failed' && (
          <div className="flex items-center gap-2 text-xs text-danger">
            <span>Call failed</span>
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="underline font-medium hover:opacity-80"
              >
                Retry
              </button>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onStartCall}
          disabled={disabled}
          aria-label="Start video call"
          data-testid="start-call-btn"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent/20 border border-accent/40 px-4 text-xs font-semibold text-text transition hover:bg-accent/30 active:scale-95 disabled:opacity-50"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-4 text-accent"
            aria-hidden="true"
          >
            <path d="M3.25 4A2.25 2.25 0 0 0 1 6.25v7.5A2.25 2.25 0 0 0 3.25 16h7.5A2.25 2.25 0 0 0 13 13.75v-7.5A2.25 2.25 0 0 0 10.75 4h-7.5ZM14.5 7.025v5.95l3.58 2.046a.75.75 0 0 0 1.17-.653V5.632a.75.75 0 0 0-1.17-.653L14.5 7.025Z" />
          </svg>
          <span>Start call</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 rounded-full border border-border bg-surface-2 p-1 shadow-sm">
      {/* Microphone toggle */}
      <button
        type="button"
        onClick={onToggleMic}
        aria-label={isMicOn ? 'Mute microphone' : 'Unmute microphone'}
        data-testid="toggle-mic-btn"
        className={`grid size-9 place-items-center rounded-full transition active:scale-95 ${
          isMicOn ? 'text-text hover:bg-white/10' : 'bg-danger text-white'
        }`}
      >
        {isMicOn ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-4"
            aria-hidden="true"
          >
            <path d="M7 4a3 3 0 0 1 6 0v6a3 3 0 1 1-6 0V4Z" />
            <path d="M5.5 9.643a.75.75 0 0 0-1.5 0V10c0 3.06 2.29 5.585 5.25 5.954V17.5h-1.5a.75.75 0 0 0 0 1.5h4.5a.75.75 0 0 0 0-1.5h-1.5v-1.546A6.001 6.001 0 0 0 16 10v-.357a.75.75 0 0 0-1.5 0V10a4.5 4.5 0 0 1-9 0v-.357Z" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-4"
            aria-hidden="true"
          >
            <path d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06L15.42 14.36A6.974 6.974 0 0 0 17 9.75a.75.75 0 0 0-1.5 0 5.474 5.474 0 0 1-1.39 3.638L12.5 11.78V4.5a2.5 2.5 0 0 0-5 0v3.25a.75.75 0 0 1-1.5 0V4.5c0-.69.28-1.317.734-1.77L3.28 2.22ZM10 15.5a5.48 5.48 0 0 1-4.5-2.35.75.75 0 0 0-1.22.875A6.98 6.98 0 0 0 9.25 17v1.5a.75.75 0 0 0 1.5 0V17c.56 0 1.1-.065 1.62-.186l-1.34-1.34c-.332.018-.675.026-1.03.026Z" />
          </svg>
        )}
      </button>

      {/* Camera toggle */}
      <button
        type="button"
        onClick={onToggleCam}
        disabled={isAudioOnly}
        aria-label={isCamOn ? 'Turn off camera' : 'Turn on camera'}
        data-testid="toggle-cam-btn"
        className={`grid size-9 place-items-center rounded-full transition active:scale-95 disabled:opacity-30 ${
          isCamOn ? 'text-text hover:bg-white/10' : 'bg-danger text-white'
        }`}
      >
        {isCamOn ? (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-4"
            aria-hidden="true"
          >
            <path d="M3.25 4A2.25 2.25 0 0 0 1 6.25v7.5A2.25 2.25 0 0 0 3.25 16h7.5A2.25 2.25 0 0 0 13 13.75v-7.5A2.25 2.25 0 0 0 10.75 4h-7.5ZM14.5 7.025v5.95l3.58 2.046a.75.75 0 0 0 1.17-.653V5.632a.75.75 0 0 0-1.17-.653L14.5 7.025Z" />
          </svg>
        ) : (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="size-4"
            aria-hidden="true"
          >
            <path d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.9-1.9A2.247 2.247 0 0 1 10.75 16h-7.5A2.25 2.25 0 0 1 1 13.75v-7.5c0-.621.252-1.184.66-1.59L3.28 2.22ZM14.5 12.975l3.58 2.046a.75.75 0 0 0 1.17-.653V5.632a.75.75 0 0 0-1.17-.653L14.5 7.025v2.894l-1.5-1.5V6.25A2.25 2.25 0 0 0 10.75 4h-4.38l-1.5-1.5h5.88A3.75 3.75 0 0 1 14.5 6.25v.775Z" />
          </svg>
        )}
      </button>

      {/* End call button */}
      <button
        type="button"
        onClick={onEndCall}
        aria-label="End call"
        data-testid="end-call-btn"
        className="grid size-9 place-items-center rounded-full bg-danger text-white transition hover:opacity-90 active:scale-95"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="size-4 rotate-[135deg]"
          aria-hidden="true"
        >
          <path fillRule="evenodd" d="M1.5 4.5a3 3 0 0 1 3-3h1.372c.86 0 1.61.586 1.819 1.42l1.105 4.423a1.875 1.875 0 0 1-.694 1.955l-1.293.97c-.135.101-.164.249-.126.352a11.285 11.285 0 0 0 6.697 6.697c.103.038.25.009.352-.126l.97-1.293a1.875 1.875 0 0 1 1.955-.694l4.423 1.105c.834.209 1.42.959 1.42 1.82V19.5a3 3 0 0 1-3 3h-2.25C8.552 22.5 1.5 15.448 1.5 6.75V4.5Z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}
