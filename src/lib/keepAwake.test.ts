import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestKeepAwake, releaseKeepAwake } from './keepAwake';

describe('keepAwake', () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  it('handles web Screen Wake Lock API gracefully', async () => {
    let released = false;
    const mockSentinel = {
      addEventListener: vi.fn(),
      release: vi.fn().mockImplementation(async () => {
        released = true;
      }),
    };

    const mockRequest = vi.fn().mockResolvedValue(mockSentinel);

    Object.defineProperty(globalThis, 'navigator', {
      value: {
        wakeLock: {
          request: mockRequest,
        },
      },
      writable: true,
      configurable: true,
    });

    await requestKeepAwake();
    expect(mockRequest).toHaveBeenCalledWith('screen');

    await releaseKeepAwake();
    expect(mockSentinel.release).toHaveBeenCalled();
    expect(released).toBe(true);
  });

  it('does not throw when wakeLock API is missing', async () => {
    Object.defineProperty(globalThis, 'navigator', {
      value: {},
      writable: true,
      configurable: true,
    });

    await expect(requestKeepAwake()).resolves.not.toThrow();
    await expect(releaseKeepAwake()).resolves.not.toThrow();
  });
});
