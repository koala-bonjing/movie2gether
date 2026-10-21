import { type ClipboardEvent, type KeyboardEvent, useRef } from 'react';
import { applyOtpInput, sanitizeRoomCode } from '../features/lobby/code';

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
    const res = applyOtpInput(value, index, val, length);
    onChange(res.nextCode);
    if (res.nextIndex !== index) {
      inputRefs.current[res.nextIndex]?.focus();
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

  const handlePaste = (index: number, e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const sanitized = sanitizeRoomCode(pasted);
    if (sanitized) {
      const nextChars = [...chars];
      const startIdx = sanitized.length >= length ? 0 : index;
      for (let j = 0; j < sanitized.length && startIdx + j < length; j++) {
        nextChars[startIdx + j] = sanitized[j] || '';
      }
      onChange(nextChars.join('').slice(0, length));
      const focusIndex = Math.min(startIdx + sanitized.length, length - 1);
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
          onFocus={(e) => e.target.select()}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={(e) => handlePaste(index, e)}
          className="w-12 h-[52px] bg-surface-container rounded-lg text-center font-mono-sm text-headline-md text-primary font-bold outline-none focus:ring-2 focus:ring-primary-container border border-outline/30 focus:border-transparent transition disabled:opacity-40 shadow-inner"
        />
      ))}
    </div>
  );
}
