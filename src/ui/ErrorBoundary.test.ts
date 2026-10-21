import { describe, it, expect, vi } from 'vitest';
import { ErrorBoundary } from './ErrorBoundary';

describe('ErrorBoundary logic', () => {
  it('updates state via getDerivedStateFromError', () => {
    const error = new Error('Screening playback crash');
    const nextState = ErrorBoundary.getDerivedStateFromError(error);

    expect(nextState).toEqual({
      hasError: true,
      error,
    });
  });

  it('logs caught errors to console without leaking telemetry', () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const boundary = new ErrorBoundary({ children: null });

    const err = new Error('Render error');
    const info = { componentStack: 'in VideoPlayer\nin Room' };

    boundary.componentDidCatch(err, info);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Duet ErrorBoundary caught an unhandled error:',
      err,
      info,
    );

    consoleSpy.mockRestore();
  });

  it('resets state when handleReset is invoked', () => {
    const onReset = vi.fn();
    const boundary = new ErrorBoundary({ children: null, onReset });
    boundary.state = { hasError: true, error: new Error('boom') };

    // Mock setState
    boundary.setState = vi.fn((update) => {
      Object.assign(boundary.state, update);
    }) as unknown as typeof boundary.setState;

    boundary.handleReset();

    expect(boundary.setState).toHaveBeenCalledWith({ hasError: false, error: null });
    expect(onReset).toHaveBeenCalled();
  });
});
