import { Button } from '../../ui';
import { formatTime, mediaMismatch, type MediaInfo } from '../player/media';
import type { MediaMsg } from './protocol';

export interface MediaMismatchDialogProps {
  localMedia: MediaInfo | null;
  partnerMedia: MediaMsg | null;
  onDismiss: () => void;
  onChangeFile?: () => void;
}

export function MediaMismatchDialog({
  localMedia,
  partnerMedia,
  onDismiss,
  onChangeFile,
}: MediaMismatchDialogProps) {
  if (!localMedia || !partnerMedia) return null;

  const isMismatch = mediaMismatch(localMedia, partnerMedia);
  if (!isMismatch) return null;

  const diff = Math.round(Math.abs(localMedia.duration - partnerMedia.duration));
  const diffLabel = diff > 0 ? (localMedia.duration > partnerMedia.duration ? `+${diff}s longer` : `-${diff}s shorter`) : 'Checksum mismatch';

  return (
    <div
      role="dialog"
      aria-labelledby="mismatch-title"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-xs"
    >
      <div className="w-full max-w-lg rounded-t-3xl sm:rounded-2xl border border-outline/40 bg-surface-container-low p-6 shadow-2xl overflow-hidden relative">
        {/* Pull bar handle */}
        <div className="w-12 h-1 rounded-full bg-outline/60 mx-auto mb-4 sm:hidden" />

        {/* Header with sync_problem icon and badge */}
        <div className="flex items-center gap-3 mb-4">
          <div className="grid size-10 place-items-center rounded-xl bg-warn/15 border border-warn/30 text-warn shrink-0">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-5"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M4.755 10.059a7.5 7.5 0 0 1 12.548-3.364l1.903 1.903h-3.183a.75.75 0 1 0 0 1.5h4.992a.75.75 0 0 0 .75-.75V4.356a.75.75 0 0 0-1.5 0v3.18l-1.9-1.9A9 9 0 0 0 3.306 9.67a.75.75 0 1 0 1.45.388Zm15.408 3.352a.75.75 0 0 0-.919.53 7.5 7.5 0 0 1-12.548 3.364l-1.902-1.903h3.183a.75.75 0 0 0 0-1.5H2.984a.75.75 0 0 0-.75.75v4.992a.75.75 0 0 0 1.5 0v-3.18l1.9 1.9a9 9 0 0 0 15.059-4.024.75.75 0 0 0-.53-.919Z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h3 id="mismatch-title" className="text-base font-bold text-text">
                Different File Detected
              </h3>
              <span className="rounded-full bg-warn/15 border border-warn/30 px-2.5 py-0.5 text-[10px] font-semibold text-warn">
                Duration Mismatch
              </span>
            </div>
            <p className="text-xs text-muted mt-0.5">
              Sync may drift if movies differ in cuts, frame rate, or edits.
            </p>
          </div>
        </div>

        {/* Comparison Cards: Partner File Card (Master) vs Your Local File Card */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4">
          {/* Partner File Card (Master) */}
          <div className="rounded-xl border border-outline/30 bg-surface-container p-3 flex flex-col gap-1.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-primary tracking-wider">Partner (Master)</span>
              <span className="text-[10px] rounded-full bg-primary-container/20 px-2 py-0.5 font-semibold text-primary">Master</span>
            </div>
            <div className="text-xs font-semibold text-text truncate" title={partnerMedia.name}>
              {partnerMedia.name}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono-sm text-muted">
              <span>{formatTime(partnerMedia.duration)}</span>
              {partnerMedia.hash && <code className="text-text/70">{partnerMedia.hash.slice(0, 10)}</code>}
            </div>
          </div>

          {/* Your Local File Card */}
          <div className="rounded-xl border border-warn/30 bg-surface-container p-3 flex flex-col gap-1.5 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-warn tracking-wider">Your File</span>
              <span className="text-[10px] rounded-full bg-warn/15 px-2 py-0.5 font-semibold text-warn">{diffLabel}</span>
            </div>
            <div className="text-xs font-semibold text-text truncate" title={localMedia.name}>
              {localMedia.name}
            </div>
            <div className="flex items-center justify-between text-[11px] font-mono-sm text-muted">
              <span>{formatTime(localMedia.duration)}</span>
              {localMedia.hash && <code className="text-text/70">{localMedia.hash.slice(0, 10)}</code>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <Button
            variant="secondary"
            onClick={() => {
              if (onChangeFile) onChangeFile();
              else onDismiss();
            }}
            className="w-full sm:w-auto text-xs font-semibold cursor-pointer"
          >
            Choose Different File
          </Button>
          <Button variant="primary" onClick={onDismiss} className="w-full sm:w-auto text-xs font-semibold shadow-md cursor-pointer">
            Keep Playing Anyway
          </Button>
        </div>
      </div>
    </div>
  );
}
