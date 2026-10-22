import { useState } from 'react';
import { Button } from '../../ui';

type Props = { onFile: (file: File) => void; onUrl: (url: string) => void };

export function FilePickerCard({ onFile, onUrl }: Props) {
  const [isDragging, setIsDragging] = useState(false);

  const handleSampleVideo = () => {
    onUrl('/sample.mp4');
  };

  return (
    <div
      className={`flex flex-col items-center justify-center p-6 sm:p-8 rounded-xl bg-surface-container-low border-dashed border-2 transition-all select-none ${
        isDragging
          ? 'border-primary bg-surface-container/90 ring-2 ring-primary/30'
          : 'border-outline/50 hover:border-primary-container hover:bg-surface-container/70'
      }`}
    >
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDragging(false);
          const file = e.dataTransfer.files?.[0];
          if (file) onFile(file);
        }}
        className="flex flex-col items-center justify-center w-full cursor-pointer group"
      >
        <div className="size-12 rounded-full bg-surface-container-high flex items-center justify-center text-primary group-hover:scale-110 transition-transform mb-2.5 shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="size-6" aria-hidden="true">
            <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3h-15ZM10.5 8.25a.75.75 0 0 1 1.13-.65l5.25 3a.75.75 0 0 1 0 1.3l-5.25 3a.75.75 0 0 1-1.13-.65v-6Z" />
          </svg>
        </div>
        <p className="font-headline-md text-base sm:text-lg font-bold text-on-surface text-center">
          Pick a video file
        </p>
        <p className="font-body-md text-xs sm:text-sm text-on-surface-variant text-center mt-1 max-w-lg">
          MP4 (H.264 + AAC) plays everywhere. Files stay local on both computers, never uploaded to any server.
        </p>

        <span className="mt-2.5 rounded-full bg-surface-container px-3 py-0.5 text-[11px] font-medium text-tertiary border border-outline/30">
          Zero lag · Direct P2P playback
        </span>

        <input
          type="file"
          accept="video/*,.mkv"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = '';
            if (file) onFile(file);
          }}
        />
      </label>

      {/* URL / Stream Input and Sample Button */}
      <div className="mt-4 w-full max-w-xl flex flex-col sm:flex-row items-center gap-2">
        <form
          className="flex flex-1 w-full items-center gap-1.5 bg-surface-container-lowest px-3 py-1.5 rounded-lg border border-outline/30 shadow-inner"
          onSubmit={(e) => {
            e.preventDefault();
            const raw = new FormData(e.currentTarget).get('url');
            if (typeof raw === 'string' && raw.trim()) {
              onUrl(raw.trim());
            }
          }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="size-4 text-muted shrink-0">
            <path d="M12.232 4.232a2.5 2.5 0 0 1 3.536 3.536l-1.225 1.224a.75.75 0 0 0 1.061 1.06l1.224-1.224a4 4 0 0 0-5.656-5.656l-3 3a4 4 0 0 0 .225 5.865.75.75 0 0 0 .977-1.138 2.5 2.5 0 0 1-.142-3.667l3-3Z" />
            <path d="M11.603 7.963a.75.75 0 0 0-.977 1.138 2.5 2.5 0 0 1 .142 3.667l-3 3a2.5 2.5 0 0 1-3.536-3.536l1.225-1.224a.75.75 0 0 0-1.061-1.06l-1.224 1.224a4 4 0 1 0 5.656 5.656l3-3a4 4 0 0 0-.225-5.865Z" />
          </svg>
          <input
            name="url"
            type="url"
            required
            placeholder="…or paste a direct video link"
            aria-label="Video URL"
            className="flex-1 bg-transparent text-xs text-on-surface focus:outline-none placeholder:text-muted"
          />
          <Button type="submit" variant="secondary" className="font-semibold shrink-0 text-xs h-7 px-3">
            Load
          </Button>
        </form>

        <Button
          type="button"
          variant="secondary"
          onClick={handleSampleVideo}
          className="w-full sm:w-auto shrink-0 font-semibold text-xs h-8 px-3"
          title="Load Big Buck Bunny open movie demo"
        >
          <span>🎬</span>
          <span>Sample Video</span>
        </Button>
      </div>
    </div>
  );
}
