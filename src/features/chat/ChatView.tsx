import { useEffect, useRef } from 'react';
import type { ChatMsg } from '../sync/protocol';
import { ChatBubble } from './ChatBubble';
import { ChatInput } from './ChatInput';

export interface ChatViewProps {
  messages: ChatMsg[];
  selfUserId: string | null;
  partnerName?: string;
  onSendMessage: (text: string) => Promise<boolean> | boolean;
  onClose?: () => void;
  disabled?: boolean;
  className?: string;
  isPartnerTyping?: boolean;
}

export function ChatView({
  messages,
  selfUserId,
  partnerName,
  onSendMessage,
  onClose,
  disabled = false,
  className = '',
  isPartnerTyping = false,
}: ChatViewProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight;
    }
  }, [messages.length]);

  return (
    <div
      className={`flex h-full flex-col overflow-hidden rounded-2xl border border-outline/30 bg-surface-container shadow-xs ${className}`}
      data-testid="chat-view"
    >
      {/* Chat header */}
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-outline/30 bg-surface-container px-4">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative flex size-2 shrink-0">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-tertiary opacity-75" />
            <span className="relative inline-flex size-2 rounded-full bg-tertiary" />
          </span>
          <span className="font-semibold text-sm text-text">Chat</span>
          {partnerName && (
            <span className="truncate text-xs text-muted max-w-[140px]" title={`Direct chat with ${partnerName}`}>
              · Direct
            </span>
          )}
          {messages.length > 0 && (
            <span className="rounded-full bg-surface-container-highest px-2 py-0.5 text-[11px] font-mono-sm font-medium text-muted border border-outline/30">
              {messages.length}
            </span>
          )}
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close chat"
            className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-container-high hover:text-text transition cursor-pointer"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="size-4"
              aria-hidden="true"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        )}
      </div>

      {/* Message list */}
      <div
        ref={scrollContainerRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        className="flex-1 space-y-3 overflow-y-auto bg-surface-container-low p-4 text-xs scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center text-muted p-4 select-none">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="size-8 mb-2 opacity-40 text-primary"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a.75.75 0 0 1-.974-.94 5.95 5.95 0 0 0 .654-2.48A7.95 7.95 0 0 1 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z"
              />
            </svg>
            <p className="font-semibold text-text/80">No messages yet.</p>
            <p className="text-muted text-[11px] mt-0.5">Send a message to watch together!</p>
          </div>
        ) : (
          messages.map((msg) => (
            <ChatBubble
              key={msg.id}
              message={msg}
              isSelf={Boolean(selfUserId && msg.from === selfUserId)}
              senderName={partnerName}
            />
          ))
        )}

        {isPartnerTyping && (
          <div
            className="flex items-center gap-2 rounded-2xl bg-surface-container-high px-3.5 py-1.5 text-xs text-muted w-fit animate-fade-in shadow-xs"
            data-testid="chat-partner-typing"
          >
            <span className="font-medium text-text">{partnerName || 'Partner'} is typing</span>
            <span className="flex items-center gap-1">
              <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.3s]" />
              <span className="size-1.5 rounded-full bg-primary animate-bounce [animation-delay:-0.15s]" />
              <span className="size-1.5 rounded-full bg-primary animate-bounce" />
            </span>
          </div>
        )}
      </div>

      {/* Quick cinema reactions */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-t border-outline/30 bg-surface-container overflow-x-auto select-none">
        <span className="text-[10px] text-muted shrink-0 font-medium mr-0.5">Quick:</span>
        {[
          { label: '🍿 Popcorn', text: '🍿' },
          { label: '❤️ Love it', text: '❤️' },
          { label: '😂 Haha', text: '😂' },
          { label: '⏸️ Wait!', text: 'Wait pause! ⏸️' },
          { label: '▶️ Ready', text: 'Ready! ▶️' },
        ].map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={() => onSendMessage(item.text)}
            disabled={disabled}
            aria-label={`Send ${item.label}`}
            className="shrink-0 rounded-full border border-outline/40 bg-surface-container-low px-2.5 py-1 text-xs text-text hover:border-primary-container hover:text-primary active:scale-95 transition select-none disabled:pointer-events-none disabled:opacity-40 cursor-pointer"
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Input row */}
      <ChatInput onSendMessage={onSendMessage} disabled={disabled} />
    </div>
  );
}
