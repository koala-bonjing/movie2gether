import { describe, it, expect } from 'vitest';
import {
  safeParseSyncMsg,
  safeParseClockMsg,
  safeParseMediaMsg,
  safeParseBufferMsg,
  safeParseChatMsg,
  safeParseSignalMsg,
  safeParseRoomModeMsg,
} from './protocol';

describe('sync protocol validation', () => {
  describe('SyncMsg', () => {
    it('parses valid sync messages', () => {
      const valid = {
        seq: 1,
        from: 'user-1',
        playing: true,
        pos: 42.5,
        rate: 1,
        at: 1700000000000,
        heartbeat: false,
      };
      expect(safeParseSyncMsg(valid)).toEqual(valid);
    });

    it('defaults rate to 1 if omitted', () => {
      const valid = {
        seq: 2,
        from: 'user-2',
        playing: false,
        pos: 10,
        at: 1700000000000,
      };
      const parsed = safeParseSyncMsg(valid);
      expect(parsed?.rate).toBe(1);
    });

    it('parses sync state request messages', () => {
      const requestMsg = {
        seq: 0,
        from: 'user-joiner',
        playing: false,
        pos: 0,
        rate: 1,
        at: 1700000000000,
        request: true,
      };
      const parsed = safeParseSyncMsg(requestMsg);
      expect(parsed?.request).toBe(true);
    });

    it('rejects invalid sync payloads', () => {
      expect(safeParseSyncMsg(null)).toBeNull();
      expect(safeParseSyncMsg({ seq: 'invalid' })).toBeNull();
      expect(safeParseSyncMsg({ seq: 1, from: 123 })).toBeNull();
    });
  });

  describe('ClockMsg', () => {
    it('parses valid ping message', () => {
      const ping = { kind: 'ping', id: 'req-1', from: 'alice', t0: 1000 };
      expect(safeParseClockMsg(ping)).toEqual(ping);
    });

    it('parses valid pong message', () => {
      const pong = { kind: 'pong', id: 'req-1', from: 'bob', t0: 1000, t1: 1050 };
      expect(safeParseClockMsg(pong)).toEqual(pong);
    });

    it('rejects unknown kind or malformed clock msg', () => {
      expect(safeParseClockMsg({ kind: 'other' })).toBeNull();
      expect(safeParseClockMsg({ kind: 'pong', id: '1' })).toBeNull();
    });
  });

  describe('MediaMsg', () => {
    it('parses valid media message', () => {
      const media = {
        from: 'alice',
        name: 'movie.mp4',
        size: 1048576,
        duration: 120.5,
        hash: 'abcdef1234567890',
      };
      expect(safeParseMediaMsg(media)).toEqual(media);
    });

    it('rejects negative size', () => {
      expect(
        safeParseMediaMsg({
          from: 'alice',
          name: 'movie.mp4',
          size: -10,
          duration: 10,
          hash: 'abc',
        }),
      ).toBeNull();
    });
  });

  describe('BufferMsg', () => {
    it('parses valid buffering message', () => {
      const buf = { from: 'alice', buffering: true };
      expect(safeParseBufferMsg(buf)).toEqual(buf);
    });

    it('rejects invalid buffering message', () => {
      expect(safeParseBufferMsg({ from: 123, buffering: true })).toBeNull();
      expect(safeParseBufferMsg({ from: 'alice', buffering: 'yes' })).toBeNull();
    });
  });

  describe('ChatMsg', () => {
    it('parses valid chat message', () => {
      const chat = { id: 'msg-1', from: 'alice', text: 'Hey there!', at: 1000 };
      expect(safeParseChatMsg(chat)).toEqual(chat);
    });

    it('rejects empty text or text exceeding 2000 chars', () => {
      expect(safeParseChatMsg({ id: '1', from: 'a', text: '', at: 1000 })).toBeNull();
      expect(safeParseChatMsg({ id: '1', from: 'a', text: 'a'.repeat(2001), at: 1000 })).toBeNull();
    });
  });

  describe('SignalMsg', () => {
    it('parses description signal', () => {
      const sig = {
        from: 'alice',
        to: 'bob',
        data: { type: 'description', description: { type: 'offer', sdp: 'xyz' } },
      };
      expect(safeParseSignalMsg(sig)).toEqual(sig);
    });

    it('parses candidate signal', () => {
      const sig = {
        from: 'alice',
        to: 'bob',
        data: { type: 'candidate', candidate: { candidate: 'candidate:...', sdpMid: '0' } },
      };
      expect(safeParseSignalMsg(sig)).toEqual(sig);
    });

    it('parses media-state signal', () => {
      const sig = {
        from: 'alice',
        to: 'bob',
        data: { type: 'media-state', camOn: false, micOn: true, screenSharing: true },
      };
      expect(safeParseSignalMsg(sig)).toEqual(sig);
    });

    it('parses hang-up signal', () => {
      const sig = {
        from: 'alice',
        to: 'bob',
        data: { type: 'hang-up' },
      };
      expect(safeParseSignalMsg(sig)).toEqual(sig);
    });
  });

  describe('RoomModeMsg', () => {
    it('parses valid stream mode message', () => {
      const msg = {
        from: 'alice',
        mode: 'stream' as const,
        streamerId: 'alice',
      };
      expect(safeParseRoomModeMsg(msg)).toEqual(msg);
    });

    it('parses valid sync mode message', () => {
      const msg = {
        from: 'alice',
        mode: 'sync' as const,
      };
      expect(safeParseRoomModeMsg(msg)).toEqual(msg);
    });

    it('rejects invalid mode or payload', () => {
      expect(safeParseRoomModeMsg(null)).toBeNull();
      expect(safeParseRoomModeMsg({ from: 'alice', mode: 'invalid' })).toBeNull();
      expect(safeParseRoomModeMsg({ mode: 'sync' })).toBeNull();
    });
  });
});

