import { useId } from 'react';
import { InfoTip } from './ui';

interface Props {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  format?: (v: number) => string;
  tooltip?: string;
  hint?: string;
  large?: boolean;
}

/** Labelled range slider with a live numeric readout and units. */
export function ParameterSlider({ label, value, min, max, step, unit, onChange, format, tooltip, hint, large }: Props) {
  const id = useId();
  const shown = format ? format(value) : `${value}${unit ? ` ${unit}` : ''}`;
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <label htmlFor={id} className={large ? 'text-[15px] font-medium text-ink' : 'text-sm font-medium text-ink'}>
          {label} {tooltip && <InfoTip text={tooltip} />}
        </label>
        <output htmlFor={id} className="font-mono text-sm font-semibold tabular-nums text-ink">
          {shown}
        </output>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="slider w-full"
        style={{ ['--pct' as string]: `${pct}%` }}
        aria-valuetext={shown}
      />
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
