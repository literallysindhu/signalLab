import { AlertTriangle, CheckCircle2, ChevronDown, Info, XCircle } from 'lucide-react';
import { useId, useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { useSettings } from '../lib/settings';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');
export { cx };

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { icon?: ReactNode; size?: 'md' | 'lg' };

const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-50';
const btnSize = { md: 'h-10 px-4 text-sm', lg: 'h-12 px-6 text-[15px]' };

export function PrimaryButton({ icon, size = 'md', className, children, ...rest }: BtnProps) {
  return (
    <button type="button" className={cx(btnBase, btnSize[size], 'bg-accent text-white hover:bg-teal-800', className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function SecondaryButton({ icon, size = 'md', className, children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      className={cx(btnBase, btnSize[size], 'border border-line bg-white text-ink hover:bg-slate-50', className)}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}

export function GhostButton({ icon, className, children, ...rest }: BtnProps) {
  return (
    <button type="button" className={cx(btnBase, 'h-9 px-3 text-sm text-ink-soft hover:bg-slate-100 hover:text-ink', className)} {...rest}>
      {icon}
      {children}
    </button>
  );
}

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx('rounded-2xl border border-line bg-white p-6 shadow-card', className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-ink sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-ink-soft">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

type Tone = 'success' | 'warning' | 'error' | 'info' | 'neutral' | 'ask' | 'fsk';
const toneCls: Record<Tone, string> = {
  success: 'bg-ok-light text-ok',
  warning: 'bg-warn-light text-warn',
  error: 'bg-bad-light text-bad',
  info: 'bg-accent-light text-accent',
  neutral: 'bg-slate-100 text-ink-soft',
  ask: 'bg-ask-light text-ask',
  fsk: 'bg-fsk-light text-fsk',
};

export function StatusBadge({ tone = 'neutral', children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium', toneCls[tone], className)}>{children}</span>
  );
}

export function Banner({ tone, title, children }: { tone: 'success' | 'warning' | 'error' | 'info'; title: ReactNode; children?: ReactNode }) {
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? XCircle : tone === 'warning' ? AlertTriangle : Info;
  const ring = { success: 'border-green-200 bg-ok-light/60', error: 'border-red-200 bg-bad-light/60', warning: 'border-amber-200 bg-warn-light/60', info: 'border-teal-200 bg-accent-light/50' }[tone];
  const ic = { success: 'text-ok', error: 'text-bad', warning: 'text-warn', info: 'text-accent' }[tone];
  return (
    <div role="status" className={cx('flex gap-3 rounded-xl border px-4 py-3', ring)}>
      <Icon className={cx('mt-0.5 h-5 w-5 shrink-0', ic)} aria-hidden />
      <div className="min-w-0">
        <div className="font-medium text-ink">{title}</div>
        {children && <div className="mt-0.5 text-sm leading-relaxed text-ink-soft">{children}</div>}
      </div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  hint,
  tone,
  large,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: 'ask' | 'fsk';
  large?: boolean;
}) {
  return (
    <div className="rounded-xl border border-line bg-white px-4 py-3">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-ink-faint">
        {tone && <span className={cx('h-2 w-2 rounded-full', tone === 'ask' ? 'bg-ask' : 'bg-fsk')} aria-hidden />}
        {label}
      </div>
      <div className={cx('mt-1 font-mono font-semibold tabular-nums text-ink', large ? 'text-3xl' : 'text-xl')}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-ink-faint">{hint}</div>}
    </div>
  );
}

export function ExpandableSection({
  title,
  children,
  defaultOpen = false,
  icon,
  className,
}: {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  icon?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const id = useId();
  return (
    <div className={cx('rounded-xl border border-line bg-white', className)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-xl px-4 py-3 text-left text-sm font-medium text-ink hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
      >
        {icon}
        <span className="flex-1">{title}</span>
        <ChevronDown className={cx('h-4 w-4 text-ink-faint transition-transform', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div id={id} className="border-t border-line px-4 py-4 text-sm leading-relaxed text-ink-soft">
          {children}
        </div>
      )}
    </div>
  );
}

export function EmptyState({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 px-6 py-10 text-center">
      {icon && <div className="mb-3 text-slate-400">{icon}</div>}
      <div className="font-medium text-ink">{title}</div>
      {children && <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-soft">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/** Small "i" icon with an accessible tooltip (hover or keyboard focus). */
export function InfoTip({ text }: { text: string }) {
  const id = useId();
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        aria-describedby={id}
        className="rounded-full text-ink-faint hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
        aria-label="More information"
      >
        <Info className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span
        id={id}
        role="tooltip"
        className="pointer-events-none invisible absolute bottom-full left-1/2 z-30 mb-2 w-60 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs font-normal normal-case leading-relaxed tracking-normal text-white opacity-0 shadow-lg transition-opacity group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100"
      >
        {text}
      </span>
    </span>
  );
}

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium text-ink">
          {label}
        </label>
        {description && <p className="text-xs leading-relaxed text-ink-faint">{description}</p>}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={cx(
          'relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          checked ? 'bg-accent' : 'bg-slate-300',
        )}
      >
        <span className={cx('inline-block h-5 w-5 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-5' : 'translate-x-0.5')} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { value: T; label: ReactNode }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-slate-50 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
            value === o.value ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Technical explanation shown only when "Technical notes" is switched on. */
export function TechNote({ children }: { children: ReactNode }) {
  const { showTechnical } = useSettings();
  if (!showTechnical) return null;
  return (
    <div className="rounded-lg border-l-2 border-accent-mid bg-accent-light/40 px-3 py-2 text-xs leading-relaxed text-ink-soft">
      <span className="font-semibold text-accent">Technical note · </span>
      {children}
    </div>
  );
}

export function ProgressBar({ value, label }: { value: number; label?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuenow={Math.round(pct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label ?? 'Progress'}
      >
        <div className="h-full rounded-full bg-accent transition-[width] duration-200" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children, htmlFor }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? <p className="mt-1 text-xs text-bad">{error}</p> : hint ? <p className="mt-1 text-xs text-ink-faint">{hint}</p> : null}
    </div>
  );
}

export const inputCls =
  'h-10 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink placeholder:text-slate-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 aria-[invalid=true]:border-bad';
