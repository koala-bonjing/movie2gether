import { useState } from 'react';
import { CamTile } from './CamTile';
import { CallControls } from './CallControls';
import { FloatingCamBubble } from './FloatingCamBubble';
import type { UseCallReturn } from './useCall';

export interface CallSectionProps {
  call: UseCallReturn;
  partnerName?: string;
  selfName?: string;
  className?: string;
}

export function CallSection({
  call,
  partnerName = 'Partner',
  selfName = 'You',
  className = '',
}: CallSectionProps) {
  const [isFloating, setIsFloating] = useState(false);
  const [callVolume, setCallVolume] = useState(1);

  const isInCall =
    call.localStream !== null &&
    (call.connectionState === 'connected' ||
      call.connectionState === 'connecting' ||
      call.connectionState === 'requesting-media');

  return (
    <>
      <div
        className={`flex flex-col gap-3 rounded-2xl border border-outline/30 bg-surface-container p-3.5 shadow-xs ${className}`}
        data-testid="call-section"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-text">WebRTC Call</span>
            <span className="rounded-full bg-surface-container-high px-2 py-0.5 text-[10px] font-mono-sm font-medium text-muted border border-outline/30">
              {call.remoteStats?.width ? `${call.remoteStats.height}p ${call.remoteStats.fps || 30}fps` : '720p 30fps'}
            </span>
            {call.connectionState === 'connected' && (
              <span className="flex items-center gap-1 rounded-full bg-tertiary/15 px-2 py-0.5 text-[10px] font-medium text-tertiary border border-tertiary/30">
                <span className="size-1.5 rounded-full bg-tertiary animate-pulse" />
                Connected
              </span>
            )}
            {call.connectionState === 'connecting' && (
              <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-medium text-warn border border-warn/30">
                Connecting…
              </span>
            )}
            {call.connectionState === 'incoming' && (
              <span className="rounded-full bg-primary-container/20 px-2 py-0.5 text-[10px] font-medium text-primary animate-pulse border border-primary-container/40">
                Incoming call…
              </span>
            )}
          </div>

          <CallControls
            connectionState={call.connectionState}
            isCamOn={call.isCamOn}
            isMicOn={call.isMicOn}
            isAudioOnly={call.isAudioOnly}
            onStartCall={call.startCall}
            onEndCall={call.endCall}
            toggleCam={call.toggleCam}
            toggleMic={call.toggleMic}
            onRetry={call.restartIce}
            isFloating={isFloating}
            onToggleFloat={isInCall ? () => setIsFloating((f) => !f) : undefined}
            isScreenSharing={call.isScreenSharing}
            isScreenShareAvailable={call.isScreenShareAvailable}
            onToggleScreenShare={call.toggleScreenShare}
            outputVolume={callVolume}
            onOutputVolumeChange={setCallVolume}
          />
        </div>

        {call.errorMessage && (
          <div
            role="alert"
            className="rounded-lg border border-danger/40 bg-danger/10 p-2.5 text-xs text-danger"
          >
            {call.errorMessage}
          </div>
        )}

        {/* Idle prompt when not in call */}
        {!isInCall && (
          <div className="flex flex-col items-center justify-center p-5 text-center rounded-xl bg-surface-2/40 border border-border/40 select-none">
            <div className="grid size-9 place-items-center rounded-xl bg-accent/15 text-accent mb-2">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4.5">
                <path d="M3.25 4A2.25 2.25 0 0 0 1 6.25v7.5A2.25 2.25 0 0 0 3.25 16h7.5A2.25 2.25 0 0 0 13 13.75v-7.5A2.25 2.25 0 0 0 10.75 4h-7.5ZM14.5 7.025v5.95l3.58 2.046a.75.75 0 0 0 1.17-.653V5.632a.75.75 0 0 0-1.17-.653L14.5 7.025Z" />
              </svg>
            </div>
            <p className="text-xs font-semibold text-text">Watch Face-to-Face</p>
            <p className="text-[11px] text-muted mt-0.5 max-w-[200px]">
              Start a peer-to-peer video & audio call with your partner.
            </p>
          </div>
        )}

        {/* Docked camera view when in call and not floating */}
        {isInCall && !isFloating && (
          <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-surface-container-low border border-outline/40 shadow-inner">
            {/* Main: Partner video feed */}
            <CamTile
              stream={call.remoteStream}
              name={partnerName}
              isLocal={false}
              isCamOn={call.remoteCamOn}
              isMicOn={call.remoteMicOn}
              stats={call.remoteStats}
              volume={callVolume}
              className="w-full h-full border-0"
            />

            {/* Self camera feed (picture-in-picture style with hover expand) */}
            <div className="absolute bottom-2.5 right-2.5 w-28 sm:w-32 aspect-video shadow-lg z-10 transition-transform duration-150 hover:scale-110">
              <CamTile
                stream={call.localStream}
                name={selfName}
                isLocal={true}
                isCamOn={call.isCamOn}
                isMicOn={call.isMicOn}
                className="w-full h-full border-2 border-surface-container-highest/90 shadow-md rounded-xl"
              />
            </div>
          </div>
        )}

        {isInCall && isFloating && (
          <div className="flex items-center justify-between rounded-xl bg-surface-2/80 p-2.5 text-xs text-muted border border-border/60">
            <span>Camera floating over screen</span>
            <button
              type="button"
              onClick={() => setIsFloating(false)}
              data-testid="dock-cam-btn"
              className="text-accent underline font-semibold hover:opacity-80"
            >
              Dock here
            </button>
          </div>
        )}
      </div>

      {/* Floating draggable camera bubble */}
      {isInCall && isFloating && (
        <FloatingCamBubble
          call={call}
          partnerName={partnerName}
          selfName={selfName}
          onDock={() => setIsFloating(false)}
        />
      )}
    </>
  );
}
