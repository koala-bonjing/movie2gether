import { useEffect, useRef, useState, useCallback } from 'react';
import type { DuetChannel } from '../../lib/supabase';
import { safeParseSignalMsg, type SignalMsg } from '../sync/protocol';
import { env } from '../../lib/env';
import { getIceServers, isPolitePeer, parseRtpVideoStats, type VideoStats } from './webrtc';

export type CallConnectionState =
  | 'idle'
  | 'incoming'
  | 'requesting-media'
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'failed'
  | 'denied';

export interface UseCallOptions {
  channel: DuetChannel | null;
  selfUserId: string | null;
  partnerUserId: string | null;
}

export interface UseCallReturn {
  connectionState: CallConnectionState;
  errorMessage: string | null;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  isCamOn: boolean;
  isMicOn: boolean;
  isAudioOnly: boolean;
  remoteCamOn: boolean;
  remoteMicOn: boolean;
  remoteStats: VideoStats | null;
  startCall: () => Promise<void>;
  endCall: (notifyPartner?: boolean) => void;
  toggleCam: () => void;
  toggleMic: () => void;
  restartIce: () => void;
}

export function useCall({
  channel,
  selfUserId,
  partnerUserId,
}: UseCallOptions): UseCallReturn {
  const [connectionState, setConnectionState] = useState<CallConnectionState>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCamOn, setIsCamOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [isAudioOnly, setIsAudioOnly] = useState(false);
  const [remoteCamOn, setRemoteCamOn] = useState(true);
  const [remoteMicOn, setRemoteMicOn] = useState(true);
  const [remoteStats, setRemoteStats] = useState<VideoStats | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const makingOfferRef = useRef(false);
  const ignoreOfferRef = useRef(false);
  const pendingRemoteOfferRef = useRef<RTCSessionDescriptionInit | null>(null);
  const pendingCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  const isCamOnRef = useRef(isCamOn);
  useEffect(() => {
    isCamOnRef.current = isCamOn;
  }, [isCamOn]);

  const isMicOnRef = useRef(isMicOn);
  useEffect(() => {
    isMicOnRef.current = isMicOn;
  }, [isMicOn]);

  const channelRef = useRef(channel);
  useEffect(() => {
    channelRef.current = channel;
  }, [channel]);

  const selfUserIdRef = useRef(selfUserId);
  useEffect(() => {
    selfUserIdRef.current = selfUserId;
  }, [selfUserId]);

  const partnerUserIdRef = useRef(partnerUserId);
  useEffect(() => {
    partnerUserIdRef.current = partnerUserId;
  }, [partnerUserId]);

  // Helper to send signal messages over Supabase broadcast
  const sendSignal = useCallback((data: SignalMsg['data']) => {
    const ch = channelRef.current;
    const selfId = selfUserIdRef.current;
    const partnerId = partnerUserIdRef.current;
    if (!ch || !selfId || !partnerId) return;
    ch.send({
      type: 'broadcast',
      event: 'signal',
      payload: {
        from: selfId,
        to: partnerId,
        data,
      },
    }).catch((err) => {
      console.warn('Failed to send signal:', err);
    });
  }, []);

  const sendMediaState = useCallback(
    (camOn: boolean, micOn: boolean) => {
      sendSignal({
        type: 'media-state',
        camOn,
        micOn,
      });
    },
    [sendSignal],
  );

  const endCall = useCallback(
    (notifyPartner = true) => {
      if (notifyPartner) {
        sendSignal({ type: 'hang-up' });
      }

      if (statsTimerRef.current) {
        clearInterval(statsTimerRef.current);
        statsTimerRef.current = null;
      }

      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop());
        localStreamRef.current = null;
      }

      if (pcRef.current) {
        pcRef.current.onicecandidate = null;
        pcRef.current.onnegotiationneeded = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.close();
        pcRef.current = null;
      }

      pendingRemoteOfferRef.current = null;
      pendingCandidatesRef.current = [];
      makingOfferRef.current = false;
      ignoreOfferRef.current = false;

      if (isMountedRef.current) {
        setLocalStream(null);
        setRemoteStream(null);
        setConnectionState('idle');
        setErrorMessage(null);
        setRemoteStats(null);
        setIsAudioOnly(false);
        setIsCamOn(true);
        setIsMicOn(true);
        setRemoteCamOn(true);
        setRemoteMicOn(true);
      }
    },
    [sendSignal],
  );

  const restartIce = useCallback(() => {
    if (pcRef.current && typeof pcRef.current.restartIce === 'function') {
      try {
        pcRef.current.restartIce();
      } catch (err) {
        console.warn('restartIce failed:', err);
      }
    }
  }, []);

  const toggleCam = useCallback(() => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      const next = !videoTrack.enabled;
      videoTrack.enabled = next;
      setIsCamOn(next);
      sendMediaState(next, isMicOnRef.current);
    }
  }, [sendMediaState]);

  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      const next = !audioTrack.enabled;
      audioTrack.enabled = next;
      setIsMicOn(next);
      sendMediaState(isCamOnRef.current, next);
    }
  }, [sendMediaState]);

  const drainPendingCandidates = async (pc: RTCPeerConnection) => {
    const queue = [...pendingCandidatesRef.current];
    pendingCandidatesRef.current = [];
    for (const cand of queue) {
      try {
        await pc.addIceCandidate(cand);
      } catch (err) {
        console.warn('Failed to add buffered candidate:', err);
      }
    }
  };

  // Perfect Negotiation PeerConnection setup
  const initPeerConnection = useCallback(
    (stream: MediaStream): RTCPeerConnection => {
      const iceServers = getIceServers({
        stunUrls: env.VITE_STUN_URLS,
        turnUrl: env.VITE_TURN_URL,
        turnUser: env.VITE_TURN_USER,
        turnCred: env.VITE_TURN_CRED,
      });

      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      // Add local media tracks
      for (const track of stream.getTracks()) {
        pc.addTrack(track, stream);
      }

      // Handle remote incoming tracks
      pc.ontrack = (event) => {
        const [incomingStream] = event.streams;
        const targetStream = incomingStream || new MediaStream([event.track]);
        setRemoteStream(targetStream);
      };

      // Perfect Negotiation offer generation
      pc.onnegotiationneeded = async () => {
        try {
          makingOfferRef.current = true;
          await pc.setLocalDescription();
          if (pc.localDescription) {
            sendSignal({
              type: 'description',
              description: {
                type: pc.localDescription.type,
                sdp: pc.localDescription.sdp,
              },
            });
          }
        } catch (err) {
          console.warn('onnegotiationneeded error:', err);
        } finally {
          makingOfferRef.current = false;
        }
      };

      // Trickle ICE candidates
      pc.onicecandidate = ({ candidate }) => {
        if (candidate) {
          sendSignal({
            type: 'candidate',
            candidate: candidate.toJSON() as Record<string, unknown>,
          });
        }
      };

      // Connection state changes
      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        if (state === 'connected') {
          setConnectionState('connected');
          setErrorMessage(null);
          // Broadcast current media state to partner
          sendMediaState(isCamOnRef.current, isMicOnRef.current);
        } else if (state === 'disconnected') {
          setConnectionState('disconnected');
        } else if (state === 'failed') {
          setConnectionState('failed');
          setErrorMessage('P2P connection failed. Check your network or firewall settings (TURN may be required).');
        }
      };

      // ICE restart on failure
      pc.oniceconnectionstatechange = () => {
        if (pc.iceConnectionState === 'failed') {
          restartIce();
        }
      };

      // Setup 2-second stats query when connected
      statsTimerRef.current = setInterval(async () => {
        if (pc.connectionState === 'connected') {
          try {
            const stats = await pc.getStats();
            const parsed = parseRtpVideoStats(stats);
            if (parsed.width || parsed.height || parsed.fps) {
              setRemoteStats(parsed);
            }
          } catch {
            // ignore
          }
        }
      }, 2000);

      return pc;
    },
    [sendSignal, sendMediaState, restartIce],
  );

  const startCall = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setConnectionState('denied');
      setErrorMessage('Media devices are not supported in this environment.');
      return;
    }

    try {
      setConnectionState('requesting-media');
      setErrorMessage(null);

      let stream: MediaStream;
      let audioOnly = false;

      try {
        // Attempt Camera + Microphone
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 360 },
            frameRate: { ideal: 24 },
          },
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
      } catch (videoErr) {
        console.warn('Failed to get video track, attempting audio-only fallback:', videoErr);
        // Graceful audio-only fallback on video error/denial
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        audioOnly = true;
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsAudioOnly(audioOnly);
      setIsCamOn(!audioOnly);
      setIsMicOn(true);
      setConnectionState('connecting');

      const pc = initPeerConnection(stream);

      // If partner already sent an offer before we clicked Start Call, answer it now
      if (pendingRemoteOfferRef.current) {
        const pendingDesc = pendingRemoteOfferRef.current;
        pendingRemoteOfferRef.current = null;
        await pc.setRemoteDescription(pendingDesc);
        await drainPendingCandidates(pc);
        await pc.setLocalDescription();
        if (pc.localDescription) {
          sendSignal({
            type: 'description',
            description: {
              type: pc.localDescription.type,
              sdp: pc.localDescription.sdp,
            },
          });
        }
        sendMediaState(!audioOnly, true);
      }
    } catch (mediaErr) {
      console.error('Microphone and camera access denied:', mediaErr);
      setConnectionState('denied');
      setErrorMessage('Camera/microphone access was denied. Please allow permissions to start the call.');
    }
  }, [initPeerConnection, sendSignal, sendMediaState]);

  // Handle incoming signaling messages from partner
  useEffect(() => {
    if (!channel) return;

    const handleSignal = async ({ payload }: { payload: unknown }) => {
      const parsed = safeParseSignalMsg(payload);
      if (!parsed) return;

      const selfId = selfUserIdRef.current;
      const partnerId = partnerUserIdRef.current;
      if (!selfId || !partnerId) return;

      // Must be addressed to us and from our partner
      if (parsed.to !== selfId || parsed.from !== partnerId) return;

      const { data } = parsed;

      // 1. Media state synchronization (mute / camera toggle)
      if (data.type === 'media-state') {
        setRemoteCamOn(data.camOn);
        setRemoteMicOn(data.micOn);
        return;
      }

      // 2. Hang up by remote partner
      if (data.type === 'hang-up') {
        endCall(false);
        return;
      }

      // 3. Descriptions (offer / answer)
      if (data.type === 'description') {
        const desc = data.description as unknown as RTCSessionDescriptionInit;
        const pc = pcRef.current;

        // If we haven't started local call yet and received an offer:
        if (!pc) {
          if (desc.type === 'offer') {
            pendingRemoteOfferRef.current = desc;
            setConnectionState('incoming');
          }
          return;
        }

        const polite = isPolitePeer(selfId, partnerId);
        const isOffer = desc.type === 'offer';
        const offerCollision = isOffer && (makingOfferRef.current || pc.signalingState !== 'stable');

        ignoreOfferRef.current = !polite && offerCollision;
        if (ignoreOfferRef.current) {
          return;
        }

        try {
          await pc.setRemoteDescription(desc);
          await drainPendingCandidates(pc);

          if (isOffer) {
            await pc.setLocalDescription();
            if (pc.localDescription) {
              sendSignal({
                type: 'description',
                description: {
                  type: pc.localDescription.type,
                  sdp: pc.localDescription.sdp,
                },
              });
            }
          }
        } catch (err) {
          console.warn('Signaling description error:', err);
        }
        return;
      }

      // 4. ICE Candidates
      if (data.type === 'candidate') {
        if (!data.candidate) return;
        const cand = data.candidate as unknown as RTCIceCandidateInit;
        const pc = pcRef.current;

        if (!pc || !pc.remoteDescription) {
          // Buffer candidate until remote description is set
          pendingCandidatesRef.current.push(cand);
          return;
        }

        try {
          await pc.addIceCandidate(cand);
        } catch (iceErr) {
          if (!ignoreOfferRef.current) {
            console.warn('Error adding ICE candidate:', iceErr);
          }
        }
      }
    };

    channel.on('broadcast', { event: 'signal' }, handleSignal);
  }, [channel, endCall, sendSignal]);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      endCall(true);
    };
  }, [endCall]);

  return {
    connectionState,
    errorMessage,
    localStream,
    remoteStream,
    isCamOn,
    isMicOn,
    isAudioOnly,
    remoteCamOn,
    remoteMicOn,
    remoteStats,
    startCall,
    endCall,
    toggleCam,
    toggleMic,
    restartIce,
  };
}
