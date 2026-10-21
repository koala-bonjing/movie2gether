import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes } from 'react';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'secondary' | 'danger';
  size?: 'sm' | 'md' | 'lg';
};

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  const look =
    variant === 'primary'
      ? 'bg-primary-container text-on-primary-container font-semibold hover:bg-primary shadow-sm active:scale-[0.98]'
      : variant === 'secondary'
        ? 'border border-outline/40 bg-surface-container text-text hover:bg-surface-variant active:scale-[0.98]'
        : variant === 'danger'
          ? 'bg-error text-surface-container-lowest font-semibold hover:opacity-90 active:scale-[0.98]'
          : 'text-text hover:bg-surface-container active:scale-[0.98]';

  const sizing =
    size === 'sm'
      ? 'min-h-9 px-3 text-xs'
      : size === 'lg'
        ? 'min-h-12 px-6 text-base font-semibold'
        : 'min-h-11 px-5 font-medium';

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center gap-2 rounded-full transition cursor-pointer select-none disabled:pointer-events-none disabled:opacity-50 ${sizing} ${look} ${className}`}
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
      className={`grid size-11 shrink-0 place-items-center rounded-full text-text transition hover:bg-white/10 active:scale-95 cursor-pointer select-none ${className}`}
      {...props}
    />
  );
}

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`min-h-11 w-full rounded-lg border border-outline/40 bg-surface-container-low px-3.5 text-text placeholder:text-muted focus:border-primary-container focus:outline-hidden transition ${className}`}
      {...props}
    />
  );
}

export function Avatar({
  name,
  size = 'md',
  status,
  className = '',
  ...props
}: {
  name: string;
  size?: 'sm' | 'md' | 'lg';
  status?: StatusVariant;
  className?: string;
} & HTMLAttributes<HTMLDivElement>) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  const sizeMap = {
    sm: 'size-7 text-xs',
    md: 'size-9 text-sm',
    lg: 'size-11 text-base',
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 ${className}`}
      {...props}
    >
      <div
        className={`grid place-items-center rounded-full bg-primary-container/20 border border-primary-container/40 font-bold text-primary select-none ${sizeMap[size]}`}
      >
        {initial}
      </div>
      {status && (
        <span className="absolute -bottom-0.5 -right-0.5">
          <StatusDot status={status} />
        </span>
      )}
    </div>
  );
}

export function Badge({
  children,
  variant = 'default',
  className = '',
}: {
  children: React.ReactNode;
  variant?: 'default' | 'accent' | 'success' | 'warn' | 'danger';
  className?: string;
}) {
  const variantStyles = {
    default: 'bg-surface-container border-outline/40 text-muted',
    accent: 'bg-primary-container/20 border-primary-container/40 text-primary',
    success: 'bg-tertiary/15 border-tertiary/30 text-tertiary',
    warn: 'bg-warn/15 border-warn/30 text-warn',
    danger: 'bg-error/15 border-error/30 text-error',
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium select-none ${variantStyles[variant]} ${className}`}
    >
      {children}
    </span>
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
  online: 'bg-tertiary',
  offline: 'bg-error',
  warn: 'bg-warn',
  muted: 'bg-muted',
  accent: 'bg-primary',
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
      className={`pointer-events-auto flex items-center gap-2 rounded-xl border border-outline/40 bg-surface-container-high px-3.5 py-2 text-xs font-medium text-text shadow-xl transition-all duration-[var(--dur-fast)] ${className}`}
      {...props}
    >
      {message ?? children}
    </div>
  );
}

export * from './OtpInput';
export * from './QualityBadge';
export * from './PwaInstallPrompt';
export * from './ErrorBoundary';

