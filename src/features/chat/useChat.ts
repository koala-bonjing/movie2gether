import { useEffect, useRef, useState, useCallback } from 'react';
import type { DuetChannel } from '../../lib/supabase';
import { safeParseChatMsg, type ChatMsg } from '../sync/protocol';
import { saveMessageInDb, loadMessagesFromDb } from '../../lib/supabase';
import { sanitizeInputText } from './sanitize';

export interface UseChatOptions {
  channel: DuetChannel | null;
  selfUserId: string | null;
  roomCode: string;
  persist?: boolean;
  initialOpen?: boolean;
}

export interface UseChatReturn {
  messages: ChatMsg[];
  unreadCount: number;
  isOpen: boolean;
  setIsOpen: (action: React.SetStateAction<boolean>) => void;
  sendMessage: (text: string) => Promise<boolean>;
  markAllRead: () => void;
  clearMessages: () => void;
}

export function useChat({
  channel,
  selfUserId,
  roomCode,
  persist = true,
  initialOpen = true,
}: UseChatOptions): UseChatReturn {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [isOpen, setIsOpenState] = useState<boolean>(initialOpen);
  const [rawUnreadCount, setRawUnreadCount] = useState<number>(0);

  const isOpenRef = useRef(isOpen);
  const seenIdsRef = useRef<Set<string>>(new Set());

  // Keep ref updated for async message listener
  useEffect(() => {
    isOpenRef.current = isOpen;
  }, [isOpen]);

  // Derived unread count: when open, unread count is always 0
  const unreadCount = isOpen ? 0 : rawUnreadCount;

  const setIsOpen = useCallback((action: React.SetStateAction<boolean>) => {
    setIsOpenState((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (next) {
        setRawUnreadCount(0);
      }
      return next;
    });
  }, []);

  // Load message history on room load if persistence enabled
  useEffect(() => {
    if (!persist || !roomCode) return;

    let mounted = true;
    loadMessagesFromDb(roomCode).then((history) => {
      if (!mounted) return;
      if (history.length > 0) {
        setMessages((prev) => {
          const combined = [...history, ...prev];
          const unique: ChatMsg[] = [];
          for (const m of combined) {
            if (!seenIdsRef.current.has(m.id)) {
              seenIdsRef.current.add(m.id);
              unique.push(m);
            }
          }
          unique.sort((a, b) => a.at - b.at);
          return unique;
        });
      }
    });

    return () => {
      mounted = false;
    };
  }, [roomCode, persist]);

  // Subscribe to realtime 'chat' broadcast events
  useEffect(() => {
    if (!channel) return;

    const handleChat = ({ payload }: { payload: unknown }) => {
      const parsed = safeParseChatMsg(payload);
      if (!parsed) {
        console.warn('Received invalid chat message payload:', payload);
        return;
      }

      if (seenIdsRef.current.has(parsed.id)) {
        return;
      }

      seenIdsRef.current.add(parsed.id);

      setMessages((prev) => [...prev, parsed]);

      // If message is from partner and chat is closed, increment unread counter
      if (parsed.from !== selfUserId && !isOpenRef.current) {
        setRawUnreadCount((c) => c + 1);
      }
    };

    channel.on('broadcast', { event: 'chat' }, handleChat);
  }, [channel, selfUserId]);

  const sendMessage = useCallback(
    async (text: string): Promise<boolean> => {
      const sanitized = sanitizeInputText(text);
      if (!sanitized) return false;

      const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `msg-${Date.now()}-${Math.random()}`;
      const msg: ChatMsg = {
        id,
        from: selfUserId || 'anonymous',
        text: sanitized,
        at: Date.now(),
      };

      seenIdsRef.current.add(msg.id);
      // Optimistic local append
      setMessages((prev) => [...prev, msg]);

      // Broadcast over channel
      if (channel) {
        channel.send({
          type: 'broadcast',
          event: 'chat',
          payload: msg,
        }).catch((err) => {
          console.warn('Failed to broadcast chat message:', err);
        });
      }

      // Persist in DB / storage if enabled
      if (persist && roomCode) {
        saveMessageInDb(roomCode, msg.from, msg).catch((err) => {
          console.warn('Failed to persist message in DB:', err);
        });
      }

      return true;
    },
    [channel, selfUserId, roomCode, persist],
  );

  const markAllRead = useCallback(() => {
    setRawUnreadCount(0);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    seenIdsRef.current.clear();
    setRawUnreadCount(0);
  }, []);

  return {
    messages,
    unreadCount,
    isOpen,
    setIsOpen,
    sendMessage,
    markAllRead,
    clearMessages,
  };
}
