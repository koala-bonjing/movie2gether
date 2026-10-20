import { useState, useRef, useEffect, useCallback, memo } from 'react';
import type { UseCallReturn } from './useCall';
import { CamTile } from './CamTile';

export interface FloatingCamBubbleProps {
  call: UseCallReturn;
  partnerName?: string;
  selfName?: string;
  onDock?: () => void;
  className?: string;
}

export const FloatingCamBubble = memo(function FloatingCamBubble({
  call,
  partnerName = 'Partner',
  selfName = 'You',
  onDock,
  className = '',
}: FloatingCamBubbleProps) {
  // Initial position: top-right area (e.g. 20px from right, 80px from top)
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    if (typeof window !== 'undefined') {
      return {
        x: Math.max(16, window.innerWidth - 240),
        y: 80,
      };
    }
    return { x: 20, y: 80 };
  });

  const [isMinimized, setIsMinimized] = useState(false);
  const dragRef = useRef<{ isDragging: boolean; startX: number; startY: number; origX: number; origY: number }>({
    isDragging: false,
    startX: 0,
    startY: 0,
    origX: 0,
    origY: 0,
  });

  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only drag with primary pointer / left click
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    // Don't drag if clicking buttons
    if (target.closest('button')) return;

    dragRef.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      origX: position.x,
      origY: position.y,
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current.isDragging) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    const width = isMinimized ? 72 : 220;
    const height = isMinimized ? 72 : 130;
    const maxX = Math.max(0, (typeof window !== 'undefined' ? window.innerWidth : 800) - width - 16);
    const maxY = Math.max(0, (typeof window !== 'undefined' ? window.innerHeight : 600) - height - 16);

    const nextX = Math.min(Math.max(16, dragRef.current.origX + dx), maxX);
    const nextY = Math.min(Math.max(16, dragRef.current.origY + dy), maxY);

    setPosition({ x: nextX, y: nextY });
  }, [isMinimized]);

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (dragRef.current.isDragging) {
      dragRef.current.isDragging = false;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // ignore
      }
    }
  }, []);

  // Window resize protection
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const maxX = Math.max(16, window.innerWidth - 240);
        const maxY = Math.max(16, window.innerHeight - 150);
        return {
          x: Math.min(prev.x, maxX),
          y: Math.min(prev.y, maxY),
        };
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isInCall =
    call.localStream !== null &&
    (call.connectionState === 'connected' ||
      call.connectionState === 'connecting' ||
      call.connectionState === 'requesting-media');

  if (!isInCall) return null;

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      data-testid="floating-cam-bubble"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        touchAction: 'none',
      }}
      className={`fixed z-50 select-none transition-shadow duration-150 cursor-grab active:cursor-grabbing rounded-2xl shadow-2xl border border-border/80 bg-surface/95 backdrop-blur-md overflow-hidden ${
        isMinimized ? 'size-18' : 'w-56 sm:w-64'
      } ${className}`}
    >
      {/* Header bar / drag handle */}
      <div className="flex h-7 items-center justify-between px-2 bg-surface-2/90 border-b border-border/40 text-[10px] text-muted">
        <span className="font-semibold text-text truncate max-w-[90px]">{partnerName}</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setIsMinimized((prev) => !prev)}
            aria-label={isMinimized ? 'Expand camera' : 'Minimize camera'}
            className="grid size-5 place-items-center rounded-sm hover:bg-white/10 hover:text-text transition"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? '□' : '–'}
          </button>
          {onDock && (
            <button
              type="button"
              onClick={onDock}
              aria-label="Dock camera into sidebar"
              data-testid="dock-cam-btn"
              className="grid size-5 place-items-center rounded-sm hover:bg-white/10 hover:text-text transition"
              title="Dock in sidebar"
            >
              ⤢
            </button>
          )}
        </div>
      </div>

      {/* Main Cam View */}
      {!isMinimized ? (
        <div className="relative aspect-video w-full bg-surface-2">
          <CamTile
            stream={call.remoteStream}
            name={partnerName}
            isLocal={false}
            isCamOn={call.remoteCamOn}
            isMicOn={call.remoteMicOn}
            stats={call.remoteStats}
            className="w-full h-full"
          />

          {/* Self Mini-PiP */}
          <div className="absolute bottom-1 right-1 w-20 aspect-video z-10 shadow-md">
            <CamTile
              stream={call.localStream}
              name={selfName}
              isLocal={true}
              isCamOn={call.isCamOn}
              isMicOn={call.isMicOn}
              className="w-full h-full border border-surface/90"
            />
          </div>
        </div>
      ) : (
        <div className="size-full grid place-items-center bg-surface-2 p-1">
          <div className="grid size-9 place-items-center rounded-full bg-accent/20 border border-accent/40 text-xs font-bold text-accent">
            {partnerName.trim().charAt(0).toUpperCase() || 'P'}
          </div>
        </div>
      )}
    </div>
  );
});
