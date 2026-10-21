import { useState, useEffect, useRef } from 'react';
import { ACCENT_THEMES, applyTheme, getStoredThemeId } from './theme';

export function ThemePicker({ className = '' }: { className?: string }) {
  const [currentThemeId, setCurrentThemeId] = useState<string>(() => getStoredThemeId());
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Initialize theme from storage on mount
  useEffect(() => {
    applyTheme(currentThemeId);
  }, [currentThemeId]);

  // Close popup on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    window.addEventListener('pointerdown', handleOutsideClick);
    return () => window.removeEventListener('pointerdown', handleOutsideClick);
  }, [isOpen]);

  const handleSelect = (id: string) => {
    applyTheme(id);
    setCurrentThemeId(id);
    setIsOpen(false);
  };

  const currentTheme = ACCENT_THEMES.find((t) => t.id === currentThemeId) || ACCENT_THEMES[0]!;

  return (
    <div ref={containerRef} className={`relative inline-block ${className}`} data-testid="theme-picker">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label={`Theme: ${currentTheme.name}. Change accent theme`}
        aria-expanded={isOpen}
        title={`Accent theme: ${currentTheme.name}`}
        data-testid="theme-picker-btn"
        className="inline-flex size-8 items-center justify-center rounded-full border border-border bg-surface-2 transition hover:bg-white/10 active:scale-95"
      >
        <span
          className="size-3.5 rounded-full shadow-xs"
          style={{ backgroundColor: currentTheme.accent }}
        />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Accent themes"
          className="absolute right-0 top-10 z-50 flex items-center gap-2 rounded-xl border border-border bg-surface p-2 shadow-md"
        >
          {ACCENT_THEMES.map((theme) => {
            const isSelected = theme.id === currentThemeId;
            return (
              <button
                key={theme.id}
                type="button"
                role="menuitem"
                aria-label={theme.name}
                aria-checked={isSelected}
                data-testid={`theme-option-${theme.id}`}
                onClick={() => handleSelect(theme.id)}
                className={`group relative grid size-7 place-items-center rounded-full transition active:scale-90 ${
                  isSelected ? 'ring-2 ring-white/80 ring-offset-2 ring-offset-surface' : 'hover:scale-110'
                }`}
                style={{ backgroundColor: theme.accent }}
              >
                <span className="sr-only">{theme.name}</span>
                {isSelected && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="size-3.5 text-bg"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
