import { PlayerView } from '../features/player';
import { StatusDot, Toast } from '../ui';

export function App() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-6 p-4 sm:p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">Duet</h1>
          <p className="text-sm text-muted">A private cinema for two. Rooms come next; for now, try the player.</p>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          <StatusDot status="online" pulse />
          <span>Local mode</span>
        </div>
      </header>
      <PlayerView />
      <div className="fixed bottom-4 right-4 z-50">
        <Toast message="Phase 0 & 1: Ready to play" />
      </div>
    </main>
  );
}
