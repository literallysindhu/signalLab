import { Check } from 'lucide-react';
import type { ReactNode } from 'react';
import { MiniWave } from './SignalChart';
import { cx } from './ui';

interface Props {
  name: string;
  fullName: string;
  description: string;
  icon: ReactNode;
  preview: Float64Array;
  previewBits: string;
  color: 'ask' | 'fsk';
  selected: boolean;
  onSelect: () => void;
}

/** Large selectable card with a genuine waveform preview from the modulator. */
export function ModulationCard({ name, fullName, description, icon, preview, previewBits, color, selected, onSelect }: Props) {
  const hex = color === 'ask' ? '#2563EB' : '#7C3AED';
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cx(
        'group flex w-full flex-col rounded-2xl border-2 bg-white p-5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        selected ? (color === 'ask' ? 'border-ask' : 'border-fsk') : 'border-line hover:border-slate-300',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cx('flex h-10 w-10 items-center justify-center rounded-xl', color === 'ask' ? 'bg-ask-light text-ask' : 'bg-fsk-light text-fsk')}>{icon}</span>
          <div>
            <div className="text-lg font-semibold text-ink">{name}</div>
            <div className="text-sm text-ink-soft">{fullName}</div>
          </div>
        </div>
        <span
          className={cx(
            'flex h-6 w-6 items-center justify-center rounded-full border-2',
            selected ? (color === 'ask' ? 'border-ask bg-ask text-white' : 'border-fsk bg-fsk text-white') : 'border-slate-300',
          )}
          aria-hidden
        >
          {selected && <Check className="h-3.5 w-3.5" />}
        </span>
      </div>
      <p className="mt-3 text-[15px] leading-relaxed text-ink-soft">{description}</p>
      <div className="mt-4 rounded-xl bg-slate-50 px-3 pb-2 pt-3">
        <MiniWave data={preview} color={hex} ariaLabel={`${name} waveform preview for bits ${previewBits}`} />
        <div className="mt-1 flex justify-between font-mono text-[11px] text-ink-faint">
          {previewBits.split('').map((b, i) => (
            <span key={i} className="flex-1 text-center">
              {b}
            </span>
          ))}
        </div>
      </div>
      <span className={cx('mt-4 text-sm font-medium', selected ? (color === 'ask' ? 'text-ask' : 'text-fsk') : 'text-ink-soft group-hover:text-ink')}>
        {selected ? 'Selected' : `Select ${name}`}
      </span>
    </button>
  );
}
