import { useEffect, useRef, useState, useCallback } from 'react';
import type { DuetChannel } from '../../lib/supabase';
import { safeParseSignalMsg, type SignalMsg } from '../sync/protocol';
import { env } from '../../lib/env';
import { getIceServers, isPolitePeer, parseRtpVideoStats, type VideoStats } from './webrtc';

export type CallConnectionState =
  | 'idle'
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
  endCall: () => void;
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
  const statsTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isMountedRef = useRef(true);

  // Helper to send signal messages over Supabase broadcast
  const sendSignal = useCallback(
    (data: SignalMsg['data']) => {
      if (!channel || !selfUserId || !partnerUserId) return;
      channel
        .send({
          type: 'broadcast',
          event: 'signal',
          payload: {
            from: selfUserId,
            to: partnerUserId,
            data,
          },
        })
        .catch((err) => {
          console.warn('Failed to send signal:', err);
        });
    },
    [channel, selfUserId, partnerUserId],
  );

  const endCall = useCallback(() => {
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

    if (isMountedRef.current) {
      setLocalStream(null);
      setRemoteStream(null);
      setConnectionState('idle');
      setErrorMessage(null);
      setRemoteStats(null);
      setIsAudioOnly(false);
      setIsCamOn(true);
      setIsMicOn(true);
    }
  }, []);

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
      videoTrack.enabled = !videoTrack.enabled;
      setIsCamOn(videoTrack.enabled);
    }
  }, []);

  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMicOn(audioTrack.enabled);
    }
  }, []);

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

        // Track mute/unmute states on remote tracks
        event.track.onmute = () => {
          if (event.track.kind === 'video') setRemoteCamOn(false);
          if (event.track.kind === 'audio') setRemoteMicOn(false);
        };
        event.track.onunmute = () => {
          if (event.track.kind === 'video') setRemoteCamOn(true);
          if (event.track.kind === 'audio') setRemoteMicOn(true);
        };
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
        } else if (state === 'disconnected') {
          setConnectionState('disconnected');
        } else if (state === 'failed') {
          setConnectionState('failed');
          setErrorMessage('P2P connection failed. Check your network or firewall settings.');
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
    [sendSignal, restartIce],
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

      initPeerConnection(stream);
    } catch (mediaErr) {
      console.error('Microphone and camera access denied:', mediaErr);
      setConnectionState('denied');
      setErrorMessage('Camera/microphone access was denied. Please allow permissions to start the call.');
    }
  }, [initPeerConnection]);

  // Handle incoming signaling messages from partner
  useEffect(() => {
    if (!channel || !selfUserId || !partnerUserId) return;

    const handleSignal = async ({ payload }: { payload: unknown }) => {
      const parsed = safeParseSignalMsg(payload);
      if (!parsed) return;

      // Must be addressed to us and from our partner
      if (parsed.to !== selfUserId || parsed.from !== partnerUserId) return;

      const pc = pcRef.current;
      if (!pc) {
        // If we haven't started local call yet, we can accept if partner initiated
        return;
      }

      const polite = isPolitePeer(selfUserId, partnerUserId);
      const { data } = parsed;

      try {
        if (data.type === 'description') {
          const desc = data.description as unknown as RTCSessionDescriptionInit;
          const isOffer = desc.type === 'offer';
          const offerCollision = isOffer && (makingOfferRef.current || pc.signalingState !== 'stable');

          ignoreOfferRef.current = !polite && offerCollision;
          if (ignoreOfferRef.current) {
            return;
          }

          await pc.setRemoteDescription(desc);

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
        } else if (data.type === 'candidate') {
          try {
            if (data.candidate) {
              await pc.addIceCandidate(data.candidate);
            }
          } catch (iceErr) {
            if (!ignoreOfferRef.current) {
              console.warn('Error adding ICE candidate:', iceErr);
            }
          }
        }
      } catch (err) {
        console.warn('Signaling error:', err);
      }
    };

    channel.on('broadcast', { event: 'signal' }, handleSignal);
  }, [channel, selfUserId, partnerUserId, sendSignal]);

  // Cleanup on unmount or when partner leaves
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      endCall();
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
