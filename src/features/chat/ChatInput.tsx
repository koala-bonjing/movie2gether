import { useState, useRef, type FormEvent, type KeyboardEvent } from 'react';

export interface ChatInputProps {
  onSendMessage: (text: string) => Promise<boolean> | boolean;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatInput({
  onSendMessage,
  disabled = false,
  placeholder = 'Send a message...',
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e?: FormEvent) => {
    e?.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const ok = await onSendMessage(trimmed);
      if (ok) {
        setText('');
        inputRef.current?.focus();
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 border-t border-outline/30 bg-surface-container p-2.5"
      aria-label="Send message form"
    >
      <button
        type="button"
        onClick={() => {
          setText((t) => (t ? `${t} ❤️` : '❤️'));
          inputRef.current?.focus();
        }}
        aria-label="Add emoji"
        className="grid size-10 shrink-0 place-items-center rounded-full text-muted hover:text-text hover:bg-surface-container-high transition text-base"
      >
        😊
      </button>

      <input
        ref={inputRef}
        type="text"
        value={text}
        maxLength={2000}
        disabled={disabled || isSubmitting}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label="Message"
        data-testid="chat-input"
        className="min-h-11 flex-1 rounded-full border border-outline/40 bg-surface-container-low px-4 text-sm text-text placeholder:text-muted focus:border-primary-container focus:outline-hidden transition disabled:opacity-50"
      />

      <button
        type="submit"
        disabled={!text.trim() || disabled || isSubmitting}
        aria-label="Send message"
        data-testid="chat-send-btn"
        className="grid size-11 shrink-0 place-items-center rounded-full bg-primary-container text-on-primary-container shadow-md transition hover:bg-primary active:scale-95 disabled:pointer-events-none disabled:opacity-30 cursor-pointer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="size-5 translate-x-0.5"
          aria-hidden="true"
        >
          <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
        </svg>
      </button>
    </form>
  );
}
