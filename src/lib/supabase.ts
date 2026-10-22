import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { env, cleanSupabaseUrlString } from './env';

export interface PresencePayload {
  userId: string;
  name: string;
  joinedAt: number;
  canScreenShare?: boolean;
}

export interface DuetChannel {
  on(
    type: 'broadcast',
    filter: { event: string },
    callback: (payload: { event: string; payload: unknown }) => void,
  ): DuetChannel;
  on(
    type: 'presence',
    filter: { event: 'sync' | 'join' | 'leave' },
    callback: (payload: { key: string; newPresences?: PresencePayload[]; leftPresences?: PresencePayload[] }) => void,
  ): DuetChannel;
  subscribe(callback?: (status: string, err?: Error) => void): DuetChannel;
  send(message: { type: 'broadcast'; event: string; payload: unknown }): Promise<'ok' | 'timed out' | 'error'>;
  track(payload: PresencePayload): Promise<'ok' | 'timed out' | 'error'>;
  untrack(): Promise<'ok' | 'timed out' | 'error'>;
  unsubscribe(): Promise<'ok' | 'timed out' | 'error'>;
  presenceState<T = PresencePayload>(): Record<string, T[]>;
}

export interface DuetAuth {
  getUser: () => Promise<{ data: { user: { id: string } | null }; error: Error | null }>;
  signInAnonymously: () => Promise<{ data: { user: { id: string } | null }; error: Error | null }>;
  getSession: () => Promise<{ data: { session: { user: { id: string } } | null }; error: Error | null }>;
}

export interface DuetClient {
  channel: (topic: string, opts?: { config?: { broadcast?: { self?: boolean; ack?: boolean }; presence?: { key?: string } } }) => DuetChannel;
  removeChannel: (channel: DuetChannel) => Promise<'ok' | 'timed out' | 'error'>;
  auth: DuetAuth;
  isMock: boolean;
}

// -------------------------------------------------------------
// Mock Channel & In-Memory/LocalStorage Store for Dev & E2E
// -------------------------------------------------------------

class MockChannel implements DuetChannel {
  public topic: string;
  private bc: BroadcastChannel | null = null;
  private broadcastListeners: Map<string, Set<(payload: { event: string; payload: unknown }) => void>> = new Map();
  private presenceSyncListeners: Set<() => void> = new Set();
  private presenceJoinListeners: Set<(payload: { key: string; newPresences: PresencePayload[] }) => void> = new Set();
  private presenceLeaveListeners: Set<(payload: { key: string; leftPresences: PresencePayload[] }) => void> = new Set();
  private presences: Map<string, PresencePayload> = new Map();
  private lastSeen: Map<string, number> = new Map();
  private myPresence: PresencePayload | null = null;
  private myKey: string;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private sweepTimer: ReturnType<typeof setInterval> | null = null;
  private handleUnload: (() => void) | null = null;

  constructor(topic: string, opts?: { config?: { presence?: { key?: string } } }) {
    this.topic = topic;
    this.myKey = opts?.config?.presence?.key ?? 'anonymous';

    if (typeof BroadcastChannel !== 'undefined') {
      this.bc = new BroadcastChannel(`mock:${topic}`);
      this.bc.onmessage = (event) => {
        const data = event.data;
        if (!data || typeof data !== 'object') return;

        if (data.type === 'broadcast') {
          const listeners = this.broadcastListeners.get(data.event);
          if (listeners) {
            for (const fn of listeners) {
              fn({ event: data.event, payload: data.payload });
            }
          }
        } else if (data.type === 'presence_announcement') {
          const prev = this.presences.get(data.key);
          this.presences.set(data.key, data.payload);
          this.lastSeen.set(data.key, Date.now());
          if (!prev) {
            for (const fn of this.presenceJoinListeners) {
              fn({ key: data.key, newPresences: [data.payload] });
            }
          }
          for (const fn of this.presenceSyncListeners) {
            fn();
          }
          // If this was a request to announce, reply with our presence
          if (data.needsReply && this.myPresence) {
            this.bc?.postMessage({
              type: 'presence_announcement',
              key: this.myKey,
              payload: this.myPresence,
              needsReply: false,
            });
          }
        } else if (data.type === 'presence_leave') {
          const existing = this.presences.get(data.key);
          if (existing) {
            this.presences.delete(data.key);
            this.lastSeen.delete(data.key);
            for (const fn of this.presenceLeaveListeners) {
              fn({ key: data.key, leftPresences: [existing] });
            }
            for (const fn of this.presenceSyncListeners) {
              fn();
            }
          }
        }
      };

      // Periodic check to evict peers that haven't sent presence within 12 seconds
      this.sweepTimer = setInterval(() => {
        const now = Date.now();
        for (const [key, last] of Array.from(this.lastSeen.entries())) {
          if (key !== this.myKey && now - last > 12000) {
            const stale = this.presences.get(key);
            this.presences.delete(key);
            this.lastSeen.delete(key);
            if (stale) {
              for (const fn of this.presenceLeaveListeners) {
                fn({ key, leftPresences: [stale] });
              }
              for (const fn of this.presenceSyncListeners) {
                fn();
              }
            }
          }
        }
      }, 3000);

      if (typeof window !== 'undefined') {
        this.handleUnload = () => {
          this.untrack().catch(() => {});
        };
        window.addEventListener('pagehide', this.handleUnload);
        window.addEventListener('beforeunload', this.handleUnload);
      }
    }
  }

  on(type: string, filter: unknown, callback: unknown): DuetChannel {
    if (type === 'broadcast') {
      const eventName = (filter as { event: string }).event;
      if (!this.broadcastListeners.has(eventName)) {
        this.broadcastListeners.set(eventName, new Set());
      }
      this.broadcastListeners.get(eventName)!.add(callback as (payload: { event: string; payload: unknown }) => void);
    } else if (type === 'presence') {
      const eventName = (filter as { event: string }).event;
      if (eventName === 'sync') {
        this.presenceSyncListeners.add(callback as () => void);
      } else if (eventName === 'join') {
        this.presenceJoinListeners.add(callback as (p: { key: string; newPresences: PresencePayload[] }) => void);
      } else if (eventName === 'leave') {
        this.presenceLeaveListeners.add(callback as (p: { key: string; leftPresences: PresencePayload[] }) => void);
      }
    }
    return this;
  }

  subscribe(callback?: (status: string, err?: Error) => void): DuetChannel {
    setTimeout(() => {
      callback?.('SUBSCRIBED');
      // Announce request so other peers reply with their presence
      if (this.bc && this.myPresence) {
        this.bc.postMessage({
          type: 'presence_announcement',
          key: this.myKey,
          payload: this.myPresence,
          needsReply: true,
        });
      }
    }, 0);
    return this;
  }

  async send(message: { type: 'broadcast'; event: string; payload: unknown }): Promise<'ok' | 'timed out' | 'error'> {
    if (this.bc) {
      this.bc.postMessage({
        type: 'broadcast',
        event: message.event,
        payload: message.payload,
      });
    }
    return 'ok';
  }

  async track(payload: PresencePayload): Promise<'ok' | 'timed out' | 'error'> {
    this.myPresence = payload;
    this.presences.set(this.myKey, payload);

    if (this.bc) {
      this.bc.postMessage({
        type: 'presence_announcement',
        key: this.myKey,
        payload,
        needsReply: true,
      });

      // Periodic presence announcement so late joiners or reconnects always see us
      if (!this.heartbeatTimer) {
        this.heartbeatTimer = setInterval(() => {
          if (this.myPresence) {
            this.bc?.postMessage({
              type: 'presence_announcement',
              key: this.myKey,
              payload: this.myPresence,
              needsReply: false,
            });
          }
        }, 5000);
      }
    }

    for (const fn of this.presenceSyncListeners) {
      fn();
    }
    return 'ok';
  }

  async untrack(): Promise<'ok' | 'timed out' | 'error'> {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.bc && this.myPresence) {
      this.bc.postMessage({
        type: 'presence_leave',
        key: this.myKey,
      });
    }
    this.presences.delete(this.myKey);
    this.myPresence = null;
    for (const fn of this.presenceSyncListeners) {
      fn();
    }
    return 'ok';
  }

  async unsubscribe(): Promise<'ok' | 'timed out' | 'error'> {
    await this.untrack();
    if (this.sweepTimer) {
      clearInterval(this.sweepTimer);
      this.sweepTimer = null;
    }
    if (this.handleUnload && typeof window !== 'undefined') {
      window.removeEventListener('pagehide', this.handleUnload);
      window.removeEventListener('beforeunload', this.handleUnload);
      this.handleUnload = null;
    }
    if (this.bc) {
      this.bc.close();
      this.bc = null;
    }
    this.broadcastListeners.clear();
    this.presenceSyncListeners.clear();
    this.presenceJoinListeners.clear();
    this.presenceLeaveListeners.clear();
    this.lastSeen.clear();
    return 'ok';
  }

  presenceState<T = PresencePayload>(): Record<string, T[]> {
    const res: Record<string, T[]> = {};
    for (const [key, val] of this.presences.entries()) {
      res[key] = [val as unknown as T];
    }
    return res;
  }
}

// -------------------------------------------------------------
// Mock Database Operations using LocalStorage (cross-tab in dev/e2e)
// with in-memory fallback for test runners
// -------------------------------------------------------------

const STORAGE_KEY_ROOMS = 'duet:mock:rooms';
const STORAGE_KEY_MEMBERS = 'duet:mock:members';
const STORAGE_KEY_MESSAGES = 'duet:mock:messages';

type MockRoom = { code: string; created_by: string; created_at: string };
type MockMember = { room_code: string; user_id: string; display_name: string; joined_at: string };

const memoryStorage = new Map<string, string>();
const sessionMemoryStorage = new Map<string, string>();

export const safeStorage = {
  getItem(key: string): string | null {
    if (typeof localStorage !== 'undefined') {
      try {
        return localStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return memoryStorage.get(key) ?? null;
  },
  setItem(key: string, val: string): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(key, val);
        return;
      } catch {
        // ignore
      }
    }
    memoryStorage.set(key, val);
  },
  clear(): void {
    if (typeof localStorage !== 'undefined') {
      try {
        localStorage.clear();
      } catch {
        // ignore
      }
    }
    memoryStorage.clear();
  },
};

export const safeSessionStorage = {
  getItem(key: string): string | null {
    if (typeof sessionStorage !== 'undefined') {
      try {
        return sessionStorage.getItem(key);
      } catch {
        return null;
      }
    }
    return sessionMemoryStorage.get(key) ?? null;
  },
  setItem(key: string, val: string): void {
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(key, val);
        return;
      } catch {
        // ignore
      }
    }
    sessionMemoryStorage.set(key, val);
  },
  clear(): void {
    if (typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.clear();
      } catch {
        // ignore
      }
    }
    sessionMemoryStorage.clear();
  },
};

function getMockRooms(): Record<string, MockRoom> {
  try {
    const rooms = JSON.parse(safeStorage.getItem(STORAGE_KEY_ROOMS) || '{}');
    if (!rooms['DEMO01']) {
      rooms['DEMO01'] = { code: 'DEMO01', created_by: 'system', created_at: new Date().toISOString() };
    }
    return rooms;
  } catch {
    return { DEMO01: { code: 'DEMO01', created_by: 'system', created_at: new Date().toISOString() } };
  }
}

function saveMockRooms(rooms: Record<string, MockRoom>) {
  safeStorage.setItem(STORAGE_KEY_ROOMS, JSON.stringify(rooms));
}

function getMockMembers(): MockMember[] {
  try {
    return JSON.parse(safeStorage.getItem(STORAGE_KEY_MEMBERS) || '[]');
  } catch {
    return [];
  }
}

function saveMockMembers(members: MockMember[]) {
  safeStorage.setItem(STORAGE_KEY_MEMBERS, JSON.stringify(members));
}

function getOrCreateMockUserId(): string {
  let id = safeSessionStorage.getItem('duet:mock-user-id');
  if (!id) {
    id = crypto.randomUUID();
    safeSessionStorage.setItem('duet:mock-user-id', id);
  }
  return id;
}

// -------------------------------------------------------------
// Client Initialization
// -------------------------------------------------------------

const cleanSupabaseUrl = env.VITE_SUPABASE_URL
  ? cleanSupabaseUrlString(env.VITE_SUPABASE_URL)
  : undefined;
const isTestEnv = import.meta.env.MODE === 'test';
const hasSupabaseConfig = !isTestEnv && Boolean(cleanSupabaseUrl && env.VITE_SUPABASE_ANON_KEY);

let rawSupabase: SupabaseClient | null = null;

if (hasSupabaseConfig && cleanSupabaseUrl && env.VITE_SUPABASE_ANON_KEY) {
  try {
    rawSupabase = createClient(cleanSupabaseUrl, env.VITE_SUPABASE_ANON_KEY, {
      auth: {
        storage: typeof window !== 'undefined' ? window.sessionStorage : undefined,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  } catch (err) {
    console.warn('Failed to initialize Supabase client, falling back to mock:', err);
    rawSupabase = null;
  }
}

export const isUsingMock = rawSupabase === null;


const mockClient: DuetClient = {
  isMock: true,
  channel: (topic, opts) => new MockChannel(topic, opts),
  removeChannel: async (chan) => {
    return chan.unsubscribe();
  },
  auth: {
    getUser: async () => {
      const id = getOrCreateMockUserId();
      return { data: { user: { id } }, error: null };
    },
    signInAnonymously: async () => {
      const id = getOrCreateMockUserId();
      return { data: { user: { id } }, error: null };
    },
    getSession: async () => {
      const id = getOrCreateMockUserId();
      return { data: { session: { user: { id } } }, error: null };
    },
  },
};

export const supabase: DuetClient = {
  get isMock() {
    return rawSupabase === null;
  },
  channel: (topic, opts) => {
    if (rawSupabase) {
      return rawSupabase.channel(topic, opts as never) as unknown as DuetChannel;
    }
    return mockClient.channel(topic, opts);
  },
  removeChannel: async (chan) => {
    if (rawSupabase) {
      return rawSupabase.removeChannel(chan as unknown as RealtimeChannel) as never;
    }
    return mockClient.removeChannel(chan);
  },
  auth: {
    getUser: async () => {
      if (rawSupabase) {
        try {
          const res = await rawSupabase.auth.getUser();
          if (res.data?.user) {
            return { data: { user: { id: res.data.user.id } }, error: null };
          }
          return { data: { user: null }, error: null };
        } catch {
          return { data: { user: null }, error: null };
        }
      }
      return mockClient.auth.getUser();
    },
    signInAnonymously: async () => {
      if (rawSupabase) {
        try {
          const res = await rawSupabase.auth.signInAnonymously();
          if (res.data?.user && !res.error) {
            return { data: { user: { id: res.data.user.id } }, error: null };
          }
          console.warn('Supabase signInAnonymously error:', res.error?.message);
        } catch (err: unknown) {
          console.warn('Supabase signInAnonymously threw:', err);
        }
      }
      return mockClient.auth.signInAnonymously();
    },
    getSession: async () => {
      if (rawSupabase) {
        try {
          const res = await rawSupabase.auth.getSession();
          if (res.data?.session?.user) {
            return { data: { session: { user: { id: res.data.session.user.id } } }, error: null };
          }
          return { data: { session: null }, error: null };
        } catch {
          return { data: { session: null }, error: null };
        }
      }
      return mockClient.auth.getSession();
    },
  },
};

// -------------------------------------------------------------
// Database Operations Helper
// -------------------------------------------------------------

export async function ensureAuth(): Promise<string> {
  if (rawSupabase) {
    try {
      const { data: sessionData } = await rawSupabase.auth.getSession();
      if (sessionData?.session?.user?.id) {
        return sessionData.session.user.id;
      }
    } catch {
      // session missing
    }

    try {
      const { data: authData, error: authError } = await rawSupabase.auth.signInAnonymously();
      if (!authError && authData?.user?.id) {
        return authData.user.id;
      }
      if (authError) {
        console.warn('Supabase anonymous sign-in error:', authError.message);
      }
    } catch (err) {
      console.warn('Supabase anonymous sign-in threw:', err);
    }
  }

  // Fallback for offline or unit tests
  return getOrCreateMockUserId();
}

export async function createRoomInDb(code: string, userId: string): Promise<{ success: boolean; error?: string }> {
  if (rawSupabase) {
    try {
      const { error } = await rawSupabase.from('rooms').insert({ code, created_by: userId });
      if (!error || error.code === '23505') {
        const rooms = getMockRooms();
        rooms[code] = { code, created_by: userId, created_at: new Date().toISOString() };
        saveMockRooms(rooms);
        return { success: true };
      }
      console.error(`Supabase createRoom DB insert error [${error.code}]: ${error.message}`);
      return { success: false, error: `Failed to create room: ${error.message}` };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`Supabase createRoom DB insert threw:`, err);
      return { success: false, error: `Failed to create room: ${msg}` };
    }
  }

  // Local/mock tracking
  const rooms = getMockRooms();
  if (!rawSupabase && rooms[code]) {
    return { success: false, error: 'Room code already exists' };
  }
  rooms[code] = { code, created_by: userId, created_at: new Date().toISOString() };
  saveMockRooms(rooms);
  return { success: true };
}

export async function joinRoomInDb(
  code: string,
  userId: string,
  displayName: string,
): Promise<{ success: boolean; error?: string }> {
  if (rawSupabase) {
    try {
      const { data: room, error: roomError } = await rawSupabase
        .from('rooms')
        .select('code')
        .eq('code', code)
        .maybeSingle();

      if (!roomError && room) {
        // Check if already a member (re-join / refresh)
        const { data: existingMember } = await rawSupabase
          .from('room_members')
          .select('user_id')
          .match({ room_code: code, user_id: userId })
          .maybeSingle();

        if (existingMember) {
          return { success: true };
        }

        // Check member count
        const { count, error: countError } = await rawSupabase
          .from('room_members')
          .select('*', { count: 'exact', head: true })
          .eq('room_code', code);

        if (!countError && typeof count === 'number' && count >= 2) {
          return { success: false, error: 'Room is full (max 2 people).' };
        }

        // Insert membership
        const { error } = await rawSupabase.from('room_members').insert({
          room_code: code,
          user_id: userId,
          display_name: displayName,
        });
        if (!error || error.code === '23505') {
          return { success: true };
        }
        if (error.code === '23503') {
          return { success: false, error: 'Room not found. Please check the room code.' };
        }
        if (error.message?.includes('member_count') || (!countError && typeof count === 'number' && count >= 2)) {
          return { success: false, error: 'Room is full (max 2 people).' };
        }
        console.warn('Supabase joinRoom member insert skipped (Realtime presence will govern room):', error.message);
      } else if (!roomError && !room) {
        const mockRooms = getMockRooms();
        if (!mockRooms[code]) {
          return { success: false, error: 'Room not found. Please check the room code.' };
        }
      } else if (roomError) {
        console.warn('Supabase joinRoom query warning:', roomError.message);
      }
    } catch (err) {
      console.warn('Supabase joinRoom threw:', err);
    }

    // Update local membership tracking
    const members = getMockMembers();
    const roomMembers = members.filter((m) => m.room_code === code);
    const existing = roomMembers.find((m) => m.user_id === userId);
    if (!existing) {
      if (roomMembers.length >= 2) {
        return { success: false, error: 'Room is full (max 2 people).' };
      }
      members.push({
        room_code: code,
        user_id: userId,
        display_name: displayName,
        joined_at: new Date().toISOString(),
      });
      saveMockMembers(members);
    }

    return { success: true };
  }

  // Mock implementation for test / offline
  const rooms = getMockRooms();
  if (!rooms[code]) {
    return { success: false, error: 'Room not found. Please check the room code.' };
  }

  const members = getMockMembers();
  const roomMembers = members.filter((m) => m.room_code === code);
  const existing = roomMembers.find((m) => m.user_id === userId);

  if (!existing && roomMembers.length >= 2) {
    return { success: false, error: 'Room is full (max 2 people).' };
  }

  if (!existing) {
    members.push({
      room_code: code,
      user_id: userId,
      display_name: displayName,
      joined_at: new Date().toISOString(),
    });
    saveMockMembers(members);
  }
  return { success: true };
}


export async function leaveRoomInDb(code: string, userId: string): Promise<void> {
  if (rawSupabase) {
    try {
      await rawSupabase.from('room_members').delete().match({ room_code: code, user_id: userId });
    } catch (err) {
      console.warn('Supabase leaveRoom failed:', err);
    }
  }

  const members = getMockMembers();
  const next = members.filter((m) => !(m.room_code === code && m.user_id === userId));
  saveMockMembers(next);
}

export interface StoredMessage {
  id: string;
  from: string;
  text: string;
  at: number;
}

export async function saveMessageInDb(
  roomCode: string,
  userId: string,
  msg: { id: string; text: string; at: number },
): Promise<void> {
  // Always persist to local safeStorage (acts as offline cache & mock persistence)
  const key = `${STORAGE_KEY_MESSAGES}:${roomCode}`;
  try {
    const list: Array<{ id: string; room_code: string; user_id: string; body: string; created_at: string }> =
      JSON.parse(safeStorage.getItem(key) || '[]');
    if (!list.some((item) => item.id === msg.id)) {
      list.push({
        id: msg.id,
        room_code: roomCode,
        user_id: userId,
        body: msg.text,
        created_at: new Date(msg.at).toISOString(),
      });
      // keep last 100 messages
      if (list.length > 100) {
        list.splice(0, list.length - 100);
      }
      safeStorage.setItem(key, JSON.stringify(list));
    }
  } catch {
    // ignore
  }

  if (rawSupabase) {
    try {
      await rawSupabase.from('messages').insert({
        id: msg.id,
        room_code: roomCode,
        user_id: userId,
        body: msg.text,
        created_at: new Date(msg.at).toISOString(),
      });
    } catch (err) {
      console.warn('Failed to persist message in DB:', err);
    }
  }
}

export async function loadMessagesFromDb(roomCode: string): Promise<StoredMessage[]> {
  if (rawSupabase) {
    try {
      const { data, error } = await rawSupabase
        .from('messages')
        .select('id, user_id, body, created_at')
        .eq('room_code', roomCode)
        .order('created_at', { ascending: true })
        .limit(100);

      if (!error && data && data.length > 0) {
        return data.map((row) => ({
          id: row.id,
          from: row.user_id,
          text: row.body,
          at: new Date(row.created_at).getTime(),
        }));
      }
    } catch {
      // fallback to mock retrieval below
    }
  }

  // Mock retrieval / local cache fallback
  const key = `${STORAGE_KEY_MESSAGES}:${roomCode}`;
  try {
    const list: Array<{ id: string; room_code: string; user_id: string; body: string; created_at: string }> =
      JSON.parse(safeStorage.getItem(key) || '[]');
    return list.map((m) => ({
      id: m.id,
      from: m.user_id,
      text: m.body,
      at: new Date(m.created_at).getTime(),
    }));
  } catch {
    return [];
  }
}

