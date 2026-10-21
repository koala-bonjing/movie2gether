import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ACCENT_THEMES, DEFAULT_THEME_ID, applyTheme, getStoredThemeId } from './theme';

describe('Accent theme management', () => {
  let mockStorage: Record<string, string> = {};
  const mockStyle: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const fakeLocalStorage = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, val: string) => {
        mockStorage[key] = val;
      },
      clear: () => {
        mockStorage = {};
      },
      removeItem: (key: string) => {
        delete mockStorage[key];
      },
      length: 0,
      key: () => null,
    };

    const fakeDocument = {
      documentElement: {
        style: {
          setProperty: (prop: string, val: string) => {
            mockStyle[prop] = val;
          },
          getPropertyValue: (prop: string) => mockStyle[prop] || '',
          removeProperty: (prop: string) => {
            delete mockStyle[prop];
          },
        },
      },
    };

    Object.defineProperty(globalThis, 'localStorage', {
      value: fakeLocalStorage,
      writable: true,
      configurable: true,
    });

    Object.defineProperty(globalThis, 'document', {
      value: fakeDocument,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    mockStorage = {};
  });

  it('provides the 4 standard DESIGN.md presets', () => {
    expect(ACCENT_THEMES.map((t) => t.id)).toEqual(['rose', 'amber', 'mint', 'violet']);
    expect(ACCENT_THEMES.find((t) => t.id === 'rose')?.accent).toBe('#E8A0BF');
    expect(ACCENT_THEMES.find((t) => t.id === 'amber')?.accent).toBe('#F2C57C');
    expect(ACCENT_THEMES.find((t) => t.id === 'mint')?.accent).toBe('#7BD3A8');
    expect(ACCENT_THEMES.find((t) => t.id === 'violet')?.accent).toBe('#B388FF');
  });

  it('defaults to rose theme when nothing is stored', () => {
    expect(getStoredThemeId()).toBe(DEFAULT_THEME_ID);
  });

  it('applies theme color to CSS variable and persists to localStorage', () => {
    const applied = applyTheme('mint');
    expect(applied.id).toBe('mint');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#7BD3A8');
    expect(getStoredThemeId()).toBe('mint');
  });

  it('falls back to default theme for unknown id', () => {
    const applied = applyTheme('unknown');
    expect(applied.id).toBe('rose');
    expect(document.documentElement.style.getPropertyValue('--accent')).toBe('#E8A0BF');
  });
});
