import { memo, useMemo } from 'react';
import type { ChatMsg } from '../sync/protocol';
import { parseSafeTokens } from './sanitize';

export interface ChatBubbleProps {
  message: ChatMsg;
  isSelf: boolean;
  senderName?: string;
}

export const ChatBubble = memo(function ChatBubble({
  message,
  isSelf,
  senderName,
}: ChatBubbleProps) {
  const tokens = useMemo(() => parseSafeTokens(message.text), [message.text]);

  const timeString = useMemo(() => {
    try {
      const d = new Date(message.at);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  }, [message.at]);

  const name = isSelf ? 'You' : senderName || 'Partner';

  const isReaction = useMemo(() => {
    const t = message.text.trim();
    return ['🍿', '❤️', '😂', '😭', '✨', '🫂'].includes(t);
  }, [message.text]);

  return (
    <div
      className={`flex flex-col gap-0.5 ${isSelf ? 'items-end' : 'items-start'}`}
      data-testid={isSelf ? 'chat-bubble-self' : 'chat-bubble-partner'}
    >
      <div className="flex items-center gap-1.5 px-1 text-[11px] text-muted">
        <span className="font-medium text-muted/90">{name}</span>
        <span>•</span>
        <time dateTime={new Date(message.at).toISOString()} className="tabular-nums">
          {timeString}
        </time>
      </div>

      {isReaction ? (
        <div
          className={`flex items-center gap-2 rounded-2xl px-3 py-1.5 shadow-xs border ${
            isSelf
              ? 'rounded-tr-xs bg-primary-container/25 border-primary-container/50 text-text'
              : 'rounded-tl-xs bg-surface-container-high border-outline/40 text-text'
          }`}
        >
          <span className="text-xl select-none">{message.text}</span>
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted">reaction</span>
        </div>
      ) : (
        <div
          className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed shadow-xs break-words ${
            isSelf
              ? 'rounded-tr-xs bg-primary-container text-on-primary-container font-medium'
              : 'rounded-tl-xs bg-surface-container-high border border-outline/30 text-text'
          }`}
        >
          {tokens.map((token, idx) => {
            if (token.type === 'link') {
              return (
                <a
                  key={idx}
                  href={token.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${isSelf ? 'text-on-primary-container' : 'text-primary'} font-medium underline underline-offset-2 hover:opacity-80 break-all`}
                >
                  {token.text}
                </a>
              );
            }
            return <span key={idx}>{token.value}</span>;
          })}
        </div>
      )}
    </div>
  );
});
