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

        {!isInCall && !isFloating && (
          <div className="relative w-full aspect-video overflow-hidden rounded-xl bg-surface-container-low border border-outline/30 shadow-md flex flex-col items-center justify-center p-6 text-center select-none">
            <div className="size-12 sm:size-14 rounded-full bg-surface-container-high flex items-center justify-center text-primary mb-3 shadow-inner">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6 sm:size-7" aria-hidden="true">
                <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-2.25l4.5 2.25v-9l-4.5 2.25V7.5a3 3 0 0 0-3-3H4.5Z" />
              </svg>
            </div>
            <h4 className="font-bold text-sm sm:text-base text-text">
              Companion Video Call
            </h4>
            <p className="text-xs text-muted mt-1 max-w-xs">
              {partnerName
                ? 'Direct WebRTC video & audio while watching together.'
                : 'Waiting for your partner to join. Video call will be available once they connect.'}
            </p>
            <div className="mt-3.5 flex items-center gap-2">
              <button
                type="button"
                onClick={call.startCall}
                disabled={!partnerName || call.connectionState === 'requesting-media'}
                className="inline-flex items-center gap-2 rounded-full bg-primary-container px-4 py-2 text-xs font-bold text-on-primary-container hover:bg-primary transition active:scale-95 disabled:opacity-40 cursor-pointer shadow-sm"
              >
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4">
                  <path d="M3.25 4A2.25 2.25 0 0 0 1 6.25v7.5A2.25 2.25 0 0 0 3.25 16h7.5A2.25 2.25 0 0 0 13 13.75v-7.5A2.25 2.25 0 0 0 10.75 4h-7.5ZM14.5 7.025v5.95l3.58 2.046a.75.75 0 0 0 1.17-.653V5.632a.75.75 0 0 0-1.17-.653L14.5 7.025Z" />
                </svg>
                <span>Start Video Call</span>
              </button>
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
