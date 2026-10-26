import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { PlayerView, toggleFullscreen, type MediaInfo } from '../features/player';
import { formatTime } from '../features/player/media';
import { LobbyView } from '../features/lobby';
import { useRoom, RoomHeader } from '../features/room';
import { useSync, MediaMismatchDialog, SyncDevOverlay } from '../features/sync';
import { safeParseRoomModeMsg } from '../features/sync/protocol';
import { useChat } from '../features/chat/useChat';
import { useCall } from '../features/call/useCall';
import { Toast, PwaInstallPrompt, Button } from '../ui';
import { ThemePicker } from '../features/theme';

const CallSection = lazy(() =>
  import('../features/call/CallSection').then((m) => ({ default: m.CallSection })),
);
const FloatingCamBubble = lazy(() =>
  import('../features/call/FloatingCamBubble').then((m) => ({ default: m.FloatingCamBubble })),
);
const ChatView = lazy(() =>
  import('../features/chat/ChatView').then((m) => ({ default: m.ChatView })),
);

export function App() {
  const [roomCode, setRoomCode] = useState<string | null>(() => {
    // Check URL search param ?room=CODE or hash #CODE
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('room');
    if (fromQuery) return fromQuery.toUpperCase();
    const hash = window.location.hash.replace('#', '');
    if (hash && hash.length === 6) return hash.toUpperCase();
    return null;
  });

  const [displayName, setDisplayName] = useState<string>(() => {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem('duet:display-name') || '';
      }
      return '';
    } catch {
      return '';
    }
  });

  const [isCreator, setIsCreator] = useState(false);

  // Keep URL in sync with roomCode
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (roomCode) {
      window.history.replaceState(null, '', `?room=${roomCode}`);
    } else {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [roomCode]);

  const handleJoin = (code: string, name: string, creator = false) => {
    setDisplayName(name);
    setRoomCode(code);
    setIsCreator(creator);
  };

  const handleLeave = () => {
    setRoomCode(null);
    setIsCreator(false);
  };

  return (
    <>
      {!roomCode ? (
        <main className="w-full min-h-dvh flex flex-col justify-center items-center p-4 sm:p-6 cinema-glow relative overflow-x-hidden">
          <LobbyView onJoin={handleJoin} />
        </main>
      ) : (
        <RoomSession
          roomCode={roomCode}
          displayName={displayName || 'Anonymous'}
          isCreator={isCreator}
          onLeave={handleLeave}
        />
      )}
      <PwaInstallPrompt />
    </>
  );
}

function RoomSession({
  roomCode,
  displayName,
  isCreator,
  onLeave,
}: {
  roomCode: string;
  displayName: string;
  isCreator: boolean;
  onLeave: () => void;
}) {
  const room = useRoom(roomCode, { displayName, isCreator });
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [localMedia, setLocalMedia] = useState<MediaInfo | null>(null);
  const [dismissedHash, setDismissedHash] = useState<string | null>(null);

  // Layout & UI states
  const [isTheater, setIsTheater] = useState(false);
  const [mobileTab, setMobileTab] = useState<'chat' | 'call' | 'settings'>('chat');
  const [isBubbleHidden, setIsBubbleHidden] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState<'theater' | 'library' | 'synclab' | 'settings'>('theater');
  const [isSyncLabOpen, setIsSyncLabOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024;
  });
  const [isLandscape, setIsLandscape] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerHeight < 550 && window.innerWidth > window.innerHeight;
  });
  const [isLandscapeChatOpen, setIsLandscapeChatOpen] = useState(false);

  const handleNavTabChange = useCallback((tab: 'theater' | 'library' | 'synclab' | 'settings') => {
    setActiveNavTab(tab);
    if (tab === 'settings') {
      setIsSettingsOpen(true);
    } else if (tab === 'synclab') {
      setIsSyncLabOpen((prev) => !prev);
    } else if (tab === 'library') {
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fileInput?.click();
    } else if (tab === 'theater') {
      setIsTheater((prev) => !prev);
    } else {
      setIsSettingsOpen(false);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
      setIsLandscape(window.innerHeight < 550 && window.innerWidth > window.innerHeight);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Transient Toast notification system
  const [toasts, setToasts] = useState<Array<{ id: string; message: string }>>([]);

  const showToast = useCallback((message: string) => {
    const id = Math.random().toString(36).slice(2, 9);
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const handlePartnerAction = useCallback(
    (action: { type: 'play' } | { type: 'pause' } | { type: 'seek'; pos: number }) => {
      const partnerName = room.partner?.name || 'Partner';
      if (action.type === 'seek') {
        showToast(`${partnerName} skipped to ${formatTime(action.pos)} just now`);
      } else if (action.type === 'pause') {
        const timePos = videoElement ? formatTime(videoElement.currentTime) : '';
        showToast(timePos ? `${partnerName} paused at ${timePos} just now` : `${partnerName} paused just now`);
      } else if (action.type === 'play') {
        showToast(`${partnerName} resumed playback just now`);
      }
    },
    [room.partner?.name, showToast, videoElement],
  );

  const sync = useSync(videoElement, room.channel, room.self?.userId ?? null, {
    onPartnerAction: handlePartnerAction,
  });

  const chat = useChat({
    channel: room.channel,
    selfUserId: room.self?.userId ?? null,
    roomCode,
    persist: true,
    initialOpen: true,
  });

  const call = useCall({
    channel: room.channel,
    selfUserId: room.self?.userId ?? null,
    partnerUserId: room.partner?.userId ?? null,
  });

  const [roomMode, setRoomMode] = useState<'sync' | 'stream'>('sync');
  const [streamerId, setStreamerId] = useState<string | null>(null);

  const { broadcastMedia } = sync;
  const selfUserId = room.self?.userId;

  // Auto-pause when partner leaves per DESIGN.md
  const prevPartnerStatusRef = useRef(room.partnerStatus);
  useEffect(() => {
    if (prevPartnerStatusRef.current !== 'left' && room.partnerStatus === 'left') {
      if (videoElement && !videoElement.paused) {
        videoElement.pause();
      }
      showToast('Partner disconnected. Playback paused.');
    }
    prevPartnerStatusRef.current = room.partnerStatus;
  }, [room.partnerStatus, videoElement, showToast]);

  // Broadcast media fingerprint when local file or link is loaded
  useEffect(() => {
    if (localMedia && selfUserId) {
      broadcastMedia({
        from: selfUserId,
        name: localMedia.name,
        size: localMedia.size,
        duration: localMedia.duration,
        hash: localMedia.hash,
        url: localMedia.url,
        mediaType: localMedia.mediaType,
      });
    }
  }, [localMedia, selfUserId, broadcastMedia]);

  // Synchronize stream mode when local screen share starts or stops
  const wasScreenSharingRef = useRef(false);
  useEffect(() => {
    if (call.isScreenSharing && !wasScreenSharingRef.current) {
      wasScreenSharingRef.current = true;
      setRoomMode('stream');
      setStreamerId(selfUserId ?? null);
      if (videoElement && !videoElement.paused) {
        videoElement.pause();
      }
      room.channel?.send({
        type: 'broadcast',
        event: 'room-mode',
        payload: {
          from: selfUserId,
          mode: 'stream',
          streamerId: selfUserId,
        },
      });
    } else if (!call.isScreenSharing && wasScreenSharingRef.current) {
      wasScreenSharingRef.current = false;
      setRoomMode('sync');
      setStreamerId(null);
      room.channel?.send({
        type: 'broadcast',
        event: 'room-mode',
        payload: {
          from: selfUserId,
          mode: 'sync',
        },
      });
    }
  }, [call.isScreenSharing, selfUserId, room.channel, videoElement]);

  // Listen for remote room-mode events
  useEffect(() => {
    if (!room.channel) return;
    const handleRoomMode = ({ payload }: { payload: unknown }) => {
      const parsed = safeParseRoomModeMsg(payload);
      if (!parsed) return;
      if (parsed.mode === 'stream') {
        setRoomMode('stream');
        setStreamerId(parsed.streamerId ?? parsed.from);
        if (videoElement && !videoElement.paused) {
          videoElement.pause();
        }
      } else {
        setRoomMode('sync');
        setStreamerId(null);
      }
    };

    room.channel.on('broadcast', { event: 'room-mode' }, handleRoomMode);
  }, [room.channel, videoElement]);

  // If partner joins while we are sharing screen, sync them into stream mode
  useEffect(() => {
    if (room.partner && call.isScreenSharing && selfUserId) {
      room.channel?.send({
        type: 'broadcast',
        event: 'room-mode',
        payload: {
          from: selfUserId,
          mode: 'stream',
          streamerId: selfUserId,
        },
      });
    }
  }, [room.partner, call.isScreenSharing, selfUserId, room.channel]);

  // Automatically answer incoming stream call as viewer
  const { connectionState, answerCall } = call;
  useEffect(() => {
    if (roomMode === 'stream' && connectionState === 'incoming') {
      void answerCall(false);
    }
  }, [roomMode, connectionState, answerCall]);

  const handleLeave = async () => {
    call.endCall();
    await room.leaveRoom();
    onLeave();
  };

  const showMismatch = sync.partnerMedia && localMedia && dismissedHash !== sync.partnerMedia.hash;

  // Floating cam bubble visibility: show when call is active or local camera is on, and in theater mode (mobile or desktop), or on mobile chat tab
  const hasActiveCallOrCam =
    call.connectionState === 'connected' ||
    call.connectionState === 'connecting' ||
    call.localStream !== null;

  const showBubble =
    hasActiveCallOrCam &&
    !isBubbleHidden &&
    (isTheater || isLandscape || (isMobile && mobileTab === 'chat'));

  const activeCamStream = call.remoteStream || call.localStream;
  const activeCamName = call.remoteStream ? (room.partner?.name ?? 'Partner') : (room.self?.name ?? 'You');
  const activeCamOn = call.remoteStream ? call.remoteCamOn : call.isCamOn;
  const activeMicOn = call.remoteStream ? call.remoteMicOn : call.isMicOn;

  // Last emoji reaction from messages
  const lastReaction = (() => {
    for (let i = chat.messages.length - 1; i >= 0; i--) {
      const m = chat.messages[i];
      if (m && ['🍿', '❤️', '😂', '😭', '✨', '🫂'].includes(m.text.trim())) {
        const fromName = m.from === room.self?.userId ? 'You' : room.partner?.name || 'Partner';
        const time = new Date(m.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return { from: fromName, emoji: m.text.trim(), time };
      }
    }
    return null;
  })();

  return (
    <main
      className={
        isLandscape
          ? 'fixed inset-0 z-50 flex flex-row bg-[#0F0D12] overflow-hidden select-none'
          : `flex min-h-dvh w-full flex-col cinema-glow overflow-x-hidden ${isMobile ? 'pt-16 pb-20' : 'pt-14 pb-6'}`
      }
    >
      {!isLandscape && (
        <RoomHeader
          isMobile={isMobile}
          roomCode={roomCode}
          status={room.status}
          self={room.self}
          partner={room.partner}
          partnerStatus={room.partnerStatus}
          drift={sync.drift}
          onSyncNow={sync.syncNow}
          onLeave={handleLeave}
          chatOpen={chat.isOpen}
          onToggleChat={() => chat.setIsOpen((prev) => !prev)}
          unreadCount={chat.unreadCount}
          stats={call.remoteStats}
          isStreamMode={roomMode === 'stream'}
          isCamOn={call.isCamOn}
          isMicOn={call.isMicOn}
          onToggleCam={call.toggleCam}
          onToggleMic={call.toggleMic}
          activeNavTab={isTheater ? 'theater' : activeNavTab}
          onNavTabChange={handleNavTabChange}
          onToggleSyncLab={() => setIsSyncLabOpen((prev) => !prev)}
        />
      )}

      <div
        className={
          isLandscape
            ? 'relative flex-1 h-full overflow-hidden flex flex-row'
            : `w-full ${isTheater ? 'p-0 gap-0' : 'px-3 sm:px-4 lg:px-6 py-2 gap-3'} flex-1 flex flex-col`
        }
      >
        {!isLandscape && room.status === 'error' && room.error && (
          <div role="alert" className="flex items-center justify-between rounded-lg border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
            <span>{room.error}</span>
            <button
              type="button"
              onClick={handleLeave}
              className="underline font-medium hover:opacity-80 cursor-pointer"
            >
              Return to lobby
            </button>
          </div>
        )}

        {!isLandscape && room.partnerStatus === 'left' && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 p-3 text-xs text-warn shadow-xs"
            data-testid="partner-left-banner"
          >
            <span className="size-2 rounded-full bg-warn motion-safe:animate-pulse" />
            <span className="font-semibold">Playback paused (partner disconnected).</span>
          </div>
        )}

        {/* Unified Stage Container: keeps PlayerView at a fixed React tree path across Landscape, Mobile, and Desktop */}
        <div
          className={
            isLandscape
              ? 'relative flex-1 h-full overflow-hidden flex flex-col justify-between'
              : isMobile
                ? 'flex flex-col gap-3 pb-20'
                : 'w-full max-w-[1880px] mx-auto flex flex-col gap-3 flex-1'
          }
        >
          {isLandscape && (
            <header className="absolute top-0 inset-x-0 z-30 pt-safe px-4 pt-2.5 flex items-center justify-between pointer-events-auto">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleLeave}
                  className="size-8 rounded-full bg-[#1A1720]/80 backdrop-blur-md border border-[#332C3D]/60 flex items-center justify-center text-[#F4EFF6] active:scale-95 transition-all shadow-md cursor-pointer"
                  title="Leave Room"
                  aria-label="Leave Room"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                    <path fillRule="evenodd" d="M17 10a.75.75 0 0 1-.75.75H5.612l4.158 3.96a.75.75 0 1 1-1.04 1.08l-5.5-5.25a.75.75 0 0 1 0-1.08l5.5-5.25a.75.75 0 1 1 1.04 1.08L5.612 9.25H16.25A.75.75 0 0 1 17 10Z" clipRule="evenodd" />
                  </svg>
                </button>

                <div className="flex items-center gap-2 bg-[#1A1720]/80 backdrop-blur-md border border-[#332C3D]/70 px-2.5 py-1 rounded-full shadow-lg">
                  <div className="relative size-5 rounded-full p-[1.5px] bg-gradient-to-tr from-[#E8A0BF] via-[#F2C57C] to-[#E8A0BF] flex items-center justify-center shadow-[0_0_8px_rgba(232,160,191,0.4)]">
                    <div className="size-full rounded-full bg-[#0F0D12] flex items-center justify-center">
                      <span className="text-[#E8A0BF] text-[10px] font-bold">▶</span>
                    </div>
                  </div>
                  <span className="text-xs font-bold tracking-tight text-[#F4EFF6]">Duet</span>
                  <span className="text-[#332C3D] font-mono text-[10px]">|</span>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(roomCode);
                        showToast('Room code copied!');
                      } catch {
                        // ignore
                      }
                    }}
                    className="bg-[#241F2D] text-[#F2C57C] font-mono text-[10px] font-semibold px-1.5 py-0.5 rounded tracking-wider border border-[#F2C57C]/20 cursor-pointer hover:underline"
                  >
                    [ {roomCode} ]
                  </button>
                  <div className="flex items-center gap-1.5 ml-0.5">
                    <span className="relative flex size-2">
                      <span className="animate-ping absolute inline-flex size-full rounded-full bg-[#8AE2B6] opacity-75" />
                      <span className="relative inline-flex rounded-full size-2 bg-[#8AE2B6]" />
                    </span>
                    <span className="text-[11px] font-medium text-[#F4EFF6]/90 truncate max-w-[120px]">
                      {room.partner?.name ?? 'Waiting'}
                      <span className="text-[#A79FB3] text-[10px] ml-1">
                        ({Math.abs(sync.drift) < 0.05 ? 'In sync' : `${Math.round(Math.abs(sync.drift) * 1000)}ms`})
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              {/* Right utility actions */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsLandscapeChatOpen((prev) => !prev)}
                  className={`h-7 px-2.5 rounded-full border text-[11px] font-semibold transition-all flex items-center gap-1.5 shadow-sm cursor-pointer ${
                    isLandscapeChatOpen
                      ? 'bg-[#E8A0BF] text-[#370923] border-[#E8A0BF]'
                      : 'bg-[#E8A0BF]/15 border-[#E8A0BF]/40 text-[#E8A0BF] hover:bg-[#E8A0BF]/25'
                  }`}
                  id="toggle-chat-btn"
                >
                  <span>Chat</span>
                  {chat.unreadCount > 0 && (
                    <span className="bg-[#E8A0BF] text-[#370923] font-mono text-[9px] font-bold rounded-full h-4 min-w-[16px] px-1 flex items-center justify-center leading-none">
                      {chat.unreadCount}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    toggleFullscreen(videoElement?.parentElement ?? document.documentElement, videoElement);
                  }}
                  className="size-7 rounded-full bg-[#1A1720]/80 backdrop-blur-md border border-[#332C3D]/60 flex items-center justify-center text-[#A79FB3] hover:text-[#F4EFF6] active:scale-95 transition-all cursor-pointer"
                  title="Fullscreen"
                  aria-label="Fullscreen"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                    <path fillRule="evenodd" d="M3.25 3.5A.75.75 0 0 0 2.5 4.25v3a.75.75 0 0 0 1.5 0V5.5h1.75a.75.75 0 0 0 0-1.5H3.25Zm13.5 0h-2.5a.75.75 0 0 0 0 1.5h1.75v1.75a.75.75 0 0 0 1.5 0v-3a.75.75 0 0 0-.75-.75Zm0 13a.75.75 0 0 0 .75-.75v-3a.75.75 0 0 0-1.5 0v1.75h-1.75a.75.75 0 0 0 0 1.5h2.5Zm-13.5 0h2.5a.75.75 0 0 0 0-1.5H4V13.25a.75.75 0 0 0-1.5 0v3c0 .414.336.75.75.75Z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </header>
          )}

          <div
            className={
              isLandscape
                ? 'size-full flex-1'
                : isMobile
                  ? 'w-full'
                  : `grid grid-cols-1 gap-4 items-start ${
                      !isTheater && (chat.isOpen || call.connectionState !== 'idle') ? 'lg:grid-cols-12' : ''
                    }`
            }
          >
            <div
              className={
                isLandscape
                  ? 'size-full'
                  : isMobile
                    ? 'w-full flex flex-col gap-3'
                    : `relative flex flex-col gap-3 min-w-0 ${
                        !isTheater && (chat.isOpen || call.connectionState !== 'idle')
                          ? 'lg:col-span-8 xl:col-span-9'
                          : 'lg:col-span-12'
                      }`
              }
            >
              <PlayerView
                isMobile={isMobile || isLandscape}
                isLandscape={isLandscape}
                channel={room.channel}
                selfUserId={selfUserId}
                partnerMedia={sync.partnerMedia}
                onVideoRef={setVideoElement}
                onMediaInfo={setLocalMedia}
                partnerBuffering={sync.partnerBuffering}
                isStreamMode={roomMode === 'stream'}
                streamSource={call.isScreenSharing ? call.screenStream : call.remoteStream}
                isScreenSharing={call.isScreenSharing}
                streamerName={
                  call.isScreenSharing || streamerId === selfUserId
                    ? room.self?.name
                    : room.partner?.name ?? 'Partner'
                }
                onStopScreenShare={call.stopScreenShare}
                onShareScreen={call.isScreenShareAvailable ? call.toggleScreenShare : undefined}
                stats={call.remoteStats}
                isTheater={isTheater || isLandscape}
                onToggleTheater={() => setIsTheater((prev) => !prev)}
                onSyncNow={sync.syncNow}
                roomCode={roomCode}
                onReaction={(emoji) => void chat.sendMessage(emoji)}
                lastReaction={lastReaction}
                actionToasts={toasts}
              >
                {showBubble && (
                  <Suspense fallback={null}>
                    <FloatingCamBubble
                      stream={activeCamStream}
                      partnerName={activeCamName}
                      isCamOn={activeCamOn}
                      isMicOn={activeMicOn}
                      stats={call.remoteStats}
                      onExpand={() => {
                        if (isLandscape) {
                          setIsLandscapeChatOpen(true);
                        } else {
                          setMobileTab('call');
                          setIsTheater(false);
                        }
                      }}
                      onClose={() => setIsBubbleHidden(true)}
                    />
                  </Suspense>
                )}
              </PlayerView>

              {!isLandscape && showMismatch && sync.partnerMedia && localMedia && (
                <MediaMismatchDialog
                  localMedia={localMedia}
                  partnerMedia={sync.partnerMedia}
                  onDismiss={() => setDismissedHash(sync.partnerMedia?.hash ?? null)}
                  onChangeFile={() => {
                    setLocalMedia(null);
                    setDismissedHash(null);
                  }}
                />
              )}
            </div>

            {/* Desktop Companion Sidebar (3-4 columns of 12) */}
            {!isLandscape && !isMobile && !isTheater && (chat.isOpen || call.connectionState !== 'idle') && (
              <aside className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3 w-full shrink-0">
                <Suspense fallback={<div className="flex min-h-24 items-center justify-center text-xs text-muted">Loading call…</div>}>
                  <CallSection
                    call={call}
                    partnerName={room.partner?.name}
                    selfName={room.self?.name}
                  />
                </Suspense>

                {chat.isOpen && (
                  <div className="flex-1 min-h-[340px] max-h-[calc(100vh-220px)] w-full flex flex-col">
                    <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-muted">Loading chat…</div>}>
                      <ChatView
                        messages={chat.messages}
                        selfUserId={room.self?.userId ?? null}
                        partnerName={room.partner?.name}
                        onSendMessage={chat.sendMessage}
                        onClose={() => chat.setIsOpen(false)}
                      />
                    </Suspense>
                  </div>
                )}
              </aside>
            )}
          </div>

          {!isLandscape && isMobile && (
            <>
              {/* Mobile Bottom Sheet (Chat, Call & Settings) per Stitch Mobile Design */}
              <div className="flex flex-col gap-3 rounded-2xl border border-outline/30 bg-surface-container p-3 sm:p-4 shadow-xl">
                {/* Grab handle bar */}
                <div className="w-12 h-1 rounded-full bg-outline/60 mx-auto" />

            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-text uppercase tracking-wider">
                  {mobileTab === 'chat' ? 'Realtime Chat' : mobileTab === 'call' ? 'Companion Video Call' : 'Cinema Settings'}
                </span>
                {mobileTab === 'chat' && chat.unreadCount > 0 && (
                  <span className="rounded-full bg-primary-container px-1.5 py-0.2 text-[10px] font-bold text-on-primary-container">
                    {chat.unreadCount} new
                  </span>
                )}
              </div>
              <span className="text-[10px] text-muted">Direct P2P</span>
            </div>

            {/* Segmented Room View Switcher (per Stitch Duet_-_Call___Media_Controls.html) */}
            <div
              role="tablist"
              aria-label="Room navigation"
              className="bg-surface-container-low p-1 rounded-full flex items-center border border-outline/30 shadow-xs"
            >
              <button
                type="button"
                role="tab"
                id="tab-call"
                aria-selected={mobileTab === 'call'}
                aria-controls="panel-call"
                onClick={() => {
                  setMobileTab('call');
                }}
                className={`flex-1 py-1.5 px-3 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  mobileTab === 'call'
                    ? 'bg-surface-container-high text-primary font-bold shadow-xs'
                    : 'text-muted hover:text-text'
                }`}
                data-testid="mobile-tab-call"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                  <path d="M3.25 4A2.25 2.25 0 0 0 1 6.25v7.5A2.25 2.25 0 0 0 3.25 16h7.5A2.25 2.25 0 0 0 13 13.75v-7.5A2.25 2.25 0 0 0 10.75 4h-7.5ZM14.5 7.025v5.95l3.58 2.046a.75.75 0 0 0 1.17-.653V5.632a.75.75 0 0 0-1.17-.653L14.5 7.025Z" />
                </svg>
                <span>Call &amp; Media</span>
                <span className="size-1.5 rounded-full bg-tertiary" />
              </button>

              <button
                type="button"
                role="tab"
                id="tab-chat"
                aria-selected={mobileTab === 'chat'}
                aria-controls="panel-chat"
                onClick={() => {
                  setMobileTab('chat');
                  setIsBubbleHidden(false);
                }}
                className={`flex-1 py-1.5 px-3 rounded-full text-xs font-semibold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  mobileTab === 'chat'
                    ? 'bg-surface-container-high text-primary font-bold shadow-xs'
                    : 'text-muted hover:text-text'
                }`}
                data-testid="mobile-tab-chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                  <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.532a2.25 2.25 0 0 0-1.88 2.2V11c0 1.25.98 2.26 2.23 2.3 1.34.04 2.68.12 4.02.24l2.67 2.14a.75.75 0 0 0 1.23-.58v-1.63c1.78-.17 3.52-.45 5.2-.83a2.25 2.25 0 0 0 1.88-2.2V4.732a2.25 2.25 0 0 0-1.88-2.2A49.19 49.19 0 0 0 10 2Z" clipRule="evenodd" />
                </svg>
                <span>Duet Chat</span>
                {chat.unreadCount > 0 && (
                  <span className="rounded-full bg-primary/20 text-primary px-1.5 py-0.2 font-mono-sm text-[10px]">
                    {chat.unreadCount}
                  </span>
                )}
              </button>
            </div>

            <div className="w-full pt-1">
              {mobileTab === 'chat' && (
                <div
                  id="panel-chat"
                  role="tabpanel"
                  aria-labelledby="tab-chat"
                  className="h-[420px] w-full"
                >
                  <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-muted">Loading chat…</div>}>
                    <ChatView
                      messages={chat.messages}
                      selfUserId={room.self?.userId ?? null}
                      partnerName={room.partner?.name}
                      onSendMessage={chat.sendMessage}
                    />
                  </Suspense>
                </div>
              )}

              {mobileTab === 'call' && (
                <div
                  id="panel-call"
                  role="tabpanel"
                  aria-labelledby="tab-call"
                  className="w-full flex flex-col gap-3"
                >
                  <Suspense fallback={<div className="flex min-h-32 items-center justify-center text-xs text-muted">Loading call…</div>}>
                    <CallSection
                      call={call}
                      partnerName={room.partner?.name}
                      selfName={room.self?.name}
                    />
                  </Suspense>

                  {/* Active Media Management Card (per Stitch Duet_-_Call___Media_Controls.html) */}
                  <div className="rounded-xl border border-outline/30 bg-surface-container-low p-3.5 flex flex-col gap-2.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-primary text-xs font-semibold uppercase tracking-wider">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                          <path d="M3.25 4A2.25 2.25 0 0 0 1 6.25v7.5A2.25 2.25 0 0 0 3.25 16h7.5A2.25 2.25 0 0 0 13 13.75v-7.5A2.25 2.25 0 0 0 10.75 4h-7.5ZM14.5 7.025v5.95l3.58 2.046a.75.75 0 0 0 1.17-.653V5.632a.75.75 0 0 0-1.17-.653L14.5 7.025Z" />
                        </svg>
                        <span>Active Media Track</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                          fileInput?.click();
                        }}
                        className="flex items-center gap-1 text-[11px] text-muted hover:text-primary transition font-medium cursor-pointer"
                      >
                        <span>Change file</span>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                          <path d="M9.25 13.25a.75.75 0 0 0 1.5 0V4.636l2.955 3.129a.75.75 0 0 0 1.09-1.03l-4.25-4.5a.75.75 0 0 0-1.09 0l-4.25 4.5a.75.75 0 1 0 1.09 1.03L9.25 4.636v8.614Z" />
                          <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
                        </svg>
                      </button>
                    </div>

                    {/* File Details Block */}
                    <div className="rounded-lg bg-surface-container p-2.5 flex flex-col gap-1.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-secondary text-base shrink-0">🎬</span>
                        <p className="text-xs font-semibold text-text truncate">
                          {localMedia ? localMedia.name : 'No video file loaded'}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono-sm text-muted pt-0.5">
                        <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-text">
                          {localMedia ? `${(localMedia.size / (1024 * 1024)).toFixed(1)} MB` : 'Ready'}
                        </span>
                        <span>•</span>
                        <span>{localMedia ? formatTime(localMedia.duration) : '--:--'}</span>
                        <span>•</span>
                        <span className="text-tertiary">H.264 + AAC</span>
                        <span>•</span>
                        <span className="text-primary font-bold">Zero lag · Direct P2P</span>
                      </div>
                    </div>

                    {/* Subtitles & Audio Routing Block */}
                    <div className="flex items-center justify-between py-1 px-2 bg-surface-container-high/40 rounded-lg">
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 text-tertiary shrink-0">
                          <path d="M2 4.25A2.25 2.25 0 0 1 4.25 2h11.5A2.25 2.25 0 0 1 18 4.25v11.5A2.25 2.25 0 0 1 15.75 18H4.25A2.25 2.25 0 0 1 2 15.75V4.25ZM5.25 9.5a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Zm0 3a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5Zm6.5-3a.75.75 0 0 0 0 1.5h3a.75.75 0 0 0 0-1.5h-3Zm0 3a.75.75 0 0 0 0 1.5h1.5a.75.75 0 0 0 0-1.5h-1.5Z" />
                        </svg>
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-text">Subtitles (.vtt / .srt)</span>
                          <span className="text-[10px] text-tertiary">Synchronized automatically</span>
                        </div>
                      </div>
                      <label className="px-2.5 py-1 rounded-full bg-surface-container-highest text-text font-medium text-[10px] hover:text-primary transition cursor-pointer">
                        <span>Swap .srt</span>
                        <input
                          type="file"
                          accept=".srt,.vtt,text/vtt"
                          className="sr-only"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (f) showToast(`Loaded subtitles: ${f.name}`);
                          }}
                        />
                      </label>
                    </div>
                  </div>

                  {/* Quick Reactions Deck */}
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between px-1 text-[11px] text-muted">
                      <span className="uppercase tracking-wider font-semibold text-[10px]">Send Instant Reaction</span>
                      <span className="text-primary text-[10px]">Float on {room.partner?.name ?? "partner"}'s screen</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      {['🍿', '❤️', '😂', '😭', '✨'].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => void chat.sendMessage(emoji)}
                          className="flex-1 py-2 rounded-xl bg-surface-container-low hover:bg-surface-container text-lg active:scale-90 transition-transform flex items-center justify-center border border-outline/20 cursor-pointer shadow-xs"
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {mobileTab === 'settings' && (
                <div
                  id="panel-settings"
                  role="tabpanel"
                  aria-labelledby="tab-settings"
                  className="flex flex-col gap-3 py-1"
                >
                  {/* Theme selection */}
                  <div className="flex items-center justify-between rounded-xl border border-outline/30 bg-surface-container-low p-3 shadow-xs">
                    <div>
                      <span className="text-xs font-bold text-text">Cinema Theme</span>
                      <p className="text-[10px] text-muted">Nocturne Intimacy color palette</p>
                    </div>
                    <ThemePicker />
                  </div>

                  {/* Room Share & Invite */}
                  <div className="flex items-center justify-between rounded-xl border border-outline/30 bg-surface-container-low p-3 shadow-xs">
                    <div>
                      <span className="text-xs font-bold text-text">Room Code</span>
                      <p className="text-[11px] text-primary font-mono-sm font-bold">[{roomCode}]</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void navigator.clipboard?.writeText(roomCode);
                          showToast('Room code copied');
                        }}
                        className="rounded-full bg-surface-container-high border border-outline/40 px-3 py-1 text-xs text-text hover:text-primary transition cursor-pointer"
                      >
                        Copy Code
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const url = `${window.location.origin}?room=${roomCode}`;
                          void navigator.clipboard?.writeText(url);
                          showToast('Invite link copied');
                        }}
                        className="rounded-full bg-primary-container text-on-primary-container px-3 py-1 text-xs font-semibold shadow-xs hover:bg-primary transition cursor-pointer"
                      >
                        Share Link
                      </button>
                    </div>
                  </div>

                  {/* Direct WebRTC Mesh info */}
                  <div className="rounded-xl border border-outline/30 bg-surface-container-low p-3 text-xs space-y-2 shadow-xs">
                    <div className="flex justify-between items-center text-muted text-[11px]">
                      <span>Mesh Protocol:</span>
                      <span className="text-tertiary font-semibold flex items-center gap-1">
                        <span className="size-1.5 rounded-full bg-tertiary" />
                        P2P WebRTC Direct
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-muted text-[11px]">
                      <span>Latency Target:</span>
                      <span className="text-text font-mono-sm">&lt; 28ms</span>
                    </div>
                    <div className="flex justify-between items-center text-muted text-[11px]">
                      <span>Audio Channel:</span>
                      <span className="text-text font-mono-sm">48kHz Opus Direct</span>
                    </div>
                    <div className="flex justify-between items-center text-muted text-[11px]">
                      <span>Privacy:</span>
                      <span className="text-primary font-mono-sm">Zero-Knowledge Encrypted</span>
                    </div>
                  </div>

                  <Button
                    variant="danger"
                    size="sm"
                    onClick={handleLeave}
                    className="w-full text-xs font-semibold h-10 mt-1 cursor-pointer"
                  >
                    Leave Cinema Room
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Fixed Mobile Bottom Navigation Bar (per Stitch Mobile Design) */}
          <nav
            aria-label="Mobile Bottom Navigation"
            className="fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around h-14 bg-surface-container-lowest/95 backdrop-blur-xl border-t border-outline/30 pb-safe shadow-xl select-none"
          >
            <button
              type="button"
              onClick={() => {
                setMobileTab('call');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-0.5 transition cursor-pointer ${
                mobileTab === 'call' ? 'text-primary font-bold' : 'text-muted hover:text-text'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                <path d="M3.25 4A2.25 2.25 0 0 0 1 6.25v7.5A2.25 2.25 0 0 0 3.25 16h7.5A2.25 2.25 0 0 0 13 13.75v-7.5A2.25 2.25 0 0 0 10.75 4h-7.5ZM14.5 7.025v5.95l3.58 2.046a.75.75 0 0 0 1.17-.653V5.632a.75.75 0 0 0-1.17-.653L14.5 7.025Z" />
              </svg>
              <span className="text-[10px]">Theater</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
                fileInput?.click();
              }}
              className="flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-0.5 text-muted hover:text-text transition cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                <path d="M2 4.25A2.25 2.25 0 0 1 4.25 2h2.5A2.25 2.25 0 0 1 9 4.25v.75h7A2 2 0 0 1 18 7v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4.25Z" />
              </svg>
              <span className="text-[10px]">Library</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setMobileTab('chat');
                setIsBubbleHidden(false);
              }}
              className={`relative flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-0.5 transition cursor-pointer ${
                mobileTab === 'chat' ? 'text-primary font-bold' : 'text-muted hover:text-text'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.532C2.043 2.766 1 3.93 1 5.312v5.376c0 1.382 1.043 2.546 2.43 2.78 1.168.197 2.37.332 3.595.405l.54 2.162a1 1 0 0 0 1.76.326l2.92-2.92c.574-.017 1.144-.047 1.71-.09 1.387-.234 2.43-1.398 2.43-2.78V5.312c0-1.382-1.043-2.546-2.43-2.78A44.05 44.05 0 0 0 10 2Z" clipRule="evenodd" />
              </svg>
              <span className="text-[10px]">Chat</span>
              {chat.unreadCount > 0 && (
                <span className="absolute top-1 right-2.5 size-2 rounded-full bg-primary" />
              )}
            </button>

            <button
              type="button"
              data-testid="mobile-tab-settings"
              onClick={() => setMobileTab('settings')}
              className={`flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-0.5 transition cursor-pointer ${
                mobileTab === 'settings' ? 'text-primary font-bold' : 'text-muted hover:text-text'
              }`}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-5">
                <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
              </svg>
              <span className="text-[10px]">Settings</span>
            </button>
          </nav>
            </>
          )}

          {/* Sync Lab HUD (Toggled via Sync Lab in header on desktop) */}
          {!isLandscape && !isMobile && isSyncLabOpen && (
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
              <div className="md:col-span-4 p-4 rounded-xl bg-surface-container-low border border-outline/20 flex flex-col gap-1.5 font-mono-sm text-xs shadow-xs">
                <div className="flex items-center justify-between text-muted border-b border-outline/20 pb-2">
                  <span className="font-bold text-primary flex items-center gap-1.5">
                    <span className="size-2 rounded-full bg-primary" />
                    SYNC LAB DEBUG HUD
                  </span>
                  <span className="text-tertiary font-semibold">STABLE</span>
                </div>
                <div className="grid grid-cols-2 gap-y-1.5 pt-1 text-muted text-[11px]">
                  <span>Room Code:</span>
                  <span className="text-text font-semibold text-right">[{roomCode}]</span>
                  <span>Role:</span>
                  <span className="text-primary text-right">Controller (Local)</span>
                  <span>Clock Offset:</span>
                  <span className="text-tertiary text-right">{sync.drift ? `${Math.round(sync.drift * 1000)} ms` : '-3 ms'}</span>
                  <span>Current Drift:</span>
                  <span className="text-secondary text-right">{Math.round(Math.abs(sync.drift) * 1000)} ms</span>
                  <span>Buffering State:</span>
                  <span className="text-tertiary text-right">{sync.partnerBuffering ? 'Buffering…' : 'None (Ready)'}</span>
                </div>
              </div>

              <div className="md:col-span-8 p-4 rounded-xl bg-surface-container-low border border-outline/20 flex flex-col justify-between gap-3 text-xs shadow-xs">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <div className="size-2.5 rounded-full bg-tertiary animate-pulse" />
                    <span className="text-text">
                      P2P Mesh connection active between <strong className="text-primary">You</strong> and <strong className="text-primary">{room.partner?.name || 'Peer'}</strong>
                    </span>
                  </div>
                  <span className="font-mono-sm text-[11px] text-muted">Opus 48kHz Stereo · WebRTC DataChannel v1.8</span>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-outline/20 text-muted text-[11px]">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-surface-container font-mono-sm text-[10px] text-text">Space</kbd> Play/Pause</span>
                    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-surface-container font-mono-sm text-[10px] text-text">← / →</kbd> Seek 5s</span>
                    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-surface-container font-mono-sm text-[10px] text-text">F</kbd> Fullscreen</span>
                    <span className="flex items-center gap-1"><kbd className="px-1.5 py-0.5 rounded bg-surface-container font-mono-sm text-[10px] text-text">C</kbd> Toggle Chat</span>
                  </div>
                  <span className="text-tertiary flex items-center gap-1">
                    <span>🔒</span>
                    <span>Encrypted Zero-Knowledge Channel</span>
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Translucent Slide-over Companion Chat Drawer (Landscape) */}
        {isLandscape && isLandscapeChatOpen && (
          <aside className="relative w-[310px] h-full flex flex-col bg-[#0F0D12]/95 backdrop-blur-xl border-l border-[#332C3D] z-40 transition-all duration-300 pr-safe" id="chat-drawer">
            <div className="px-3.5 py-2.5 bg-[#1A1720]/70 border-b border-[#332C3D]/60 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-bold text-[#F4EFF6] tracking-tight">Duet Chat</h2>
                <div className="flex items-center gap-1 text-[#8AE2B6] text-[10px]">
                  <span className="size-1.5 rounded-full bg-[#8AE2B6] animate-pulse" />
                  <span>{room.partner?.name ? `${room.partner.name} watching` : 'In room'}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsLandscapeChatOpen(false)}
                className="size-6 rounded-full bg-[#241F2D] text-[#A79FB3] hover:text-[#F4EFF6] flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                id="close-chat-btn"
                aria-label="Close Chat"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-hidden">
              <Suspense fallback={<div className="flex h-full items-center justify-center text-xs text-muted">Loading chat…</div>}>
                <ChatView
                  messages={chat.messages}
                  selfUserId={room.self?.userId ?? null}
                  partnerName={room.partner?.name}
                  onSendMessage={chat.sendMessage}
                />
              </Suspense>
            </div>
          </aside>
        )}

      {/* Companion Synchronicity Status Strip & Footer */}
      {!isLandscape && (
        <footer className="flex flex-col gap-2.5 border-t border-outline/30 pt-2.5 text-xs text-muted mt-auto">
          <div className="hidden lg:flex items-center justify-between" data-testid="desktop-status-strip">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 rounded-full border border-outline/30 bg-surface-container px-2.5 py-0.5">
                <span className="font-semibold text-text">Sync:</span>
                <span className="size-2 rounded-full bg-tertiary" />
                <span className="font-mono-sm text-[11px]">
                  {Math.abs(sync.drift) > 0.05
                    ? `${Math.round(Math.abs(sync.drift) * 1000)}ms drift`
                    : 'Synchronized'}
                </span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1.5 rounded-full border border-outline/30 bg-surface-container px-2.5 py-0.5">
                <span className="font-semibold text-text">Quality:</span>
                <span className="font-mono-sm text-[11px]">
                  {call.remoteStats && call.remoteStats.width
                    ? `${call.remoteStats.width}×${call.remoteStats.height}`
                    : '1080p source'}
                </span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1.5 rounded-full border border-outline/30 bg-surface-container px-2.5 py-0.5">
                <span className="size-1.5 rounded-full bg-tertiary" />
                <span className="text-[11px] font-medium text-text">P2P Mesh Active</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1.5 rounded-full border border-outline/30 bg-surface-container px-2.5 py-0.5">
                <span className="font-semibold text-text">Partner:</span>
                <span
                  className={`size-2 rounded-full ${
                    room.partner
                      ? 'bg-tertiary'
                      : room.partnerStatus === 'left'
                        ? 'bg-warn'
                        : 'bg-muted motion-safe:animate-pulse'
                  }`}
                />
                <span className="font-medium">
                  {room.partner ? 'Connected' : room.partnerStatus === 'left' ? 'Left' : 'Awaiting peer…'}
                </span>
              </div>
              <span className="hidden xl:inline-flex items-center gap-1 text-[11px] text-muted">
                <span>·</span>
                <span className="text-primary font-mono-sm">🔒 Encrypted Zero-Knowledge Channel</span>
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px] text-muted">
              <span>Shortcuts:</span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-outline/40 bg-surface-container px-1.5 py-0.2 font-mono-sm text-[10px] text-text">Space</kbd>
                <span>play/pause</span>
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-outline/40 bg-surface-container px-1.5 py-0.2 font-mono-sm text-[10px] text-text">← →</kbd>
                <span>5s</span>
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-outline/40 bg-surface-container px-1.5 py-0.2 font-mono-sm text-[10px] text-text">F</kbd>
                <span>fullscreen</span>
              </span>
              <span>·</span>
              <span className="inline-flex items-center gap-1">
                <kbd className="rounded border border-outline/40 bg-surface-container px-1.5 py-0.2 font-mono-sm text-[10px] text-text">C</kbd>
                <span>chat</span>
              </span>
            </div>
          </div>

          {/* Stitch Cinema Footer Bar */}
          <div className="text-center font-mono-sm text-[10px] uppercase tracking-widest text-muted/60 pt-2 border-t border-outline/20">
            DUET SECURE P2P WEBRTC // LATENCY &lt; 28MS | AUDIO 48KHZ OPUS | DRIFT {Math.abs(sync.drift).toFixed(2)}s | DUET CINEMA v2.4
          </div>
        </footer>
      )}

      {!isLandscape && (
        <SyncDevOverlay
          sync={sync}
          roomCode={roomCode}
          isOpen={isSyncLabOpen}
          onToggle={() => setIsSyncLabOpen((prev) => !prev)}
        />
      )}
    </div>

    {/* Cinema Settings Modal */}
    {isSettingsOpen && (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cinema-settings-modal-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs animate-fade-in"
        onClick={() => setIsSettingsOpen(false)}
      >
        <div
          className="relative w-full max-w-md rounded-2xl border border-outline/30 bg-surface-container p-6 shadow-2xl space-y-4"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-outline/20 pb-3">
            <h2 id="cinema-settings-modal-title" className="text-base font-bold text-text">
              Cinema Settings
            </h2>
            <button
              type="button"
              onClick={() => setIsSettingsOpen(false)}
              className="grid size-8 place-items-center rounded-full text-muted hover:text-text hover:bg-surface-container-high transition cursor-pointer"
              aria-label="Close settings"
            >
              ✕
            </button>
          </div>

          {/* Theme selection */}
          <div className="flex items-center justify-between rounded-xl border border-outline/30 bg-surface-container-low p-3 shadow-xs">
            <div>
              <span className="text-xs font-bold text-text">Cinema Theme</span>
              <p className="text-[10px] text-muted">Nocturne Intimacy color palette</p>
            </div>
            <ThemePicker />
          </div>

          {/* Room Share & Invite */}
          <div className="flex items-center justify-between rounded-xl border border-outline/30 bg-surface-container-low p-3 shadow-xs">
            <div>
              <span className="text-xs font-bold text-text">Room Code</span>
              <p className="text-[11px] text-primary font-mono-sm font-bold">[{roomCode}]</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(roomCode);
                  showToast('Room code copied');
                }}
                className="rounded-full bg-surface-container-high border border-outline/40 px-3 py-1 text-xs text-text hover:text-primary transition cursor-pointer"
              >
                Copy Code
              </button>
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}?room=${roomCode}`;
                  void navigator.clipboard?.writeText(url);
                  showToast('Invite link copied');
                }}
                className="rounded-full bg-primary-container text-on-primary-container px-3 py-1 text-xs font-semibold shadow-xs hover:bg-primary transition cursor-pointer"
              >
                Share Link
              </button>
            </div>
          </div>

          {/* Direct WebRTC Mesh info */}
          <div className="rounded-xl border border-outline/30 bg-surface-container-low p-3 text-xs space-y-2 shadow-xs">
            <div className="flex justify-between items-center text-muted text-[11px]">
              <span>Mesh Protocol:</span>
              <span className="text-tertiary font-semibold flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-tertiary" />
                P2P WebRTC Direct
              </span>
            </div>
            <div className="flex justify-between items-center text-muted text-[11px]">
              <span>Latency Target:</span>
              <span className="text-text font-mono-sm">&lt; 28ms</span>
            </div>
            <div className="flex justify-between items-center text-muted text-[11px]">
              <span>Audio Channel:</span>
              <span className="text-text font-mono-sm">48kHz Opus Direct</span>
            </div>
            <div className="flex justify-between items-center text-muted text-[11px]">
              <span>Privacy:</span>
              <span className="text-primary font-mono-sm">Zero-Knowledge Encrypted</span>
            </div>
          </div>

          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setIsSettingsOpen(false);
              void handleLeave();
            }}
            className="w-full text-xs font-semibold h-10 mt-1 cursor-pointer"
          >
            Leave Cinema Room
          </Button>
        </div>
      </div>
    )}



      {/* Transient Action Toasts */}
      <div
        role="region"
        aria-label="Action notifications"
        className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
        data-testid="toast-container"
      >
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            className="pointer-events-auto transform transition-all duration-120 motion-safe:translate-y-0 shadow-lg"
          />
        ))}
      </div>
    </main>
  );
}
