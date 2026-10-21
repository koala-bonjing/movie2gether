import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { PlayerView, type MediaInfo } from '../features/player';
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
        <main className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center p-4 sm:p-8 cinema-glow">
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
  const [mobileNav, setMobileNav] = useState<'theater' | 'library' | 'chat' | 'settings'>('theater');
  const [isBubbleHidden, setIsBubbleHidden] = useState(false);
  const [activeNavTab, setActiveNavTab] = useState<'theater' | 'library' | 'synclab' | 'settings'>('theater');
  const [isSyncLabOpen, setIsSyncLabOpen] = useState(() => import.meta.env.DEV || import.meta.env.MODE === 'test');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024;
  });

  const handleNavTabChange = useCallback((tab: 'theater' | 'library' | 'synclab' | 'settings') => {
    setActiveNavTab(tab);
    if (tab === 'settings') {
      setIsSettingsOpen(true);
    } else if (tab === 'synclab') {
      setIsSyncLabOpen((prev) => !prev);
    } else if (tab === 'library') {
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      fileInput?.click();
    } else {
      setIsSettingsOpen(false);
    }
  }, []);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
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
      showToast('Partner left. Playback paused.');
    }
    prevPartnerStatusRef.current = room.partnerStatus;
  }, [room.partnerStatus, videoElement, showToast]);

  // Broadcast media fingerprint when local file is loaded
  useEffect(() => {
    if (localMedia && selfUserId) {
      broadcastMedia({
        from: selfUserId,
        name: localMedia.name,
        size: localMedia.size,
        duration: localMedia.duration,
        hash: localMedia.hash,
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

  // Partner cam bubble visibility: show when call is connected and user is in chat view on mobile, or in theater mode
  const showBubble =
    call.connectionState === 'connected' &&
    !isBubbleHidden &&
    ((isMobile && mobileTab === 'chat') || (isTheater && !isMobile));

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
    <main className="mx-auto flex min-h-dvh w-full flex-col cinema-glow overflow-x-hidden">
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
        activeNavTab={activeNavTab}
        onNavTabChange={handleNavTabChange}
        onToggleSyncLab={() => setIsSyncLabOpen((prev) => !prev)}
      />

      <div className="w-full max-w-[1920px] mx-auto px-4 py-3 flex-1 flex flex-col gap-4">
        {room.error && (
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

        {room.partnerStatus === 'left' && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-lg border border-warn/40 bg-warn/10 p-3 text-xs text-warn shadow-xs"
            data-testid="partner-left-banner"
          >
            <span className="size-2 rounded-full bg-warn motion-safe:animate-pulse" />
            <span className="font-semibold">Playback paused (partner disconnected).</span>
          </div>
        )}

      {/* MOBILE THEATER LAYOUT (< 1024px) */}
      {isMobile ? (
        <div className="flex flex-col gap-4 pb-24">
          {/* Partner Sync Status Strip */}
          <div className="flex items-center justify-between rounded-xl border border-outline/30 bg-surface-container px-3.5 py-2 shadow-xs text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex size-2.5 shrink-0">
                <span className={`absolute inline-flex size-full animate-ping rounded-full opacity-75 ${room.partner ? 'bg-tertiary' : 'bg-warn'}`} />
                <span className={`relative inline-flex size-2.5 rounded-full ${room.partner ? 'bg-tertiary' : 'bg-warn'}`} />
              </span>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold text-text truncate text-xs">{room.partner?.name || 'Awaiting Partner'}</span>
                  <span className="rounded-full bg-primary-container/20 px-1.5 py-0.2 text-[9px] font-bold text-primary">
                    Host
                  </span>
                </div>
                <span className="text-[10px] text-muted truncate">
                  {room.partner ? (Math.abs(sync.drift) < 0.05 ? 'In sync' : `${Math.round(Math.abs(sync.drift) * 1000)}ms drift`) : 'Waiting for partner…'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <span className="flex items-center gap-1 rounded-full bg-surface-container-low border border-outline/30 px-2 py-0.5 text-[10px] font-medium text-tertiary">
                <span className="size-1.5 rounded-full bg-tertiary" />
                P2P Direct
              </span>
            </div>
          </div>

          {/* Mobile Video Deck (rounded-xl) */}
          <div className="w-full">
            <PlayerView
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
              isTheater={isTheater}
              onToggleTheater={() => setIsTheater((prev) => !prev)}
              onSyncNow={sync.syncNow}
              roomCode={roomCode}
              onReaction={(emoji) => void chat.sendMessage(emoji)}
              lastReaction={lastReaction}
              actionToasts={toasts}
            />
          </div>

          {showBubble && (
            <Suspense fallback={null}>
              <FloatingCamBubble
                stream={call.remoteStream}
                partnerName={room.partner?.name ?? 'Partner'}
                isCamOn={call.remoteCamOn}
                isMicOn={call.remoteMicOn}
                stats={call.remoteStats}
                onExpand={() => {
                  setMobileTab('call');
                  setIsTheater(false);
                }}
                onClose={() => setIsBubbleHidden(true)}
              />
            </Suspense>
          )}

          {showMismatch && sync.partnerMedia && localMedia && (
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

          {/* Partner Presence Tray with Host Tag */}
          <div className="flex items-center justify-between rounded-xl border border-outline/30 bg-surface-container p-3 shadow-xs">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="relative shrink-0">
                <div className="grid size-9 place-items-center rounded-full bg-surface-container-high text-xs font-bold text-text">
                  {(room.partner?.name || 'Partner').slice(0, 2).toUpperCase()}
                </div>
                {room.partner && (
                  <span className="absolute -bottom-1 -right-1 rounded-full bg-primary-container px-1 py-0.2 text-[8px] font-bold text-on-primary-container">
                    Host
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-text truncate">{room.partner?.name || 'Partner'}</span>
                  <span className={`size-1.5 rounded-full ${room.partner ? 'bg-tertiary' : 'bg-warn'}`} />
                </div>
                <p className="text-[10px] text-muted truncate">
                  {call.connectionState === 'connected' ? 'Video call active' : room.partner ? 'Ready to watch' : 'Waiting in cinema'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {call.connectionState === 'connected' ? (
                <button
                  type="button"
                  onClick={() => setMobileTab('call')}
                  className="rounded-full bg-tertiary/20 text-tertiary border border-tertiary/40 px-3 py-1 text-xs font-semibold cursor-pointer"
                >
                  In Call
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileTab('call');
                    void call.startCall();
                  }}
                  disabled={!room.partner}
                  className="rounded-full bg-primary-container text-on-primary-container px-3.5 py-1 text-xs font-semibold shadow-xs hover:bg-primary transition active:scale-95 disabled:opacity-40 cursor-pointer"
                >
                  Start Call
                </button>
              )}
            </div>
          </div>

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

            {/* Segmented Control / Tab List */}
            <div
              role="tablist"
              aria-label="Room navigation"
              className="grid grid-cols-3 rounded-xl border border-outline/30 bg-surface-container-low p-1 shadow-xs"
            >
              <button
                type="button"
                role="tab"
                id="tab-chat"
                aria-selected={mobileTab === 'chat'}
                aria-controls="panel-chat"
                onClick={() => {
                  setMobileTab('chat');
                  setMobileNav('chat');
                  setIsBubbleHidden(false);
                }}
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  mobileTab === 'chat'
                    ? 'bg-primary-container text-on-primary-container shadow-xs font-bold'
                    : 'text-muted hover:text-text'
                }`}
                data-testid="mobile-tab-chat"
              >
                <span>Chat</span>
                {chat.unreadCount > 0 && (
                  <span
                    className={`rounded-full px-1.5 py-0.2 text-[9px] font-bold leading-tight ${
                      mobileTab === 'chat' ? 'bg-surface-container-lowest text-primary' : 'bg-primary text-surface-container-lowest'
                    }`}
                  >
                    {chat.unreadCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                role="tab"
                id="tab-call"
                aria-selected={mobileTab === 'call'}
                aria-controls="panel-call"
                onClick={() => {
                  setMobileTab('call');
                  setMobileNav('theater');
                }}
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  mobileTab === 'call'
                    ? 'bg-primary-container text-on-primary-container shadow-xs font-bold'
                    : 'text-muted hover:text-text'
                }`}
                data-testid="mobile-tab-call"
              >
                <span>Call</span>
                {call.connectionState !== 'idle' && (
                  <span
                    className={`size-2 rounded-full ${
                      call.connectionState === 'connected' ? 'bg-tertiary' : 'bg-warn animate-pulse'
                    }`}
                  />
                )}
              </button>

              <button
                type="button"
                role="tab"
                id="tab-settings"
                aria-selected={mobileTab === 'settings'}
                aria-controls="panel-settings"
                onClick={() => {
                  setMobileTab('settings');
                  setMobileNav('settings');
                }}
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  mobileTab === 'settings'
                    ? 'bg-primary-container text-on-primary-container shadow-xs font-bold'
                    : 'text-muted hover:text-text'
                }`}
                data-testid="mobile-tab-settings"
              >
                <span>Settings</span>
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
                  className="w-full"
                >
                  <Suspense fallback={<div className="flex min-h-32 items-center justify-center text-xs text-muted">Loading call…</div>}>
                    <CallSection
                      call={call}
                      partnerName={room.partner?.name}
                      selfName={room.self?.name}
                    />
                  </Suspense>
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
        </div>
      ) : (
        /* DESKTOP 12-COLUMN ASYMMETRIC GRID (>= 1024px) */
        <div
          className={`grid grid-cols-1 gap-4 items-start ${
            !isTheater && (chat.isOpen || call.connectionState !== 'idle') ? 'lg:grid-cols-12' : ''
          }`}
        >
          {/* Left Stage (9 columns in 12-column layout) */}
          <div
            className={`relative flex flex-col gap-4 min-w-0 ${
              !isTheater && (chat.isOpen || call.connectionState !== 'idle') ? 'lg:col-span-9' : 'lg:col-span-12'
            }`}
          >
            <PlayerView
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
              isTheater={isTheater}
              onToggleTheater={() => setIsTheater((prev) => !prev)}
              onSyncNow={sync.syncNow}
              roomCode={roomCode}
              onReaction={(emoji) => void chat.sendMessage(emoji)}
              lastReaction={lastReaction}
              actionToasts={toasts}
            />

            {showBubble && (
              <Suspense fallback={null}>
                <FloatingCamBubble
                  stream={call.remoteStream}
                  partnerName={room.partner?.name ?? 'Partner'}
                  isCamOn={call.remoteCamOn}
                  isMicOn={call.remoteMicOn}
                  stats={call.remoteStats}
                  onExpand={() => {
                    setMobileTab('call');
                    setIsTheater(false);
                  }}
                  onClose={() => setIsBubbleHidden(true)}
                />
              </Suspense>
            )}

            {showMismatch && sync.partnerMedia && localMedia && (
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

          {/* Desktop Companion Sidebar (3 columns of 12) */}
          {!isTheater && (chat.isOpen || call.connectionState !== 'idle') && (
            <aside className="lg:col-span-3 flex flex-col gap-3 w-full shrink-0">
              <Suspense fallback={<div className="flex min-h-24 items-center justify-center text-xs text-muted">Loading call…</div>}>
                <CallSection
                  call={call}
                  partnerName={room.partner?.name}
                  selfName={room.self?.name}
                />
              </Suspense>

              {chat.isOpen && (
                <div className="h-[480px] lg:h-[500px] xl:h-[520px] w-full flex flex-col">
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
      )}

      {/* Companion Synchronicity Status Strip & Footer */}
      <footer className="flex flex-col gap-3 border-t border-outline/30 pt-3.5 text-xs text-muted mt-auto">
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

      <SyncDevOverlay
        sync={sync}
        roomCode={roomCode}
        isOpen={isSyncLabOpen}
        onToggle={() => setIsSyncLabOpen((prev) => !prev)}
      />
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

      {/* Fixed Mobile Bottom Navigation Bar (< 1024px) per Stitch Mobile Design */}
      {isMobile && (
        <nav
          aria-label="Mobile Navigation"
          className="fixed bottom-0 inset-x-0 z-40 flex items-center justify-around border-t border-outline/30 bg-surface-container-low/95 px-3 py-1.5 pb-safe backdrop-blur-md shadow-2xl"
        >
          <button
            type="button"
            onClick={() => {
              setMobileNav('theater');
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }
            }}
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] rounded-xl px-2.5 py-1 text-xs transition cursor-pointer ${
              mobileNav === 'theater'
                ? 'bg-primary-container text-on-primary-container font-bold shadow-xs'
                : 'text-muted hover:text-text'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
              <path d="M3.25 4A2.25 2.25 0 0 0 1 6.25v7.5A2.25 2.25 0 0 0 3.25 16h7.5A2.25 2.25 0 0 0 13 13.75v-7.5A2.25 2.25 0 0 0 10.75 4h-7.5ZM14.5 7.025v5.95l3.58 2.046a.75.75 0 0 0 1.17-.653V5.632a.75.75 0 0 0-1.17-.653L14.5 7.025Z" />
            </svg>
            <span className="text-[10px] mt-0.5 font-medium">Theater</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileNav('library');
              if (typeof document !== 'undefined') {
                const picker = document.querySelector('input[type="file"]') as HTMLInputElement;
                picker?.click();
              }
            }}
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] rounded-xl px-2.5 py-1 text-xs transition cursor-pointer ${
              mobileNav === 'library'
                ? 'bg-primary-container text-on-primary-container font-bold shadow-xs'
                : 'text-muted hover:text-text'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
              <path d="M2 4.25A2.25 2.25 0 0 1 4.25 2h2.5A2.25 2.25 0 0 1 9 4.25v.75h7A2 2 0 0 1 18 7v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V4.25Z" />
            </svg>
            <span className="text-[10px] mt-0.5 font-medium">Library</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileNav('chat');
              setMobileTab('chat');
              setIsBubbleHidden(false);
              if (typeof document !== 'undefined') {
                const chatInput = document.querySelector('[data-testid="chat-input"] input') as HTMLInputElement;
                chatInput?.focus();
              }
            }}
            className={`relative flex flex-col items-center justify-center min-w-[64px] min-h-[44px] rounded-xl px-2.5 py-1 text-xs transition cursor-pointer ${
              mobileNav === 'chat'
                ? 'bg-primary-container text-on-primary-container font-bold shadow-xs'
                : 'text-muted hover:text-text'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
              <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.532a2.25 2.25 0 0 0-1.88 2.2V11c0 1.25.98 2.26 2.23 2.3 1.34.04 2.68.12 4.02.24l2.67 2.14a.75.75 0 0 0 1.23-.58v-1.63c1.78-.17 3.52-.45 5.2-.83a2.25 2.25 0 0 0 1.88-2.2V4.732a2.25 2.25 0 0 0-1.88-2.2A49.19 49.19 0 0 0 10 2Z" clipRule="evenodd" />
            </svg>
            <span className="text-[10px] mt-0.5 font-medium">Chat</span>
            {chat.unreadCount > 0 && (
              <span className="absolute top-1.5 right-3 rounded-full bg-primary-container px-1 py-0.2 text-[9px] font-bold text-on-primary-container leading-none">
                {chat.unreadCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setMobileNav('settings');
              setMobileTab('settings');
            }}
            className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] rounded-xl px-2.5 py-1 text-xs transition cursor-pointer ${
              mobileNav === 'settings'
                ? 'bg-primary-container text-on-primary-container font-bold shadow-xs'
                : 'text-muted hover:text-text'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
              <path fillRule="evenodd" d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.992 6.992 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" clipRule="evenodd" />
            </svg>
            <span className="text-[10px] mt-0.5 font-medium">Settings</span>
          </button>
        </nav>
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
