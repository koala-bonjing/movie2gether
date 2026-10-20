import { describe, it, expect } from 'vitest';
import { isPolitePeer, getIceServers, parseRtpVideoStats } from './webrtc';

describe('WebRTC pure helpers', () => {
  describe('isPolitePeer', () => {
    it('deterministically designates the peer with the lexicographically smaller ID as polite', () => {
      const aliceId = '001-alice';
      const bobId = '002-bob';

      expect(isPolitePeer(aliceId, bobId)).toBe(true);
      expect(isPolitePeer(bobId, aliceId)).toBe(false);
    });

    it('ensures asymmetry for any distinct pair of peer IDs', () => {
      const pairs: [string, string][] = [
        ['user_a', 'user_b'],
        ['uuid-xyz', 'uuid-abc'],
        ['123', '456'],
      ];

      for (const [id1, id2] of pairs) {
        const polite1 = isPolitePeer(id1, id2);
        const polite2 = isPolitePeer(id2, id1);
        expect(polite1 !== polite2).toBe(true);
      }
    });
  });

  describe('getIceServers', () => {
    it('creates STUN-only servers list when TURN is not configured', () => {
      const servers = getIceServers({
        stunUrls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'],
      });

      expect(servers.length).toBe(1);
      expect(servers[0]?.urls).toEqual([
        'stun:stun.l.google.com:19302',
        'stun:stun1.l.google.com:19302',
      ]);
    });

    it('includes TURN server with username and credential when provided', () => {
      const servers = getIceServers({
        stunUrls: ['stun:stun.example.com:3478'],
        turnUrl: 'turn:turn.example.com:3478',
        turnUser: 'duet_user',
        turnCred: 'secret123',
      });

      expect(servers.length).toBe(2);
      expect(servers[1]?.urls).toBe('turn:turn.example.com:3478');
      expect(servers[1]?.username).toBe('duet_user');
      expect(servers[1]?.credential).toBe('secret123');
    });
  });

  describe('parseRtpVideoStats', () => {
    it('extracts width, height, and fps from inbound-rtp video stats report', () => {
      const mockStats = new Map<string, Record<string, unknown>>([
        ['report-1', { type: 'codec', payloadType: 96 }],
        [
          'report-2',
          {
            type: 'inbound-rtp',
            kind: 'video',
            frameWidth: 640,
            frameHeight: 360,
            framesPerSecond: 24.2,
          },
        ],
      ]);

      const parsed = parseRtpVideoStats(mockStats);
      expect(parsed).toEqual({
        width: 640,
        height: 360,
        fps: 24,
      });
    });

    it('returns empty object when no inbound video stats are present', () => {
      const emptyStats = new Map<string, Record<string, unknown>>();
      expect(parseRtpVideoStats(emptyStats)).toEqual({});
    });
  });
});
