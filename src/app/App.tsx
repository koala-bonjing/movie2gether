import { useState, useEffect } from 'react';
import { PlayerView, type MediaInfo } from '../features/player';
import { LobbyView } from '../features/lobby';
import { useRoom, RoomHeader } from '../features/room';
import { useSync, MediaMismatchDialog, SyncDevOverlay } from '../features/sync';
import { useChat, ChatView } from '../features/chat';
import { useCall, CallSection } from '../features/call';
import { Toast } from '../ui';

export function App() {
  const [roomCode, setRoomCode] = useState<string | null>(() => {
    // Check URL search param ?room=CODE or hash #CODE
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get('room');
    if (fromQuery) return fromQuery.toUpperCase();
    const hash = window.location.hash.replace('#', '');
    if (hash && hash.length === 6) return hash.toUpperCase();
    return null;
  });

  const [displayName, setDisplayName] = useState<string>(() => {
    try {
      return localStorage.getItem('duet:display-name') || '';
    } catch {
      return '';
    }
  });

  const [isCreator, setIsCreator] = useState(false);

  // Keep URL in sync with roomCode
  useEffect(() => {
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

  if (!roomCode) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-5xl flex-col justify-center p-4 sm:p-8">
        <LobbyView onJoin={handleJoin} />
      </main>
    );
  }

  return (
    <RoomSession
      roomCode={roomCode}
      displayName={displayName || 'Anonymous'}
      isCreator={isCreator}
      onLeave={handleLeave}
    />
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

  const sync = useSync(videoElement, room.channel, room.self?.userId ?? null);

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

  const { broadcastMedia } = sync;
  const selfUserId = room.self?.userId;

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

  const handleLeave = async () => {
    call.endCall();
    await room.leaveRoom();
    onLeave();
  };

  const showMismatch = sync.partnerMedia && localMedia && dismissedHash !== sync.partnerMedia.hash;

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

      <div
        className={`grid grid-cols-1 gap-6 items-start ${
          chat.isOpen || call.connectionState !== 'idle' ? 'lg:grid-cols-[1fr_360px]' : ''
        }`}
      >
        <div className="flex flex-col gap-6 min-w-0">
          <PlayerView
            onVideoRef={setVideoElement}
            onMediaInfo={setLocalMedia}
            partnerBuffering={sync.partnerBuffering}
          />

          {showMismatch && sync.partnerMedia && localMedia && (
            <MediaMismatchDialog
              localMedia={localMedia}
              partnerMedia={sync.partnerMedia}
              onDismiss={() => setDismissedHash(sync.partnerMedia?.hash ?? null)}
            />
          )}
        </div>

        {(chat.isOpen || call.connectionState !== 'idle') && (
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

      <SyncDevOverlay sync={sync} roomCode={roomCode} />

      <div className="fixed bottom-4 right-4 z-50">
        <Toast message={`Room ${roomCode}: ${room.status === 'connected' ? 'Ready' : room.status}`} />
      </div>
    </main>
  );
}
