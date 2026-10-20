import { createClient, type RealtimeChannel, type SupabaseClient } from '@supabase/supabase-js';
import { env } from './env';

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
  private myPresence: PresencePayload | null = null;
  private myKey: string;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;

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
            for (const fn of this.presenceLeaveListeners) {
              fn({ key: data.key, leftPresences: [existing] });
            }
            for (const fn of this.presenceSyncListeners) {
              fn();
            }
          }
        }
      };
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
    if (this.bc) {
      this.bc.close();
      this.bc = null;
    }
    this.broadcastListeners.clear();
    this.presenceSyncListeners.clear();
    this.presenceJoinListeners.clear();
    this.presenceLeaveListeners.clear();
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
    return JSON.parse(safeStorage.getItem(STORAGE_KEY_ROOMS) || '{}');
  } catch {
    return {};
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

const hasSupabaseConfig = Boolean(env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY);

let rawSupabase: SupabaseClient | null = null;

if (hasSupabaseConfig && env.VITE_SUPABASE_URL && env.VITE_SUPABASE_ANON_KEY) {
  try {
    rawSupabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true },
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

export const supabase: DuetClient = rawSupabase
  ? {
      isMock: false,
      channel: (topic, opts) => rawSupabase!.channel(topic, opts as never) as unknown as DuetChannel,
      removeChannel: async (chan) => rawSupabase!.removeChannel(chan as unknown as RealtimeChannel) as never,
      auth: {
        getUser: async () => {
          const res = await rawSupabase!.auth.getUser();
          return { data: { user: res.data.user ? { id: res.data.user.id } : null }, error: res.error };
        },
        signInAnonymously: async () => {
          const res = await rawSupabase!.auth.signInAnonymously();
          return { data: { user: res.data.user ? { id: res.data.user.id } : null }, error: res.error };
        },
        getSession: async () => {
          const res = await rawSupabase!.auth.getSession();
          return {
            data: { session: res.data.session ? { user: { id: res.data.session.user.id } } : null },
            error: res.error,
          };
        },
      },
    }
  : mockClient;

// -------------------------------------------------------------
// Database Operations Helper
// -------------------------------------------------------------

export async function ensureAuth(): Promise<string> {
  const { data: userData } = await supabase.auth.getUser();
  if (userData?.user?.id) {
    return userData.user.id;
  }
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data?.user?.id) {
    throw new Error(error?.message || 'Could not sign in anonymously');
  }
  return data.user.id;
}

export async function createRoomInDb(code: string, userId: string): Promise<{ success: boolean; error?: string }> {
  if (rawSupabase) {
    const { error } = await rawSupabase.from('rooms').insert({ code, created_by: userId });
    if (error) return { success: false, error: error.message };
    return { success: true };
  }

  // Mock implementation
  const rooms = getMockRooms();
  if (rooms[code]) {
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
    // Check membership or capacity via RLS-protected insert
    const { error } = await rawSupabase.from('room_members').insert({
      room_code: code,
      user_id: userId,
      display_name: displayName,
    });
    if (error) {
      if (error.message.includes('violates row-level security') || error.code === '42501') {
        return { success: false, error: 'Room is full (max 2 people).' };
      }
      return { success: false, error: error.message };
    }
    return { success: true };
  }

  // Mock implementation
  const rooms = getMockRooms();
  if (!rooms[code]) {
    // If not found in mock store, auto-register room in dev mock so tests/invites can join
    rooms[code] = { code, created_by: userId, created_at: new Date().toISOString() };
    saveMockRooms(rooms);
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
    await rawSupabase.from('room_members').delete().match({ room_code: code, user_id: userId });
    return;
  }

  const members = getMockMembers();
  const next = members.filter((m) => !(m.room_code === code && m.user_id === userId));
  saveMockMembers(next);
}
