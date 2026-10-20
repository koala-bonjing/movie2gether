import { describe, it, expect } from 'vitest';
import {
  isPolitePeer,
  getIceServers,
  parseRtpVideoStats,
  formatBitrate,
  formatResolution,
  isScreenShareSupported,
  applyBitrateCap,
} from './webrtc';

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

      const { stats } = parseRtpVideoStats(mockStats);
      expect(stats).toEqual({
        width: 640,
        height: 360,
        fps: 24,
      });
    });

    it('calculates bitrate from delta bytes over time', () => {
      const statsMap = new Map<string, Record<string, unknown>>([
        [
          'video-inbound',
          {
            type: 'inbound-rtp',
            kind: 'video',
            frameWidth: 1920,
            frameHeight: 1080,
            framesPerSecond: 30,
            bytesReceived: 3_000_000,
            timestamp: 2000,
          },
        ],
      ]);

      const history = { bytes: 1_000_000, timestamp: 0 };
      const { stats } = parseRtpVideoStats(statsMap, history);

      // (2,000,000 bytes * 8 bits) / 2 seconds = 8,000,000 bps = 8,000 kbps
      expect(stats.bitrateKbps).toBe(8000);
      expect(stats.width).toBe(1920);
      expect(stats.height).toBe(1080);
      expect(stats.fps).toBe(30);
    });

    it('returns empty object when no inbound video stats are present', () => {
      const emptyStats = new Map<string, Record<string, unknown>>();
      expect(parseRtpVideoStats(emptyStats).stats).toEqual({});
    });
  });

  describe('formatBitrate and formatResolution', () => {
    it('formats bitrates in Mbps and kbps correctly', () => {
      expect(formatBitrate(6000)).toBe('6.0 Mbps');
      expect(formatBitrate(1500)).toBe('1.5 Mbps');
      expect(formatBitrate(750)).toBe('750 kbps');
      expect(formatBitrate(undefined)).toBe('');
      expect(formatBitrate(0)).toBe('');
    });

    it('formats standard and custom resolutions', () => {
      expect(formatResolution(1920, 1080)).toBe('1080p');
      expect(formatResolution(1280, 720)).toBe('720p');
      expect(formatResolution(854, 480)).toBe('480p');
      expect(formatResolution(640, 360)).toBe('640×360');
      expect(formatResolution(undefined, undefined)).toBe('');
    });
  });

  describe('isScreenShareSupported', () => {
    it('returns true on desktop browsers', () => {
      const desktopChrome =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const desktopMac =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

      expect(isScreenShareSupported(desktopChrome)).toBe(true);
      expect(isScreenShareSupported(desktopMac)).toBe(true);
    });

    it('returns false on mobile browsers (Android and iOS)', () => {
      const androidChrome =
        'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.144 Mobile Safari/537.36';
      const iphoneSafari =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1';
      const ipadSafari =
        'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1';

      expect(isScreenShareSupported(androidChrome)).toBe(false);
      expect(isScreenShareSupported(iphoneSafari)).toBe(false);
      expect(isScreenShareSupported(ipadSafari)).toBe(false);
    });
  });

  describe('applyBitrateCap', () => {
    it('sets maxBitrate on sender encoding parameters', async () => {
      let params = { encodings: [{}] } as unknown as RTCRtpSendParameters;
      const mockSender = {
        getParameters: () => params,
        setParameters: async (p: RTCRtpSendParameters) => {
          params = p;
        },
      } as unknown as RTCRtpSender;

      await applyBitrateCap(mockSender, 6_000_000);
      expect(params.encodings[0]?.maxBitrate).toBe(6_000_000);
    });
  });
});

