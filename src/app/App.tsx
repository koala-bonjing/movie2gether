import { useState, useEffect } from 'react';
import { PlayerView } from '../features/player';
import { LobbyView } from '../features/lobby';
import { useRoom, RoomHeader } from '../features/room';
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

  // Keep URL in sync with roomCode
  useEffect(() => {
    if (roomCode) {
      window.history.replaceState(null, '', `?room=${roomCode}`);
    } else {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [roomCode]);

  const handleJoin = (code: string, name: string) => {
    setDisplayName(name);
    setRoomCode(code);
  };

  const handleLeave = () => {
    setRoomCode(null);
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
      onLeave={handleLeave}
    />
  );
}

function RoomSession({
  roomCode,
  displayName,
  onLeave,
}: {
  roomCode: string;
  displayName: string;
  onLeave: () => void;
}) {
  const room = useRoom(roomCode, { displayName });

  const handleLeave = async () => {
    await room.leaveRoom();
    onLeave();
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <RoomHeader
        roomCode={roomCode}
        status={room.status}
        self={room.self}
        partner={room.partner}
        onLeave={handleLeave}
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

      <PlayerView />

      <div className="fixed bottom-4 right-4 z-50">
        <Toast message={`Room ${roomCode}: ${room.status === 'connected' ? 'Ready' : room.status}`} />
      </div>
    </main>
  );
}
