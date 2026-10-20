import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRoomInDb,
  joinRoomInDb,
  leaveRoomInDb,
  ensureAuth,
  safeStorage,
  safeSessionStorage,
} from '../../lib/supabase';

describe('Room and membership store', () => {
  beforeEach(() => {
    safeStorage.clear();
    safeSessionStorage.clear();
  });

  it('signs in anonymously and generates an auth ID', async () => {
    const userId = await ensureAuth();
    expect(userId).toBeTruthy();
    expect(typeof userId).toBe('string');
  });

  it('creates a room and joins members', async () => {
    const code = 'ABCDEF';
    const creatorId = 'user-1';

    const createRes = await createRoomInDb(code, creatorId);
    expect(createRes.success).toBe(true);

    const join1 = await joinRoomInDb(code, creatorId, 'Alice');
    expect(join1.success).toBe(true);

    const join2 = await joinRoomInDb(code, 'user-2', 'Bob');
    expect(join2.success).toBe(true);
  });

  it('enforces maximum 2 members per room', async () => {
    const code = 'XYZ987';
    await createRoomInDb(code, 'user-1');
    await joinRoomInDb(code, 'user-1', 'Alice');
    await joinRoomInDb(code, 'user-2', 'Bob');

    // 3rd distinct user tries to join
    const join3 = await joinRoomInDb(code, 'user-3', 'Charlie');
    expect(join3.success).toBe(false);
    expect(join3.error).toContain('Room is full');

    // But existing member re-joining is allowed
    const rejoin1 = await joinRoomInDb(code, 'user-1', 'Alice');
    expect(rejoin1.success).toBe(true);
  });

  it('allows member to leave and frees up space', async () => {
    const code = 'ROOM42';
    await createRoomInDb(code, 'user-1');
    await joinRoomInDb(code, 'user-1', 'Alice');
    await joinRoomInDb(code, 'user-2', 'Bob');

    // Bob leaves
    await leaveRoomInDb(code, 'user-2');

    // Now user-3 can join
    const join3 = await joinRoomInDb(code, 'user-3', 'Charlie');
    expect(join3.success).toBe(true);
  });

  it('rejects joining a room that does not exist', async () => {
    const res = await joinRoomInDb('NOTEXI', 'user-99', 'Eve');
    expect(res.success).toBe(false);
    expect(res.error).toContain('Room not found');
  });

  it('rejects creating a room code that already exists', async () => {
    const code = 'EXISTS';
    const first = await createRoomInDb(code, 'user-1');
    expect(first.success).toBe(true);

    const duplicate = await createRoomInDb(code, 'user-2');
    expect(duplicate.success).toBe(false);
    expect(duplicate.error).toContain('already exists');
  });
});
