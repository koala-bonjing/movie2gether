import { useEffect, useRef, useState, useCallback } from 'react';
import type { DuetChannel } from '../../lib/supabase';
import { safeParseSignalMsg, type SignalMsg } from '../sync/protocol';
import { env } from '../../lib/env';
import {
  getIceServers,
  isPolitePeer,
  parseRtpVideoStats,
  isScreenShareSupported,
  applyBitrateCap,
  configureScreenTrack,
  SCREEN_SHARE_CONSTRAINTS,
  type VideoStats,
  type VideoStatsHistory,
} from './webrtc';

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
  answerCall: (withLocalMedia?: boolean) => Promise<void>;
  endCall: (notifyPartner?: boolean) => void;
  toggleCam: () => void;
  toggleMic: () => void;
  restartIce: () => void;
  isScreenSharing: boolean;
  remoteScreenSharing: boolean;
  isScreenShareAvailable: boolean;
  screenStream: MediaStream | null;
  startScreenShare: () => Promise<void>;
  stopScreenShare: () => Promise<void>;
  toggleScreenShare: () => Promise<void>;
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

  // Screen share & stream mode states
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [remoteScreenSharing, setRemoteScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const isScreenSharingRef = useRef(false);
  const cameraVideoTrackRef = useRef<MediaStreamTrack | null>(null);
  const micAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const statsHistoryRef = useRef<VideoStatsHistory | undefined>(undefined);

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
    (camOn: boolean, micOn: boolean, screenSharing = isScreenSharingRef.current) => {
      sendSignal({
        type: 'media-state',
        camOn,
        micOn,
        screenSharing,
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

      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((track) => track.stop());
        screenStreamRef.current = null;
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
      cameraVideoTrackRef.current = null;
      micAudioTrackRef.current = null;
      statsHistoryRef.current = undefined;

      if (isMountedRef.current) {
        setLocalStream(null);
        setRemoteStream(null);
        setScreenStream(null);
        setIsScreenSharing(false);
        isScreenSharingRef.current = false;
        setRemoteScreenSharing(false);
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
    const pc = pcRef.current;
    if (pc && typeof pc.restartIce === 'function') {
      try {
        pc.restartIce();
        if (pc.signalingState === 'stable') {
          makingOfferRef.current = true;
          pc.setLocalDescription()
            .then(() => {
              if (pc.localDescription) {
                sendSignal({
                  type: 'description',
                  description: {
                    type: pc.localDescription.type,
                    sdp: pc.localDescription.sdp,
                  },
                });
              }
            })
            .catch((err) => {
              console.warn('restartIce offer generation failed:', err);
            })
            .finally(() => {
              makingOfferRef.current = false;
            });
        }
      } catch (err) {
        console.warn('restartIce failed:', err);
      }
    }
  }, [sendSignal]);

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
    (stream: MediaStream | null): RTCPeerConnection => {
      const iceServers = getIceServers({
        stunUrls: env.VITE_STUN_URLS,
        turnUrl: env.VITE_TURN_URL,
        turnUser: env.VITE_TURN_USER,
        turnCred: env.VITE_TURN_CRED,
      });

      const pc = new RTCPeerConnection({ iceServers });
      pcRef.current = pc;

      // Add local media tracks if provided
      if (stream) {
        for (const track of stream.getTracks()) {
          pc.addTrack(track, stream);
        }
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
          sendMediaState(isCamOnRef.current, isMicOnRef.current, isScreenSharingRef.current);
        } else if (state === 'disconnected') {
          setConnectionState('disconnected');
        } else if (state === 'failed') {
          setConnectionState('failed');
          setErrorMessage('P2P connection dropped. Attempting automatic reconnection…');
          restartIce();
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
            const { stats: parsed, history } = parseRtpVideoStats(stats, statsHistoryRef.current);
            statsHistoryRef.current = history;
            if (parsed.width || parsed.height || parsed.fps || parsed.bitrateKbps) {
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
        sendMediaState(!audioOnly, true, isScreenSharingRef.current);
      }
    } catch (mediaErr) {
      console.error('Microphone and camera access denied:', mediaErr);
      setConnectionState('denied');
      setErrorMessage('Camera/microphone access was denied. Please allow permissions to start the call.');
    }
  }, [initPeerConnection, sendSignal, sendMediaState]);

  const answerCall = useCallback(
    async (withLocalMedia = true) => {
      if (!withLocalMedia) {
        try {
          setConnectionState('connecting');
          const pc = pcRef.current ?? initPeerConnection(null);
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
          }
        } catch (err) {
          console.warn('Failed to answer call as viewer:', err);
        }
        return;
      }
      await startCall();
    },
    [initPeerConnection, sendSignal, startCall],
  );

  const stopScreenShare = useCallback(async () => {
    if (!isScreenSharingRef.current && !screenStreamRef.current) return;

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;
    }
    setScreenStream(null);
    setIsScreenSharing(false);
    isScreenSharingRef.current = false;

    const pc = pcRef.current;
    if (pc) {
      // Restore camera video track if it existed
      const videoSender = pc.getSenders().find(
        (s) => s.track?.kind === 'video' || (s as { kind?: string }).kind === 'video',
      );
      const camTrack = cameraVideoTrackRef.current ?? localStreamRef.current?.getVideoTracks()[0] ?? null;
      if (videoSender) {
        try {
          await videoSender.replaceTrack(camTrack);
        } catch (err) {
          console.warn('Failed to restore camera track:', err);
        }
      }

      // Restore microphone audio track if it existed
      const audioSender = pc.getSenders().find(
        (s) => s.track?.kind === 'audio' || (s as { kind?: string }).kind === 'audio',
      );
      const micTrack = micAudioTrackRef.current ?? localStreamRef.current?.getAudioTracks()[0] ?? null;
      if (audioSender && micTrack) {
        try {
          await audioSender.replaceTrack(micTrack);
        } catch (err) {
          console.warn('Failed to restore microphone track:', err);
        }
      }
    }

    sendMediaState(isCamOnRef.current, isMicOnRef.current, false);
  }, [sendMediaState]);

  const startScreenShare = useCallback(async () => {
    if (!isScreenShareSupported()) {
      setErrorMessage('Screen sharing is not supported on this device/browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getDisplayMedia(SCREEN_SHARE_CONSTRAINTS);
      const [screenVideoTrack] = stream.getVideoTracks();
      if (!screenVideoTrack) {
        throw new Error('No video track returned from screen share');
      }
      configureScreenTrack(screenVideoTrack);

      const [screenAudio] = stream.getAudioTracks();
      screenStreamRef.current = stream;
      setScreenStream(stream);
      setIsScreenSharing(true);
      isScreenSharingRef.current = true;

      // Auto-stop when user clicks browser's native "Stop sharing" button
      screenVideoTrack.onended = () => {
        void stopScreenShare();
      };

      let pc = pcRef.current;
      if (!pc) {
        // If call is not started yet, establish peer connection with screenStream
        localStreamRef.current = stream;
        setLocalStream(stream);
        setConnectionState('connecting');
        pc = initPeerConnection(stream);
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video');
        if (sender) {
          void applyBitrateCap(sender, 6_000_000);
        }
      } else {
        // Existing call: replace video track without renegotiation storms
        const videoSender = pc.getSenders().find(
          (s) => s.track?.kind === 'video' || (s as { kind?: string }).kind === 'video',
        );
        if (videoSender) {
          cameraVideoTrackRef.current =
            videoSender.track ?? localStreamRef.current?.getVideoTracks()[0] ?? null;
          await videoSender.replaceTrack(screenVideoTrack);
          await applyBitrateCap(videoSender, 6_000_000);
        } else {
          pc.addTrack(screenVideoTrack, stream);
        }

        if (screenAudio) {
          const audioSender = pc.getSenders().find(
            (s) => s.track?.kind === 'audio' || (s as { kind?: string }).kind === 'audio',
          );
          if (audioSender) {
            micAudioTrackRef.current =
              audioSender.track ?? localStreamRef.current?.getAudioTracks()[0] ?? null;
            await audioSender.replaceTrack(screenAudio);
          } else {
            pc.addTrack(screenAudio, stream);
          }
        }
      }

      sendMediaState(isCamOnRef.current, isMicOnRef.current, true);
    } catch (err) {
      if ((err as Error).name !== 'NotAllowedError') {
        console.warn('Failed to start screen share:', err);
        setErrorMessage('Could not start screen sharing.');
      }
    }
  }, [initPeerConnection, sendMediaState, stopScreenShare]);

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharingRef.current) {
      await stopScreenShare();
    } else {
      await startScreenShare();
    }
  }, [startScreenShare, stopScreenShare]);

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

      // 1. Media state synchronization (mute / camera toggle / screen share)
      if (data.type === 'media-state') {
        setRemoteCamOn(data.camOn);
        setRemoteMicOn(data.micOn);
        setRemoteScreenSharing(!!data.screenSharing);
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
          // If remote peer reloaded and sent an offer with incompatible m-lines order,
          // recreate local peer connection with existing local stream and accept the offer
          if (isOffer && localStreamRef.current) {
            try {
              if (pc) {
                pc.close();
              }
              const newPc = initPeerConnection(localStreamRef.current);
              await newPc.setRemoteDescription(desc);
              await drainPendingCandidates(newPc);
              await newPc.setLocalDescription();
              if (newPc.localDescription) {
                sendSignal({
                  type: 'description',
                  description: {
                    type: newPc.localDescription.type,
                    sdp: newPc.localDescription.sdp,
                  },
                });
              }
            } catch (retryErr) {
              console.warn('Retry with clean PeerConnection failed:', retryErr);
            }
          }
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
  }, [channel, endCall, sendSignal, initPeerConnection]);

  // Automatic WebRTC re-negotiation when network comes back online
  useEffect(() => {
    const handleOnline = () => {
      if (pcRef.current && connectionState !== 'idle') {
        restartIce();
      }
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('online', handleOnline);
      return () => window.removeEventListener('online', handleOnline);
    }
  }, [connectionState, restartIce]);

  // Re-sync media state and restart ICE if channel reconnects while in call
  useEffect(() => {
    if (!channel) return;
    if (connectionState === 'connected' || connectionState === 'disconnected') {
      restartIce();
      sendMediaState(isCamOnRef.current, isMicOnRef.current, isScreenSharingRef.current);
    }
  }, [channel, connectionState, restartIce, sendMediaState]);

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
    answerCall,
    endCall,
    toggleCam,
    toggleMic,
    restartIce,
    isScreenSharing,
    remoteScreenSharing,
    isScreenShareAvailable: isScreenShareSupported(),
    screenStream,
    startScreenShare,
    stopScreenShare,
    toggleScreenShare,
  };
}

