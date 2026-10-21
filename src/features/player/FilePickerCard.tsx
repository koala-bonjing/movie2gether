import { useState } from 'react';
import { Button, Input } from '../../ui';

type Props = { onFile: (file: File) => void; onUrl: (url: string) => void };

export function FilePickerCard({ onFile, onUrl }: Props) {
  const [isDragging, setIsDragging] = useState(false);

  const handleSampleVideo = () => {
    onUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4');
  };

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-outline/30 bg-surface-container p-3 sm:p-4 shadow-xs">
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
        className={`group relative flex min-h-24 cursor-pointer flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border-2 border-dashed p-3 sm:p-4 text-center sm:text-left transition select-none ${
          isDragging
            ? 'border-primary bg-primary-container/20 scale-[1.01]'
            : 'border-outline/70 bg-surface-container-low hover:border-primary-container/80 hover:bg-surface-container-high'
        } focus-within:border-primary`}
      >
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary-container/20 border border-primary-container/40 text-primary group-hover:scale-110 transition-transform">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="size-5"
              aria-hidden="true"
            >
              <path d="M4.5 4.5a3 3 0 0 0-3 3v9a3 3 0 0 0 3 3h15a3 3 0 0 0 3-3v-9a3 3 0 0 0-3-3h-15ZM10.5 8.25a.75.75 0 0 1 1.13-.65l5.25 3a.75.75 0 0 1 0 1.3l-5.25 3a.75.75 0 0 1-1.13-.65v-6Z" />
            </svg>
          </div>
          <div>
            <span className="text-sm font-semibold text-text">Pick a video file</span>
            <p className="text-xs text-muted max-w-sm">
              MP4 (H.264 + AAC) plays everywhere. Nothing is uploaded.
            </p>
          </div>
        </div>
        <span className="shrink-0 rounded-full bg-surface-container-high border border-outline/40 px-3 py-1 text-[11px] font-medium text-muted">
          Plays locally · 1080p native · Zero server upload
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

      <div className="flex flex-col sm:flex-row items-center gap-2">
        <form
          className="flex flex-1 w-full gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const raw = new FormData(e.currentTarget).get('url');
            if (typeof raw === 'string' && raw.trim()) {
              onUrl(raw.trim());
            }
          }}
        >
          <Input
            name="url"
            type="url"
            required
            placeholder="…or paste a direct video link"
            aria-label="Video URL"
            className="flex-1 text-xs h-9"
          />
          <Button type="submit" variant="secondary" className="font-semibold shrink-0 text-xs h-9">
            Load
          </Button>
        </form>

        <Button
          type="button"
          variant="secondary"
          onClick={handleSampleVideo}
          className="w-full sm:w-auto shrink-0 font-semibold text-xs h-9"
          title="Load Blender Big Buck Bunny open movie demo"
        >
          <span>🎬</span>
          <span>Try Sample Video</span>
        </Button>
      </div>
    </div>
  );
}
