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

  const isInCall =
    call.localStream !== null &&
    (call.connectionState === 'connected' ||
      call.connectionState === 'connecting' ||
      call.connectionState === 'requesting-media');

  return (
    <>
      <div
        className={`flex flex-col gap-2 rounded-xl border border-border bg-surface p-3 shadow-md ${className}`}
        data-testid="call-section"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-text">Video Call</span>
            {call.connectionState === 'connected' && (
              <span className="flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                <span className="size-1.5 rounded-full bg-success animate-pulse" />
                Connected
              </span>
            )}
            {call.connectionState === 'connecting' && (
              <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-medium text-warn">
                Connecting…
              </span>
            )}
            {call.connectionState === 'incoming' && (
              <span className="rounded-full bg-accent/20 px-2 py-0.5 text-[10px] font-medium text-accent animate-pulse">
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
            onToggleCam={call.toggleCam}
            onToggleMic={call.toggleMic}
            onRetry={call.restartIce}
            isFloating={isFloating}
            onToggleFloat={isInCall ? () => setIsFloating((f) => !f) : undefined}
            isScreenSharing={call.isScreenSharing}
            isScreenShareAvailable={call.isScreenShareAvailable}
            onToggleScreenShare={call.toggleScreenShare}
          />
        </div>

        {call.errorMessage && (
          <div
            role="alert"
            className="rounded-md border border-danger/40 bg-danger/10 p-2 text-xs text-danger"
          >
            {call.errorMessage}
          </div>
        )}

        {/* Docked camera view when in call and not floating */}
        {isInCall && !isFloating && (
          <div className="relative w-full aspect-video overflow-hidden rounded-lg bg-surface-2">
            {/* Main: Partner video feed */}
            <CamTile
              stream={call.remoteStream}
              name={partnerName}
              isLocal={false}
              isCamOn={call.remoteCamOn}
              isMicOn={call.remoteMicOn}
              stats={call.remoteStats}
              className="w-full h-full"
            />

            {/* Self camera feed (picture-in-picture style) */}
            <div className="absolute bottom-2 right-2 w-28 sm:w-32 aspect-video shadow-lg z-10">
              <CamTile
                stream={call.localStream}
                name={selfName}
                isLocal={true}
                isCamOn={call.isCamOn}
                isMicOn={call.isMicOn}
                className="w-full h-full border-2 border-surface/90 shadow-md"
              />
            </div>
          </div>
        )}

        {isInCall && isFloating && (
          <div className="flex items-center justify-between rounded-lg bg-surface-2 p-2 text-xs text-muted">
            <span>Camera floating over screen</span>
            <button
              type="button"
              onClick={() => setIsFloating(false)}
              className="text-accent underline font-medium hover:opacity-80"
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
