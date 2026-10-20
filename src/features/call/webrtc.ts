export interface IceConfig {
  stunUrls: string[];
  turnUrl?: string;
  turnUser?: string;
  turnCred?: string;
}

export interface VideoStats {
  width?: number;
  height?: number;
  fps?: number;
  bitrateKbps?: number;
}

export interface VideoStatsHistory {
  bytes: number;
  timestamp: number;
}

/**
 * Polite peer rule for Perfect Negotiation.
 * Consistent and deterministic: exactly one peer is polite.
 */
export function isPolitePeer(myId: string, peerId: string): boolean {
  return myId < peerId;
}

/**
 * Builds RTCIceServer configuration from STUN and optional TURN env settings.
 */
export function getIceServers(config: IceConfig): RTCIceServer[] {
  const servers: RTCIceServer[] = [];

  if (config.stunUrls && config.stunUrls.length > 0) {
    servers.push({ urls: config.stunUrls });
  }

  if (config.turnUrl) {
    servers.push({
      urls: config.turnUrl,
      username: config.turnUser,
      credential: config.turnCred,
    });
  }

  return servers;
}

/**
 * Extracts inbound or outbound video stats (resolution, framerate, bitrate) from RTCStatsReport.
 */
export function parseRtpVideoStats(
  stats: Map<string, Record<string, unknown>> | RTCStatsReport,
  history?: VideoStatsHistory,
): { stats: VideoStats; history?: VideoStatsHistory } {
  const result: VideoStats = {};
  let currentBytes: number | undefined;
  let currentTimestamp: number | undefined;

  for (const report of stats.values()) {
    if (report && typeof report === 'object') {
      const type = (report as { type?: unknown }).type;
      const kind = (report as { kind?: unknown }).kind;
      const isVideo = kind === 'video' || (report as { frameWidth?: unknown }).frameWidth !== undefined;

      if ((type === 'inbound-rtp' || type === 'outbound-rtp') && isVideo) {
        const w = (report as { frameWidth?: unknown }).frameWidth;
        const h = (report as { frameHeight?: unknown }).frameHeight;
        const f = (report as { framesPerSecond?: unknown }).framesPerSecond;
        const bytes = (report as { bytesReceived?: number; bytesSent?: number }).bytesReceived ??
          (report as { bytesSent?: number }).bytesSent;
        const ts = (report as { timestamp?: number }).timestamp ?? Date.now();

        if (typeof w === 'number') result.width = w;
        if (typeof h === 'number') result.height = h;
        if (typeof f === 'number') result.fps = Math.round(f);

        if (typeof bytes === 'number') {
          currentBytes = bytes;
          currentTimestamp = ts;
        }
      }

      // Fallback: availableOutgoingBitrate from candidate-pair
      if (type === 'candidate-pair' && (report as { state?: string }).state === 'succeeded') {
        const avail = (report as { availableOutgoingBitrate?: number }).availableOutgoingBitrate;
        if (typeof avail === 'number' && !result.bitrateKbps) {
          result.bitrateKbps = Math.round(avail / 1000);
        }
      }
    }
  }

  if (currentBytes !== undefined && currentTimestamp !== undefined) {
    if (history && history.timestamp < currentTimestamp) {
      const deltaBytes = currentBytes - history.bytes;
      const deltaSec = (currentTimestamp - history.timestamp) / 1000;
      if (deltaSec > 0 && deltaBytes >= 0) {
        result.bitrateKbps = Math.round((deltaBytes * 8) / (deltaSec * 1000));
      }
    }
    return { stats: result, history: { bytes: currentBytes, timestamp: currentTimestamp } };
  }

  return { stats: result };
}

/**
 * Format bitrate nicely for badges and status displays (e.g. "4.8 Mbps" or "850 kbps").
 */
export function formatBitrate(kbps?: number): string {
  if (!kbps || kbps <= 0) return '';
  if (kbps >= 1000) {
    return `${(kbps / 1000).toFixed(1)} Mbps`;
  }
  return `${Math.round(kbps)} kbps`;
}

/**
 * Format video resolution nicely (e.g. "1080p", "720p", or "1920x1080").
 */
export function formatResolution(width?: number, height?: number): string {
  if (!width || !height) return '';
  if (width >= 1920 || height >= 1080) return '1080p';
  if (width >= 1280 || height >= 720) return '720p';
  if (width >= 854 || height >= 480) return '480p';
  return `${width}×${height}`;
}

/**
 * Detects if screen sharing is supported and available on this platform.
 * Screen share is desktop-only per architecture specs and should be hidden on mobile (iOS, Android).
 */
export function isScreenShareSupported(
  userAgent?: string,
  hasGetDisplayMedia?: boolean,
): boolean {
  const ua = userAgent ?? (typeof navigator !== 'undefined' ? navigator.userAgent : '');
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini|Mobile|mobile/i.test(ua);
  if (isMobile) return false;

  if (hasGetDisplayMedia !== undefined) {
    return hasGetDisplayMedia;
  }

  if (userAgent !== undefined) {
    return true;
  }

  if (typeof navigator !== 'undefined') {
    return !!(navigator.mediaDevices && typeof navigator.mediaDevices.getDisplayMedia === 'function');
  }
  return false;
}

/**
 * 1080p30 screen share constraints per ARCHITECTURE.md §10.
 */
export const SCREEN_SHARE_CONSTRAINTS: DisplayMediaStreamOptions = {
  video: {
    width: { ideal: 1920, max: 1920 },
    height: { ideal: 1080, max: 1080 },
    frameRate: { ideal: 30, max: 30 },
  },
  audio: true,
};

/**
 * Configure motion hint on screen share video track.
 */
export function configureScreenTrack(track: MediaStreamTrack): void {
  try {
    track.contentHint = 'motion';
  } catch {
    // Unsupported in some environments
  }
}

/**
 * Apply 6 Mbps max bitrate cap on RTCRtpSender encodings per ARCHITECTURE.md §10.
 */
export async function applyBitrateCap(sender: RTCRtpSender, maxBitrate = 6_000_000): Promise<void> {
  try {
    const params = sender.getParameters();
    const encodings = params.encodings && params.encodings.length > 0 ? params.encodings : [{}];
    const firstEncoding = encodings[0] || {};
    firstEncoding.maxBitrate = maxBitrate;
    params.encodings = [firstEncoding, ...encodings.slice(1)];
    await sender.setParameters(params);
  } catch (err) {
    console.warn('Failed to apply sender bitrate cap:', err);
  }
}

