import { useEffect, useRef, useState, useCallback } from 'react';
import type { DuetChannel } from '../../lib/supabase';
import {
  safeParseSyncMsg,
  safeParseClockMsg,
  safeParseBufferMsg,
  safeParseMediaMsg,
  type SyncMsg,
  type MediaMsg,
} from './protocol';
import { ClockEstimator } from './clock';
import { expectedPos, decideCorrection, calculateDrift, SYNC } from './correction';
import { shouldAcceptRemoteSync, computeNextLocalSeq, isController } from './authority';

export interface UseSyncOptions {
  onPartnerAction?: (actionText: string) => void;
}

export interface UseSyncReturn {
  drift: number;
  clockOffset: number;
  rtt: number;
  isController: boolean;
  controllerId: string | null;
  partnerBuffering: boolean;
  selfBuffering: boolean;
  seq: number;
  syncNow: () => void;
  broadcastMedia: (info: MediaMsg) => void;
  partnerMedia: MediaMsg | null;
}

export function useSync(
  video: HTMLVideoElement | null,
  channel: DuetChannel | null,
  selfId: string | null,
  options?: UseSyncOptions,
): UseSyncReturn {
  const [drift, setDrift] = useState<number>(0);
  const [clockOffset, setClockOffset] = useState<number>(0);
  const [rtt, setRtt] = useState<number>(0);
  const [controllerId, setControllerId] = useState<string | null>(null);
  const [partnerBuffering, setPartnerBuffering] = useState<boolean>(false);
  const [selfBuffering, setSelfBuffering] = useState<boolean>(false);
  const [seq, setSeq] = useState<number>(0);
  const [partnerMedia, setPartnerMedia] = useState<MediaMsg | null>(null);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  useEffect(() => {
    videoRef.current = video;
  }, [video]);

  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const localSeqRef = useRef<number>(0);
  const lastAcceptedRef = useRef<{ seq: number; from: string } | null>(null);
  const lastSyncMsgRef = useRef<SyncMsg | null>(null);
  const suppressUntilRef = useRef<number>(0);
  const selfBufferingRef = useRef<boolean>(false);
  const controllerIdRef = useRef<string | null>(null);
  const clockEstimatorRef = useRef<ClockEstimator>(new ClockEstimator(8));

  const applyRemote = useCallback((fn: () => void | Promise<void>) => {
    suppressUntilRef.current = performance.now() + SYNC.suppressMs;
    try {
      const res = fn();
      if (res && typeof (res as Promise<void>).catch === 'function') {
        (res as Promise<void>).catch((err) => {
          console.warn('Programmatic video action rejected:', err);
        });
      }
    } catch (err) {
      console.warn('Programmatic video action error:', err);
    }
  }, []);

  const broadcastSync = useCallback(
    (playing: boolean, pos: number, rate: number, heartbeat = false) => {
      if (!channel || !selfId) return;
      const nextSeq = heartbeat
        ? localSeqRef.current
        : computeNextLocalSeq(localSeqRef.current, lastAcceptedRef.current?.seq ?? 0);

      if (!heartbeat) {
        localSeqRef.current = nextSeq;
        lastAcceptedRef.current = { seq: nextSeq, from: selfId };
        setSeq(nextSeq);
        controllerIdRef.current = selfId;
        setControllerId(selfId);
      }

      const msg: SyncMsg = {
        seq: nextSeq,
        from: selfId,
        playing,
        pos,
        rate,
        at: Date.now(),
        heartbeat,
      };

      if (!heartbeat) {
        lastSyncMsgRef.current = msg;
      }

      channel.send({
        type: 'broadcast',
        event: 'sync',
        payload: msg,
      });
    },
    [channel, selfId],
  );

  const sendPing = useCallback(() => {
    if (!channel || !selfId) return;
    const pingId = Math.random().toString(36).slice(2, 10);
    channel.send({
      type: 'broadcast',
      event: 'clock',
      payload: {
        kind: 'ping',
        id: pingId,
        from: selfId,
        t0: Date.now(),
      },
    });
  }, [channel, selfId]);

  const syncNow = useCallback(() => {
    const el = videoRef.current;
    if (!el || !lastSyncMsgRef.current) return;
    const offset = clockEstimatorRef.current.getOffset();
    const expected = expectedPos(lastSyncMsgRef.current, offset, Date.now());

    applyRemote(() => {
      if (Math.abs(el.currentTime - expected) > SYNC.pausedSeekTolerance) {
        el.currentTime = expected;
      }

      if (lastSyncMsgRef.current?.playing) {
        el.playbackRate = 1;
        if (el.paused) {
          return el.play();
        }
      } else {
        if (!el.paused) {
          el.pause();
        }
      }
    });
    setDrift(0);
  }, [applyRemote]);

  const broadcastMedia = useCallback(
    (info: MediaMsg) => {
      if (!channel) return;
      channel.send({
        type: 'broadcast',
        event: 'media',
        payload: info,
      });
    },
    [channel],
  );

  // 1. Channel listeners for incoming broadcast events
  useEffect(() => {
    if (!channel || !selfId) return;

    // Send state request on join so existing peer can sync us up immediately
    channel.send({
      type: 'broadcast',
      event: 'sync',
      payload: {
        seq: 0,
        from: selfId,
        playing: false,
        pos: 0,
        rate: 1,
        at: Date.now(),
        request: true,
      },
    });

    channel.on('broadcast', { event: 'sync' }, ({ payload }) => {
      const msg = safeParseSyncMsg(payload);
      if (!msg) return;

      if (msg.request) {
        if (msg.from !== selfId) {
          const v = videoRef.current;
          if (v && (isController(controllerIdRef.current, selfId) || lastSyncMsgRef.current)) {
            broadcastSync(!v.paused, v.currentTime, v.playbackRate, false);
          }
        }
        return;
      }

      if (!shouldAcceptRemoteSync(msg, lastAcceptedRef.current)) {
        return;
      }

      lastAcceptedRef.current = { seq: msg.seq, from: msg.from };
      setSeq(msg.seq);
      controllerIdRef.current = msg.from;
      setControllerId(msg.from);

      if (msg.heartbeat) {
        // Heartbeat from current controller: update latest reference state
        lastSyncMsgRef.current = msg;
        return;
      }

      // Fresh user action from remote peer
      lastSyncMsgRef.current = msg;
      optionsRef.current?.onPartnerAction?.(msg.playing ? 'Partner played' : 'Partner paused');
      const v = videoRef.current;
      if (!v) return;

      const offset = clockEstimatorRef.current.getOffset();
      const expected = expectedPos(msg, offset, Date.now());

      applyRemote(() => {
        if (msg.playing) {
          const d = Math.abs(v.currentTime - expected);
          if (d > SYNC.pausedSeekTolerance) {
            v.currentTime = expected;
          }
          v.playbackRate = msg.rate;
          if (v.paused) {
            return v.play();
          }
        } else {
          if (!v.paused) {
            v.pause();
          }
          if (Math.abs(v.currentTime - msg.pos) > SYNC.pausedSeekTolerance) {
            v.currentTime = msg.pos;
          }
        }
      });
    });

    channel.on('broadcast', { event: 'clock' }, ({ payload }) => {
      const msg = safeParseClockMsg(payload);
      if (!msg) return;

      if (msg.kind === 'ping' && msg.from !== selfId) {
        channel.send({
          type: 'broadcast',
          event: 'clock',
          payload: {
            kind: 'pong',
            id: msg.id,
            from: selfId,
            t0: msg.t0,
            t1: Date.now(),
          },
        });
      } else if (msg.kind === 'pong' && msg.from !== selfId) {
        const sample = clockEstimatorRef.current.addSample(msg.t0, msg.t1, Date.now());
        setClockOffset(clockEstimatorRef.current.getOffset());
        setRtt(sample.rtt);
      }
    });

    channel.on('broadcast', { event: 'buffering' }, ({ payload }) => {
      const msg = safeParseBufferMsg(payload);
      if (!msg || msg.from === selfId) return;

      setPartnerBuffering(msg.buffering);
      const v = videoRef.current;
      if (!v) return;

      if (msg.buffering) {
        // Pause locally while partner buffers, without advancing seq
        if (!v.paused) {
          applyRemote(() => {
            v.pause();
          });
        }
      } else {
        // Partner finished buffering; resume if controller state was playing
        if (lastSyncMsgRef.current?.playing && v.paused) {
          applyRemote(() => {
            return v.play();
          });
        }
      }
    });

    channel.on('broadcast', { event: 'media' }, ({ payload }) => {
      const msg = safeParseMediaMsg(payload);
      if (!msg || msg.from === selfId) return;
      setPartnerMedia(msg);
    });
  }, [channel, selfId, broadcastSync, applyRemote]);

  // 2. Local video element events (Echo-suppressed)
  useEffect(() => {
    if (!video || !channel || !selfId) return;

    let seekTimeout: ReturnType<typeof setTimeout> | null = null;

    const handlePlay = () => {
      if (performance.now() < suppressUntilRef.current) return;
      broadcastSync(true, video.currentTime, video.playbackRate, false);
    };

    const handlePause = () => {
      if (performance.now() < suppressUntilRef.current) return;
      broadcastSync(false, video.currentTime, 1, false);
    };

    const handleSeeked = () => {
      if (performance.now() < suppressUntilRef.current) return;
      if (seekTimeout) clearTimeout(seekTimeout);
      seekTimeout = setTimeout(() => {
        if (!video) return;
        if (performance.now() < suppressUntilRef.current) return;
        broadcastSync(!video.paused, video.currentTime, video.playbackRate, false);
      }, 150);
    };

    const handleWaiting = () => {
      if (performance.now() < suppressUntilRef.current) return;
      if (!selfBufferingRef.current) {
        selfBufferingRef.current = true;
        setSelfBuffering(true);
        channel.send({
          type: 'broadcast',
          event: 'buffering',
          payload: { from: selfId, buffering: true },
        });
      }
    };

    const handlePlaying = () => {
      if (selfBufferingRef.current) {
        selfBufferingRef.current = false;
        setSelfBuffering(false);
        channel.send({
          type: 'broadcast',
          event: 'buffering',
          payload: { from: selfId, buffering: false },
        });
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('seeked', handleSeeked);
    video.addEventListener('waiting', handleWaiting);
    video.addEventListener('stalled', handleWaiting);
    video.addEventListener('playing', handlePlaying);
    video.addEventListener('canplay', handlePlaying);

    return () => {
      if (seekTimeout) clearTimeout(seekTimeout);
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('seeked', handleSeeked);
      video.removeEventListener('waiting', handleWaiting);
      video.removeEventListener('stalled', handleWaiting);
      video.removeEventListener('playing', handlePlaying);
      video.removeEventListener('canplay', handlePlaying);
    };
  }, [video, channel, selfId, broadcastSync]);

  // 3. NTP clock sync schedule (burst on join, then periodic every 30s)
  useEffect(() => {
    if (!channel || !selfId) return;

    sendPing();
    // Quick samples at startup
    const burst = setInterval(() => {
      if (clockEstimatorRef.current.getSampleCount() < 8) {
        sendPing();
      } else {
        clearInterval(burst);
      }
    }, 300);

    // Periodic refresh every 30s
    const periodic = setInterval(() => {
      sendPing();
    }, 30000);

    const handleVisibility = () => {
      if (!document.hidden) {
        sendPing();
        syncNow();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(burst);
      clearInterval(periodic);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [channel, selfId, sendPing, syncNow]);

  // 4. Controller Heartbeat schedule (every 2000ms while playing)
  useEffect(() => {
    if (!channel || !selfId) return;

    const timer = setInterval(() => {
      const v = videoRef.current;
      if (isController(controllerIdRef.current, selfId) && v && !v.paused) {
        broadcastSync(true, v.currentTime, v.playbackRate, true);
      }
    }, SYNC.heartbeatMs);

    return () => clearInterval(timer);
  }, [channel, selfId, broadcastSync]);

  // 5. 250ms Correction Tick while playing
  useEffect(() => {
    if (!channel || !selfId) return;

    const tick = setInterval(() => {
      const v = videoRef.current;
      if (!v || !lastSyncMsgRef.current || v.paused) {
        return;
      }

      const offset = clockEstimatorRef.current.getOffset();
      const expected = expectedPos(lastSyncMsgRef.current, offset, Date.now());
      const currentDrift = calculateDrift(v.currentTime, expected);
      setDrift(currentDrift);

      // Only non-controllers correct drift; controller dictates
      if (!isController(controllerIdRef.current, selfId) && !partnerBuffering) {
        const corr = decideCorrection(v.currentTime, expected, true, SYNC);
        if (corr.kind === 'rate') {
          if (v.playbackRate !== corr.rate) {
            v.playbackRate = corr.rate;
          }
        } else if (corr.kind === 'seek') {
          applyRemote(() => {
            v.playbackRate = 1;
            v.currentTime = corr.to;
          });
        }
      }
    }, 250);

    return () => clearInterval(tick);
  }, [channel, selfId, partnerBuffering, applyRemote]);

  return {
    drift,
    clockOffset,
    rtt,
    isController: isController(controllerId, selfId ?? ''),
    controllerId,
    partnerBuffering,
    selfBuffering,
    seq,
    syncNow,
    broadcastMedia,
    partnerMedia,
  };
}
