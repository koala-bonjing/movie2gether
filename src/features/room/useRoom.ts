import { useEffect, useRef, useState, useCallback } from 'react';
import {
  createRoomInDb,
  ensureAuth,
  joinRoomInDb,
  leaveRoomInDb,
  supabase,
  type DuetChannel,
  type PresencePayload,
} from '../../lib/supabase';
import { computeBackoffDelay } from './reconnect';

export interface RoomPeer {
  userId: string;
  name: string;
  joinedAt: number;
}

export type RoomConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'reconnecting';
export type PartnerConnectionStatus = 'waiting' | 'connected' | 'left';

export interface UseRoomOptions {
  displayName: string;
  isCreator?: boolean;
}

export interface UseRoomReturn {
  roomCode: string;
  status: RoomConnectionStatus;
  error: string | null;
  self: RoomPeer | null;
  partner: RoomPeer | null;
  partnerStatus: PartnerConnectionStatus;
  channel: DuetChannel | null;
  leaveRoom: () => Promise<void>;
}

export function useRoom(roomCode: string, options: UseRoomOptions): UseRoomReturn {
  const [status, setStatus] = useState<RoomConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [self, setSelf] = useState<RoomPeer | null>(null);
  const [partner, setPartner] = useState<RoomPeer | null>(null);
  const [partnerStatus, setPartnerStatus] = useState<PartnerConnectionStatus>('waiting');
  const [channel, setChannel] = useState<DuetChannel | null>(null);
  const isUnmountedRef = useRef(false);
  const hadPartnerRef = useRef(false);

  const updatePresence = useCallback((chan: DuetChannel, currentUserId: string) => {
    const state = chan.presenceState<PresencePayload>();
    let foundSelf: RoomPeer | null = null;
    let foundPartner: RoomPeer | null = null;

    for (const [key, presences] of Object.entries(state)) {
      const p = presences[0];
      if (!p) continue;
      const peer: RoomPeer = {
        userId: p.userId || key,
        name: p.name || 'Anonymous',
        joinedAt: p.joinedAt || Date.now(),
      };

      if (peer.userId === currentUserId) {
        foundSelf = peer;
      } else if (!foundPartner) {
        foundPartner = peer;
      }
    }

    if (!isUnmountedRef.current) {
      if (foundSelf) setSelf(foundSelf);
      setPartner(foundPartner);
      if (foundPartner) {
        hadPartnerRef.current = true;
        setPartnerStatus('connected');
      } else if (hadPartnerRef.current) {
        setPartnerStatus('left');
      } else {
        setPartnerStatus('waiting');
      }
    }
  }, []);

  const isLeavingRef = useRef(false);
  const retryCountRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const leaveRoom = useCallback(async () => {
    isLeavingRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    const code = roomCode;
    const uid = self?.userId;
    if (channel) {
      try {
        await channel.unsubscribe();
        await supabase.removeChannel(channel);
      } catch (err) {
        console.warn('Error unsubscribing from channel:', err);
      }
    }
    setChannel(null);
    if (uid) {
      try {
        await leaveRoomInDb(code, uid);
      } catch (err) {
        console.warn('Error leaving room in DB:', err);
      }
    }
    if (!isUnmountedRef.current) {
      setStatus('disconnected');
      setSelf(null);
      setPartner(null);
    }
  }, [roomCode, self?.userId, channel]);

  useEffect(() => {
    isUnmountedRef.current = false;
    isLeavingRef.current = false;
    let live = true;
    let currentChannel: DuetChannel | null = null;

    async function connect() {
      if (!live || isLeavingRef.current) return;
      try {
        if (retryCountRef.current > 0) {
          setStatus('reconnecting');
        } else {
          setStatus('connecting');
        }
        setError(null);

        const userId = await ensureAuth();
        if (!live || isLeavingRef.current) return;

        setSelf({
          userId,
          name: options.displayName,
          joinedAt: Date.now(),
        });

        // If we are creating the room, ensure it is created in the database first
        if (options.isCreator) {
          const createRes = await createRoomInDb(roomCode, userId);
          if (!live || isLeavingRef.current) return;
          if (!createRes.success && retryCountRef.current === 0) {
            setStatus('error');
            setError(createRes.error || 'Failed to create room.');
            return;
          }
        }

        // Register in database and enforce max 2 members
        const joinResult = await joinRoomInDb(roomCode, userId, options.displayName);
        if (!live || isLeavingRef.current) return;
        if (!joinResult.success) {
          setStatus('error');
          setError(joinResult.error || 'Failed to join room.');
          return;
        }

        if (currentChannel) {
          try {
            await currentChannel.unsubscribe();
            await supabase.removeChannel(currentChannel);
          } catch {
            // ignore
          }
        }

        currentChannel = supabase.channel(`room:${roomCode}`, {
          config: {
            broadcast: { self: false, ack: false },
            presence: { key: userId },
          },
        });
        setChannel(currentChannel);

        currentChannel.on('presence', { event: 'sync' }, () => {
          if (!live || !currentChannel) return;
          updatePresence(currentChannel, userId);
        });

        currentChannel.on('presence', { event: 'join' }, () => {
          if (!live || !currentChannel) return;
          updatePresence(currentChannel, userId);
        });

        currentChannel.on('presence', { event: 'leave' }, () => {
          if (!live || !currentChannel) return;
          updatePresence(currentChannel, userId);
        });

        currentChannel.subscribe(async (subStatus, err) => {
          if (!live || isLeavingRef.current) return;
          if (subStatus === 'SUBSCRIBED') {
            retryCountRef.current = 0;
            setStatus('connected');
            setError(null);
            await currentChannel?.track({
              userId,
              name: options.displayName,
              joinedAt: Date.now(),
            });
            if (live && currentChannel) {
              updatePresence(currentChannel, userId);
            }
          } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT' || subStatus === 'CLOSED') {
            if (isLeavingRef.current) {
              setStatus('disconnected');
              return;
            }
            const delay = computeBackoffDelay(retryCountRef.current);
            retryCountRef.current += 1;
            setStatus('reconnecting');
            setError(err?.message || `Connection dropped (${subStatus.toLowerCase()}). Retrying in ${(delay / 1000).toFixed(1)}s…`);

            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = setTimeout(() => {
              if (live && !isLeavingRef.current) {
                void connect();
              }
            }, delay);
          }
        });
      } catch (err) {
        if (!live || isLeavingRef.current) return;
        const delay = computeBackoffDelay(retryCountRef.current);
        retryCountRef.current += 1;
        setStatus('reconnecting');
        setError(err instanceof Error ? err.message : 'Reconnecting...');
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = setTimeout(() => {
          if (live && !isLeavingRef.current) {
            void connect();
          }
        }, delay);
      }
    }

    void connect();

    const handleOnline = () => {
      if (live && !isLeavingRef.current) {
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        retryCountRef.current = 0;
        void connect();
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
    }

    return () => {
      live = false;
      isUnmountedRef.current = true;
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', handleOnline);
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      setChannel(null);
      if (currentChannel) {
        currentChannel.unsubscribe().catch(() => {});
        supabase.removeChannel(currentChannel).catch(() => {});
      }
    };
  }, [roomCode, options.displayName, options.isCreator, updatePresence]);

  return {
    roomCode,
    status,
    error,
    self,
    partner,
    partnerStatus,
    channel,
    leaveRoom,
  };
}
