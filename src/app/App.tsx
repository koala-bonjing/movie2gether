import { useState, useEffect, useRef, useCallback } from 'react';
import { PlayerView, type MediaInfo } from '../features/player';
import { formatTime } from '../features/player/media';
import { LobbyView } from '../features/lobby';
import { useRoom, RoomHeader } from '../features/room';
import { useSync, MediaMismatchDialog, SyncDevOverlay } from '../features/sync';
import { safeParseRoomModeMsg } from '../features/sync/protocol';
import { useChat, ChatView } from '../features/chat';
import { useCall, CallSection, FloatingCamBubble } from '../features/call';
import { Toast, PwaInstallPrompt } from '../ui';

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
        <main className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center p-4 sm:p-8">
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
  const [mobileTab, setMobileTab] = useState<'chat' | 'call'>('chat');
  const [isBubbleHidden, setIsBubbleHidden] = useState(false);
  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth < 1024;
  });

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
        showToast(`${partnerName} skipped to ${formatTime(action.pos)}`);
      } else if (action.type === 'pause') {
        showToast(`${partnerName} paused`);
      } else if (action.type === 'play') {
        showToast(`${partnerName} played`);
      }
    },
    [room.partner?.name, showToast],
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

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-6 p-4 sm:p-8">
      <RoomHeader
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
      />

      {room.error && (
        <div role="alert" className="flex items-center justify-between rounded-md border border-danger/40 bg-danger/10 p-3 text-xs text-danger">
          <span>{room.error}</span>
          <button
            type="button"
            onClick={handleLeave}
            className="underline font-medium hover:opacity-80"
          >
            Return to lobby
          </button>
        </div>
      )}

      {room.partnerStatus === 'left' && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-md border border-warn/40 bg-warn/10 p-3 text-xs text-warn shadow-xs"
          data-testid="partner-left-banner"
        >
          <span className="size-2 rounded-full bg-warn motion-safe:animate-pulse" />
          <span className="font-semibold">Playback paused (partner disconnected).</span>
        </div>
      )}

      <div
        className={`grid grid-cols-1 gap-6 items-start ${
          !isTheater && (chat.isOpen || call.connectionState !== 'idle') ? 'lg:grid-cols-[1fr_360px]' : ''
        }`}
      >
        {/* Main Video Section */}
        <div className="relative flex flex-col gap-6 min-w-0">
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
            stats={call.remoteStats}
            isTheater={isTheater}
            onToggleTheater={() => setIsTheater((prev) => !prev)}
            onSyncNow={sync.syncNow}
          />

          {showBubble && (
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
          )}

          {showMismatch && sync.partnerMedia && localMedia && (
            <MediaMismatchDialog
              localMedia={localMedia}
              partnerMedia={sync.partnerMedia}
              onDismiss={() => setDismissedHash(sync.partnerMedia?.hash ?? null)}
            />
          )}

          {/* Mobile Tab Bar (< 1024px) per DESIGN.md */}
          {/* Mobile Tab Bar (< 1024px) per DESIGN.md */}
          {isMobile && (
            <div className="flex flex-col gap-4 mt-2">
              <div
                role="tablist"
                aria-label="Room navigation"
                className="grid grid-cols-2 rounded-xl border border-border bg-surface p-1 shadow-xs"
              >
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
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${
                    mobileTab === 'chat'
                      ? 'bg-accent text-bg shadow-sm'
                      : 'text-muted hover:text-text hover:bg-surface-2'
                  }`}
                  data-testid="mobile-tab-chat"
                >
                  <span>Chat</span>
                  {chat.unreadCount > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold leading-tight ${
                        mobileTab === 'chat' ? 'bg-bg text-accent' : 'bg-accent text-bg'
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
                  onClick={() => setMobileTab('call')}
                  className={`flex min-h-11 items-center justify-center gap-2 rounded-lg text-sm font-semibold transition ${
                    mobileTab === 'call'
                      ? 'bg-accent text-bg shadow-sm'
                      : 'text-muted hover:text-text hover:bg-surface-2'
                  }`}
                  data-testid="mobile-tab-call"
                >
                  <span>Call</span>
                  {call.connectionState !== 'idle' && (
                    <span
                      className={`size-2 rounded-full ${
                        call.connectionState === 'connected' ? 'bg-success' : 'bg-warn animate-pulse'
                      }`}
                    />
                  )}
                </button>
              </div>

              <div className="w-full">
                {mobileTab === 'chat' ? (
                  <div
                    id="panel-chat"
                    role="tabpanel"
                    aria-labelledby="tab-chat"
                    className="h-[420px] w-full"
                  >
                    <ChatView
                      messages={chat.messages}
                      selfUserId={room.self?.userId ?? null}
                      partnerName={room.partner?.name}
                      onSendMessage={chat.sendMessage}
                    />
                  </div>
                ) : (
                  <div
                    id="panel-call"
                    role="tabpanel"
                    aria-labelledby="tab-call"
                    className="w-full"
                  >
                    <CallSection
                      call={call}
                      partnerName={room.partner?.name}
                      selfName={room.self?.name}
                    />
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Desktop Side Panel (>= 1024px) */}
        {!isMobile && !isTheater && (chat.isOpen || call.connectionState !== 'idle') && (
          <aside className="flex flex-col gap-4 w-full shrink-0">
            <CallSection
              call={call}
              partnerName={room.partner?.name}
              selfName={room.self?.name}
            />

            {chat.isOpen && (
              <div className="h-[460px] w-full">
                <ChatView
                  messages={chat.messages}
                  selfUserId={room.self?.userId ?? null}
                  partnerName={room.partner?.name}
                  onSendMessage={chat.sendMessage}
                  onClose={() => chat.setIsOpen(false)}
                />
              </div>
            )}
          </aside>
        )}
      </div>

      {/* Bottom Status Strip per DESIGN.md §Desktop */}
      <footer
        className="hidden lg:flex items-center justify-between border-t border-border/60 pt-3 text-xs text-muted"
        data-testid="desktop-status-strip"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-text">Sync:</span>
            <span className="size-2 rounded-full bg-success" />
            <span>
              {Math.abs(sync.drift) > 0.05
                ? `${Math.round(Math.abs(sync.drift) * 1000)}ms drift`
                : 'Synchronized'}
            </span>
          </div>
          <span>·</span>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-text">Quality:</span>
            <span>
              {call.remoteStats && call.remoteStats.width
                ? `${call.remoteStats.width}×${call.remoteStats.height}`
                : '1080p source'}
            </span>
          </div>
          <span>·</span>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-text">Partner:</span>
            <span
              className={`size-2 rounded-full ${
                room.partner
                  ? 'bg-success'
                  : room.partnerStatus === 'left'
                    ? 'bg-warn'
                    : 'bg-muted motion-safe:animate-pulse'
              }`}
            />
            <span>
              {room.partner ? 'Connected' : room.partnerStatus === 'left' ? 'Left' : 'Awaiting peer…'}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 text-[11px] text-muted">
          <span>Shortcuts: Space (play/pause) · ← → (5s) · F (fullscreen) · C (chat)</span>
        </div>
      </footer>

      <SyncDevOverlay sync={sync} roomCode={roomCode} />

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
