import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost';
  size?: 'sm' | 'md';
};

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  const look = variant === 'primary' ? 'bg-accent text-bg hover:opacity-90' : 'text-text hover:bg-surface-2';
  const sizing = size === 'sm' ? 'min-h-9 px-3 text-xs' : 'min-h-11 px-5 font-medium';
  return (
    <button
      type="button"
      className={`rounded-full transition disabled:opacity-50 ${sizing} ${look} ${className}`}
      {...props}
    />
  );
}

/** Icon-only button: `label` is required and becomes the accessible name + tooltip. */
export function IconButton({
  label,
  className = '',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid size-11 shrink-0 place-items-center rounded-full text-text transition hover:bg-white/10 ${className}`}
      {...props}
    />
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-11 w-full rounded-sm border border-border bg-surface-2 px-3 text-text placeholder:text-muted ${className}`}
      {...props}
    />
  );
}

export type StatusVariant = 'online' | 'offline' | 'warn' | 'muted' | 'accent';

export type StatusDotProps = {
  status?: StatusVariant;
  pulse?: boolean;
  label?: string;
  className?: string;
};

const statusColors: Record<StatusVariant, string> = {
  online: 'bg-success',
  offline: 'bg-danger',
  warn: 'bg-warn',
  muted: 'bg-muted',
  accent: 'bg-accent',
};

export function StatusDot({
  status = 'online',
  pulse = false,
  label,
  className = '',
}: StatusDotProps) {
  return (
    <span
      role="status"
      aria-label={label}
      title={label}
      className={`relative inline-flex size-2.5 items-center justify-center shrink-0 ${className}`}
    >
      {pulse && (
        <span
          className={`absolute inline-flex size-full rounded-full opacity-75 motion-safe:animate-ping ${statusColors[status]}`}
        />
      )}
      <span className={`relative inline-flex size-2 rounded-full ${statusColors[status]}`} />
      {label && <span className="sr-only">{label}</span>}
    </span>
  );
}

export type ToastProps = HTMLAttributes<HTMLDivElement> & {
  message?: string;
};

export function Toast({ message, children, className = '', ...props }: ToastProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`pointer-events-auto flex items-center gap-2 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-xs text-text shadow-md transition-all duration-[var(--dur-fast)] ${className}`}
      {...props}
    >
      {message ?? children}
    </div>
  );
}

export * from './OtpInput';
export * from './QualityBadge';
export * from './PwaInstallPrompt';

