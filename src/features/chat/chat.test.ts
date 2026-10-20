import { describe, it, expect, beforeEach } from 'vitest';
import { safeParseChatMsg, type ChatMsg } from '../sync/protocol';
import {
  saveMessageInDb,
  loadMessagesFromDb,
  safeStorage,
  supabase,
} from '../../lib/supabase';

describe('Chat protocol & persistence', () => {
  beforeEach(() => {
    safeStorage.clear();
  });

  it('validates correct chat messages with schema', () => {
    const valid: ChatMsg = {
      id: 'msg-123',
      from: 'user-a',
      text: 'Hello there!',
      at: 1700000000000,
    };
    expect(safeParseChatMsg(valid)).toEqual(valid);
  });

  it('rejects invalid chat messages (empty text, missing fields)', () => {
    expect(safeParseChatMsg({ id: '1', from: 'a', text: '', at: 100 })).toBeNull();
    expect(safeParseChatMsg({ id: '1', from: 'a', at: 100 })).toBeNull();
    expect(safeParseChatMsg('not an object')).toBeNull();
    // Too long (> 2000 chars)
    expect(
      safeParseChatMsg({ id: '1', from: 'a', text: 'x'.repeat(2001), at: 100 }),
    ).toBeNull();
  });

  it('persists and loads messages for a room', async () => {
    const roomCode = 'CHAT01';
    const msg1: ChatMsg = { id: 'm1', from: 'user-1', text: 'First message', at: 1000 };
    const msg2: ChatMsg = { id: 'm2', from: 'user-2', text: 'Second message', at: 2000 };

    await saveMessageInDb(roomCode, 'user-1', msg1);
    await saveMessageInDb(roomCode, 'user-2', msg2);

    const history = await loadMessagesFromDb(roomCode);
    expect(history.length).toBe(2);
    expect(history[0]?.id).toBe('m1');
    expect(history[0]?.text).toBe('First message');
    expect(history[1]?.id).toBe('m2');
    expect(history[1]?.text).toBe('Second message');
  });

  it('transmits chat messages between channels via broadcast', async () => {
    const roomCode = 'ROOM99';
    const chanA = supabase.channel(`room:${roomCode}`);
    const chanB = supabase.channel(`room:${roomCode}`);

    const received: ChatMsg[] = [];
    chanB.on('broadcast', { event: 'chat' }, (payload) => {
      const parsed = safeParseChatMsg(payload.payload);
      if (parsed) received.push(parsed);
    });

    const msg: ChatMsg = {
      id: 'm-live',
      from: 'user-a',
      text: 'Testing live chat broadcast',
      at: Date.now(),
    };

    await chanA.send({
      type: 'broadcast',
      event: 'chat',
      payload: msg,
    });

    await new Promise((r) => setTimeout(r, 30));

    expect(received.length).toBe(1);
    expect(received[0]?.text).toBe('Testing live chat broadcast');
    expect(received[0]?.from).toBe('user-a');

    await chanA.unsubscribe();
    await chanB.unsubscribe();
  });

  it('handles deduplication by message id', () => {
    const seen = new Set<string>();
    const msgs: ChatMsg[] = [
      { id: '1', from: 'a', text: 'hi', at: 1 },
      { id: '1', from: 'a', text: 'hi again', at: 2 },
      { id: '2', from: 'b', text: 'hey', at: 3 },
    ];

    const deduplicated: ChatMsg[] = [];
    for (const m of msgs) {
      if (!seen.has(m.id)) {
        seen.add(m.id);
        deduplicated.push(m);
      }
    }

    expect(deduplicated.length).toBe(2);
    expect(deduplicated.map((m) => m.id)).toEqual(['1', '2']);
  });

  it('correctly merges history with optimistic messages without dropping optimistic sends', () => {
    const history: ChatMsg[] = [
      { id: 'h1', from: 'alice', text: 'old message', at: 100 },
      { id: 'h2', from: 'bob', text: 'another old', at: 200 },
    ];
    const optimistic: ChatMsg[] = [
      { id: 'opt1', from: 'alice', text: 'newly typed', at: 300 },
    ];

    const combined = [...history, ...optimistic];
    const localSeen = new Set<string>();
    const unique: ChatMsg[] = [];
    for (const m of combined) {
      if (!localSeen.has(m.id)) {
        localSeen.add(m.id);
        unique.push(m);
      }
    }
    unique.sort((a, b) => a.at - b.at);

    expect(unique.length).toBe(3);
    expect(unique.map((m) => m.id)).toEqual(['h1', 'h2', 'opt1']);
  });
});
