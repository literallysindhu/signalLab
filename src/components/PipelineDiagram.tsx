import { ArrowRight, Binary, CheckCircle2, Cpu, Radio, RadioReceiver, Thermometer, Waves } from 'lucide-react';
import { Fragment } from 'react';
import { cx } from './ui';

const STAGES = [
  { icon: Thermometer, label: 'Sensor data', detail: 'Temperature, humidity, ID' },
  { icon: Binary, label: 'Encode', detail: 'Packet → bytes → bits + CRC' },
  { icon: Radio, label: 'Modulate', detail: 'ASK or FSK carrier' },
  { icon: Waves, label: 'Channel', detail: 'Path loss, noise, fading' },
  { icon: RadioReceiver, label: 'Demodulate', detail: 'Energy / tone detector' },
  { icon: Cpu, label: 'Decode', detail: 'Bits → bytes, check CRC' },
  { icon: CheckCircle2, label: 'Metrics', detail: 'BER, PDR, loss' },
];

/** Compact block diagram of the full transmission pipeline. */
export function PipelineDiagram({ compact, detailed }: { compact?: boolean; detailed?: boolean }) {
  const stages = compact ? STAGES.filter((_, i) => [0, 2, 3, 4, 6].includes(i)) : STAGES;
  return (
    <div className="overflow-x-auto" role="img" aria-label={`Pipeline: ${stages.map((s) => s.label).join(', then ')}`}>
      <ol className="flex min-w-max items-center gap-1.5">
        {stages.map(({ icon: Icon, label, detail }, i) => (
          <Fragment key={label}>
            <li className={cx('flex flex-col items-center rounded-xl border border-line bg-white text-center', detailed ? 'w-[118px] px-2 py-3' : 'px-3 py-2')}>
              <span
                className={cx(
                  'flex h-8 w-8 items-center justify-center rounded-lg',
                  label === 'Channel' ? 'bg-warn-light text-warn' : label === 'Modulate' ? 'bg-fsk-light text-fsk' : 'bg-accent-light text-accent',
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className="mt-1.5 text-xs font-medium text-ink">{label}</span>
              {detailed && <span className="mt-0.5 text-[11px] leading-snug text-ink-faint">{detail}</span>}
            </li>
            {i < stages.length - 1 && <ArrowRight className="h-4 w-4 shrink-0 text-slate-300" aria-hidden />}
          </Fragment>
        ))}
      </ol>
    </div>
  );
}
