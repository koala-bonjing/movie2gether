import { Button } from '../../ui';
import { formatTime, mediaMismatch, type MediaInfo } from '../player/media';
import type { MediaMsg } from './protocol';

export interface MediaMismatchDialogProps {
  localMedia: MediaInfo | null;
  partnerMedia: MediaMsg | null;
  onDismiss: () => void;
}

export function MediaMismatchDialog({
  localMedia,
  partnerMedia,
  onDismiss,
}: MediaMismatchDialogProps) {
  if (!localMedia || !partnerMedia) return null;

  const isMismatch = mediaMismatch(localMedia, partnerMedia);
  if (!isMismatch) return null;

  return (
    <div
      role="dialog"
      aria-labelledby="mismatch-title"
      aria-modal="true"
      className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-md rounded-lg border border-border bg-surface p-6 shadow-2xl">
        <h3 id="mismatch-title" className="text-lg font-bold text-warn">
          Different files detected
        </h3>
        <p className="mt-2 text-sm text-muted">
          Your video files appear to differ in duration or content. Sync may drift slightly, but you can continue watching.
        </p>

        <div className="my-4 space-y-2 rounded-sm bg-surface-2 p-3 text-xs text-muted">
          <div>
            <span className="font-semibold text-text">You:</span> {localMedia.name} ({formatTime(localMedia.duration)})
          </div>
          <div>
            <span className="font-semibold text-text">Partner:</span> {partnerMedia.name} ({formatTime(partnerMedia.duration)})
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="primary" onClick={onDismiss} className="px-5 text-sm">
            Continue anyway
          </Button>
        </div>
      </div>
    </div>
  );
}
