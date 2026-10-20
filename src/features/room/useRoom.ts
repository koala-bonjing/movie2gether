import { useEffect, useRef, useState, useCallback } from 'react';
import {
  ensureAuth,
  joinRoomInDb,
  leaveRoomInDb,
  supabase,
  type DuetChannel,
  type PresencePayload,
} from '../../lib/supabase';

export interface RoomPeer {
  userId: string;
  name: string;
  joinedAt: number;
}

export type RoomConnectionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

export interface UseRoomOptions {
  displayName: string;
}

export interface UseRoomReturn {
  roomCode: string;
  status: RoomConnectionStatus;
  error: string | null;
  self: RoomPeer | null;
  partner: RoomPeer | null;
  channel: DuetChannel | null;
  leaveRoom: () => Promise<void>;
}

export function useRoom(roomCode: string, options: UseRoomOptions): UseRoomReturn {
  const [status, setStatus] = useState<RoomConnectionStatus>('connecting');
  const [error, setError] = useState<string | null>(null);
  const [self, setSelf] = useState<RoomPeer | null>(null);
  const [partner, setPartner] = useState<RoomPeer | null>(null);
  const [channel, setChannel] = useState<DuetChannel | null>(null);
  const isUnmountedRef = useRef(false);

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
    }
  }, []);

  const leaveRoom = useCallback(async () => {
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
    let channel: DuetChannel | null = null;
    let live = true;

    async function init() {
      try {
        setStatus('connecting');
        setError(null);

        const userId = await ensureAuth();
        if (!live) return;

        setSelf({
          userId,
          name: options.displayName,
          joinedAt: Date.now(),
        });

        // Register in database and enforce max 2 members
        const joinResult = await joinRoomInDb(roomCode, userId, options.displayName);
        if (!live) return;
        if (!joinResult.success) {
          setStatus('error');
          setError(joinResult.error || 'Failed to join room.');
          return;
        }

        channel = supabase.channel(`room:${roomCode}`, {
          config: {
            broadcast: { self: false, ack: false },
            presence: { key: userId },
          },
        });
        setChannel(channel);

        channel.on('presence', { event: 'sync' }, () => {
          if (!live || !channel) return;
          updatePresence(channel, userId);
        });

        channel.on('presence', { event: 'join' }, () => {
          if (!live || !channel) return;
          updatePresence(channel, userId);
        });

        channel.on('presence', { event: 'leave' }, () => {
          if (!live || !channel) return;
          updatePresence(channel, userId);
        });

        channel.subscribe(async (subStatus, err) => {
          if (!live) return;
          if (subStatus === 'SUBSCRIBED') {
            setStatus('connected');
            await channel?.track({
              userId,
              name: options.displayName,
              joinedAt: Date.now(),
            });
            if (live && channel) {
              updatePresence(channel, userId);
            }
          } else if (subStatus === 'CHANNEL_ERROR' || subStatus === 'TIMED_OUT') {
            setStatus('error');
            setError(err?.message || `Channel connection ${subStatus.toLowerCase()}`);
          } else if (subStatus === 'CLOSED') {
            setStatus('disconnected');
          }
        });
      } catch (err) {
        if (!live) return;
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Failed to join room');
      }
    }

    init();

    return () => {
      live = false;
      isUnmountedRef.current = true;
      setChannel(null);
      if (channel) {
        channel.unsubscribe().catch(() => {});
        supabase.removeChannel(channel).catch(() => {});
      }
    };
  }, [roomCode, options.displayName, updatePresence]);

  return {
    roomCode,
    status,
    error,
    self,
    partner,
    channel,
    leaveRoom,
  };
}
