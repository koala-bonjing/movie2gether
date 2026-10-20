import { useState } from 'react';
import { Button, Input } from '../../ui';

type Props = { onFile: (file: File) => void; onUrl: (url: string) => void };

export function FilePickerCard({ onFile, onUrl }: Props) {
  const [isDragging, setIsDragging] = useState(false);

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-border bg-surface p-4 sm:p-6">
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
        className={`flex min-h-28 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed p-4 text-center transition ${
          isDragging ? 'border-accent bg-accent/10' : 'border-border hover:border-accent'
        } focus-within:border-accent`}
      >
        <span className="text-lg font-medium">Pick a video file</span>
        <span className="text-sm text-muted">MP4 (H.264 + AAC) plays everywhere. Nothing is uploaded.</span>
        <input
          type="file"
          accept="video/*,.mkv"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = ''; // so picking the same file again still fires change
            if (file) onFile(file);
          }}
        />
      </label>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const raw = new FormData(e.currentTarget).get('url');
          if (typeof raw === 'string' && raw.trim()) {
            onUrl(raw.trim());
          }
        }}
      >
        <Input name="url" type="url" required placeholder="…or paste a direct video link" aria-label="Video URL" />
        <Button type="submit" variant="ghost">
          Load
        </Button>
      </form>
    </div>
  );
}
