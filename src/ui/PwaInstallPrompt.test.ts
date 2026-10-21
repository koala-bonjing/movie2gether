import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isRunningStandalone } from './PwaInstallPrompt';

describe('PwaInstallPrompt pure helpers and lifecycle', () => {
  const originalWindow = globalThis.window;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.window = originalWindow;
  });

  describe('isRunningStandalone', () => {
    it('returns false when window is undefined', () => {
      // @ts-expect-error testing undefined window
      delete globalThis.window;
      expect(isRunningStandalone()).toBe(false);
    });

    it('returns true when display-mode: standalone matches', () => {
      globalThis.window = {
        matchMedia: vi.fn().mockImplementation((query: string) => ({
          matches: query === '(display-mode: standalone)',
        })),
        navigator: {},
      } as unknown as Window & typeof globalThis;

      expect(isRunningStandalone()).toBe(true);
    });

    it('returns true when navigator.standalone is true (iOS Safari)', () => {
      globalThis.window = {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        navigator: { standalone: true },
      } as unknown as Window & typeof globalThis;

      expect(isRunningStandalone()).toBe(true);
    });

    it('returns false when in standard browser tab', () => {
      globalThis.window = {
        matchMedia: vi.fn().mockReturnValue({ matches: false }),
        navigator: { standalone: false },
      } as unknown as Window & typeof globalThis;

      expect(isRunningStandalone()).toBe(false);
    });
  });
});
