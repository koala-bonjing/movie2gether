import { useState, useRef, useEffect, type PointerEvent } from 'react';
import type { VideoStats } from './webrtc';
import type { UseCallReturn } from './useCall';

export interface FloatingCamBubbleProps {
  call?: UseCallReturn;
  stream?: MediaStream | null;
  partnerName?: string;
  selfName?: string;
  isCamOn?: boolean;
  isMicOn?: boolean;
  stats?: VideoStats | null;
  defaultCollapsed?: boolean;
  onExpand?: () => void;
  onClose?: () => void;
  onDock?: () => void;
  containerRef?: React.RefObject<HTMLElement | null>;
}

export function FloatingCamBubble({
  call,
  stream,
  partnerName = 'Partner',
  isCamOn,
  isMicOn,
  stats,
  defaultCollapsed = false,
  onExpand,
  onClose,
  onDock,
  containerRef,
}: FloatingCamBubbleProps) {
  const effectiveStream = stream !== undefined ? stream : (call?.remoteStream ?? null);
  const effectiveCamOn = isCamOn !== undefined ? isCamOn : (call ? call.remoteCamOn : true);
  const effectiveMicOn = isMicOn !== undefined ? isMicOn : (call ? call.remoteMicOn : true);
  const effectiveStats = stats !== undefined ? stats : (call?.remoteStats ?? null);
  const handleExpand = onExpand || onDock;
  const handleClose = onClose || onDock;

  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const dragRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = effectiveStream;
      if (effectiveStream) {
        videoRef.current.play().catch(() => {});
      }
    }
  }, [effectiveStream]);

  const hasVideo = effectiveStream && effectiveStream.getVideoTracks().length > 0 && effectiveCamOn;
  const initial = partnerName.trim().charAt(0).toUpperCase() || '?';

  const handlePointerDown = (e: PointerEvent) => {
    // Only drag with primary pointer (not when clicking child buttons)
    if ((e.target as HTMLElement).closest('button')) return;
    const bubble = bubbleRef.current;
    if (!bubble) return;

    hasDraggedRef.current = false;

    const rect = bubble.getBoundingClientRect();
    const parentRect = containerRef?.current
      ? containerRef.current.getBoundingClientRect()
      : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

    const currentX = pos ? pos.x : rect.left - parentRect.left;
    const currentY = pos ? pos.y : rect.top - parentRect.top;

    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      initialX: currentX,
      initialY: currentY,
    };
    setIsDragging(true);
    bubble.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (!dragRef.current || !bubbleRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;

    if (Math.hypot(dx, dy) > 4) {
      hasDraggedRef.current = true;
    }

    const parentWidth = containerRef?.current?.clientWidth || window.innerWidth;
    const parentHeight = containerRef?.current?.clientHeight || window.innerHeight;
    const bubbleWidth = bubbleRef.current.offsetWidth || (isCollapsed ? 48 : 130);
    const bubbleHeight = bubbleRef.current.offsetHeight || (isCollapsed ? 48 : 80);

    const nextX = Math.max(8, Math.min(parentWidth - bubbleWidth - 8, dragRef.current.initialX + dx));
    const nextY = Math.max(8, Math.min(parentHeight - bubbleHeight - 8, dragRef.current.initialY + dy));

    setPos({ x: nextX, y: nextY });
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (dragRef.current && bubbleRef.current) {
      try {
        bubbleRef.current.releasePointerCapture(e.pointerId);
      } catch {
        // pointer capture already released
      }
    }
    dragRef.current = null;
    setIsDragging(false);

    // If tapped/clicked without dragging while collapsed, expand back
    if (isCollapsed && !hasDraggedRef.current) {
      setIsCollapsed(false);
    }
  };

  return (
    <div
      ref={bubbleRef}
      role="region"
      aria-label={`${partnerName}'s camera floating bubble`}
      data-testid="floating-cam-bubble"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={
        pos
          ? {
              left: `${pos.x}px`,
              top: `${pos.y}px`,
              touchAction: 'none',
            }
          : {
              right: '16px',
              top: '16px',
              touchAction: 'none',
            }
      }
      className={`group absolute z-30 cursor-grab active:cursor-grabbing overflow-hidden shadow-2xl select-none backdrop-blur-xs transition-all duration-200 ${
        isCollapsed
          ? 'size-11 sm:size-12 rounded-full border border-accent/40 bg-surface-2/80 opacity-25 hover:opacity-100 hover:scale-105 active:scale-95 cursor-pointer'
          : 'w-32 sm:w-36 aspect-video rounded-xl border-2 border-accent/60 bg-surface-2 opacity-100'
      } ${isDragging ? 'shadow-accent/20 scale-102 ring-2 ring-accent opacity-100' : 'hover:border-accent'}`}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        className={`size-full object-cover pointer-events-none transition-opacity duration-200 ${
          hasVideo ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Fallback avatar when camera is off */}
      {!hasVideo && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-surface-2 text-text pointer-events-none">
          <div className="grid size-9 place-items-center rounded-full bg-accent/20 border border-accent/40 text-sm font-bold text-accent">
            {initial}
          </div>
          {!isCollapsed && (
            <span className="text-[10px] text-muted">{effectiveCamOn ? 'Audio only' : 'Camera off'}</span>
          )}
        </div>
      )}

      {/* Collapsed view status indicator & hover expand cue */}
      {isCollapsed ? (
        <>
          {!effectiveMicOn ? (
            <span
              className="absolute bottom-0 right-0 grid size-3.5 place-items-center rounded-full bg-danger text-white ring-1 ring-black"
              title="Muted"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-2">
                <path d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06L3.28 2.22Z" />
              </svg>
            </span>
          ) : (
            <span
              className="absolute bottom-0.5 right-0.5 size-2 rounded-full bg-emerald-400 ring-1 ring-black"
              title="Live audio"
            />
          )}
          {/* Subtle expand icon on hover */}
          <div className="absolute inset-0 grid place-items-center bg-black/40 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5 text-white">
              <path d="M13.28 7.78 17 4.06V7a.75.75 0 0 0 1.5 0V2.5A.5.5 0 0 0 18 2h-4.5a.75.75 0 0 0 0 1.5h2.94l-3.72 3.72a.75.75 0 0 0 1.06 1.06ZM6.72 12.22 3 15.94V13a.75.75 0 0 0-1.5 0v4.5a.5.5 0 0 0 .5.5H6.5a.75.75 0 0 0 0-1.5H3.56l3.72-3.72a.75.75 0 1 0-1.06-1.06Z" />
            </svg>
          </div>
        </>
      ) : (
        <>
          {/* Overlay badges and action controls */}
          <div className="absolute inset-x-1.5 bottom-1 flex items-center justify-between pointer-events-none">
            <span className="truncate rounded-sm bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white max-w-[65%]">
              {partnerName}
            </span>
            {!effectiveMicOn && (
              <span className="grid size-4 place-items-center rounded-xs bg-danger/90 text-white" title="Muted">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-2.5">
                  <path d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06L3.28 2.22Z" />
                </svg>
              </span>
            )}
          </div>

          {/* Hover action controls */}
          <div className="absolute top-1 right-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity bg-black/60 rounded-md p-0.5 backdrop-blur-xs pointer-events-auto">
            {/* Collapse button (Messenger-style minimize) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setIsCollapsed(true);
              }}
              aria-label="Collapse video camera"
              title="Collapse camera"
              className="grid size-6 place-items-center rounded-xs text-white hover:bg-white/20 transition active:scale-95 cursor-pointer"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                <path fillRule="evenodd" d="M4 10a.75.75 0 0 1 .75-.75h11.5a.75.75 0 0 1 0 1.5H4.75A.75.75 0 0 1 4 10Z" clipRule="evenodd" />
              </svg>
            </button>

            {handleExpand && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleExpand();
                }}
                aria-label="Expand call view"
                title="Expand call"
                className="grid size-6 place-items-center rounded-xs text-white hover:bg-white/20 transition active:scale-95 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                  <path d="M13.28 7.78 17 4.06V7a.75.75 0 0 0 1.5 0V2.5A.5.5 0 0 0 18 2h-4.5a.75.75 0 0 0 0 1.5h2.94l-3.72 3.72a.75.75 0 0 0 1.06 1.06ZM6.72 12.22 3 15.94V13a.75.75 0 0 0-1.5 0v4.5a.5.5 0 0 0 .5.5H6.5a.75.75 0 0 0 0-1.5H3.56l3.72-3.72a.75.75 0 1 0-1.06-1.06Z" />
                </svg>
              </button>
            )}

            {handleClose && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleClose();
                }}
                aria-label="Hide floating camera"
                title="Hide"
                className="grid size-6 place-items-center rounded-xs text-white hover:bg-white/20 transition active:scale-95 cursor-pointer"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-3.5">
                  <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
                </svg>
              </button>
            )}
          </div>
        </>
      )}

      {effectiveStats && effectiveStats.width && effectiveStats.height && (
        <span className="sr-only">
          {effectiveStats.width}x{effectiveStats.height} {effectiveStats.fps ? `${effectiveStats.fps}fps` : ''}
        </span>
      )}
    </div>
  );
}
