import { type ClipboardEvent, type KeyboardEvent, useRef } from 'react';
import { sanitizeRoomCode } from '../features/lobby/code';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  autoFocus?: boolean;
  disabled?: boolean;
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  autoFocus = false,
  disabled = false,
}: OtpInputProps) {
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const chars = Array.from({ length }, (_, i) => value[i] || '');

  const handleChange = (index: number, val: string) => {
    const sanitized = sanitizeRoomCode(val);
    if (!sanitized) return;

    const nextChars = [...chars];
    for (let j = 0; j < sanitized.length && index + j < length; j++) {
      nextChars[index + j] = sanitized[j] || '';
    }
    const nextValue = nextChars.join('').slice(0, length);
    onChange(nextValue);

    const nextFocusIndex = Math.min(index + sanitized.length, length - 1);
    if (nextFocusIndex > index) {
      inputRefs.current[nextFocusIndex]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault();
      const nextChars = [...chars];
      if (chars[index]) {
        nextChars[index] = '';
        onChange(nextChars.join(''));
      } else if (index > 0) {
        nextChars[index - 1] = '';
        onChange(nextChars.join(''));
        inputRefs.current[index - 1]?.focus();
      }
    } else if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault();
      inputRefs.current[index - 1]?.focus();
    } else if (e.key === 'ArrowRight' && index < length - 1) {
      e.preventDefault();
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const sanitized = sanitizeRoomCode(pasted);
    if (sanitized) {
      onChange(sanitized);
      const focusIndex = Math.min(sanitized.length, length - 1);
      inputRefs.current[focusIndex]?.focus();
    }
  };

  return (
    <div className="flex items-center justify-center gap-2 sm:gap-3" role="group" aria-label="Room code">
      {chars.map((char, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="text"
          autoCapitalize="characters"
          autoCorrect="off"
          maxLength={length}
          value={char}
          disabled={disabled}
          autoFocus={autoFocus && index === 0}
          aria-label={`Digit ${index + 1} of ${length}`}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          onFocus={(e) => e.target.select()}
          className="size-11 sm:size-12 rounded-sm border border-border bg-surface-2 text-center text-lg font-bold tracking-widest text-text uppercase outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/30 disabled:opacity-50"
        />
      ))}
    </div>
  );
}
