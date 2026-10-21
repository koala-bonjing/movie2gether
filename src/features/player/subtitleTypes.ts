export type SubtitleFontSize = 'sm' | 'md' | 'lg';

export const SUBTITLE_FONT_SIZES: Record<SubtitleFontSize, { label: string; px: string }> = {
  sm: { label: 'Small', px: '14px' },
  md: { label: 'Medium', px: '18px' },
  lg: { label: 'Large', px: '24px' },
};

export interface SubtitleTrack {
  label: string;
  blobUrl: string;
}
