import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './index';

export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Console logging only per CLAUDE.md (zero third-party trackers or telemetry)
    console.error('Duet ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  handleReload = (): void => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  handleReturnToLobby = (): void => {
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', window.location.pathname);
      window.location.reload();
    }
  };

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback && this.state.error) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return (
        <div
          role="alert"
          aria-live="assertive"
          className="flex min-h-dvh w-full flex-col items-center justify-center bg-bg p-6 text-text select-none"
          data-testid="error-boundary-screen"
        >
          <div className="flex max-w-md flex-col items-center text-center">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border border-border bg-surface-2 text-danger shadow-md">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="size-7"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            </div>

            <h1 className="text-xl font-bold tracking-tight text-text">
              Something interrupted the screening
            </h1>
            <p className="mt-2 text-sm text-muted">
              An unexpected error occurred. You can reload this room or return to the lobby to restart.
            </p>

            {this.state.error?.message && (
              <details className="mt-4 w-full rounded-lg border border-border bg-surface p-3 text-left">
                <summary className="cursor-pointer text-xs font-semibold text-muted hover:text-text">
                  Error Details
                </summary>
                <pre className="mt-2 max-h-32 overflow-auto font-mono text-[11px] text-danger/90 whitespace-pre-wrap">
                  {this.state.error.message}
                </pre>
              </details>
            )}

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <Button variant="ghost" onClick={this.handleReturnToLobby}>
                Return to lobby
              </Button>
              <Button variant="primary" onClick={this.handleReload}>
                Reload room
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
