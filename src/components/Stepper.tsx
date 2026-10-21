import { Check } from 'lucide-react';
import { cx } from './ui';

interface Props {
  steps: string[];
  current: number;
  /** Highest step index the user may jump to. */
  maxReachable: number;
  onSelect: (i: number) => void;
}

/** Horizontal stepper on wide screens; compact "Step x of n" with a progress bar on small screens. */
export function Stepper({ steps, current, maxReachable, onSelect }: Props) {
  const pct = ((current + 1) / steps.length) * 100;
  return (
    <nav aria-label="Demo progress">
      <div className="md:hidden">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium text-ink">
            Step {current + 1} of {steps.length}
          </span>
          <span className="text-ink-soft">{steps[current]}</span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${pct}%` }} />
        </div>
      </div>
      <ol className="hidden items-center md:flex">
        {steps.map((s, i) => {
          const done = i < current;
          const active = i === current;
          const reachable = i <= maxReachable;
          return (
            <li key={s} className={cx('flex items-center', i < steps.length - 1 && 'flex-1')}>
              <button
                type="button"
                disabled={!reachable}
                onClick={() => onSelect(i)}
                aria-current={active ? 'step' : undefined}
                className="group flex items-center gap-2 rounded-lg px-1 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-not-allowed"
              >
                <span
                  className={cx(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                    active && 'bg-accent text-white ring-4 ring-accent-light',
                    done && 'bg-accent-light text-accent',
                    !active && !done && 'border border-line bg-white text-ink-faint',
                  )}
                >
                  {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : i + 1}
                </span>
                <span
                  className={cx(
                    'whitespace-nowrap text-xs font-medium uppercase tracking-wide',
                    active ? 'text-ink' : reachable ? 'text-ink-soft group-hover:text-ink' : 'text-slate-400',
                  )}
                >
                  {s}
                </span>
              </button>
              {i < steps.length - 1 && <span className={cx('mx-2 h-px flex-1', i < current ? 'bg-accent-mid' : 'bg-line')} aria-hidden />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
