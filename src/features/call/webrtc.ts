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
 * Extracts inbound video stats (resolution, framerate) from RTCStatsReport.
 */
export function parseRtpVideoStats(stats: Map<string, Record<string, unknown>> | RTCStatsReport): VideoStats {
  const result: VideoStats = {};

  for (const report of stats.values()) {
    if (report && typeof report === 'object') {
      const type = (report as { type?: unknown }).type;
      const kind = (report as { kind?: unknown }).kind;
      if (type === 'inbound-rtp' && (kind === 'video' || (report as { frameWidth?: unknown }).frameWidth !== undefined)) {
        const w = (report as { frameWidth?: unknown }).frameWidth;
        const h = (report as { frameHeight?: unknown }).frameHeight;
        const f = (report as { framesPerSecond?: unknown }).framesPerSecond;

        if (typeof w === 'number') result.width = w;
        if (typeof h === 'number') result.height = h;
        if (typeof f === 'number') result.fps = Math.round(f);
      }
    }
  }

  return result;
}
