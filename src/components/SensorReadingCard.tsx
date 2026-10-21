import { Droplets, Hash, Radio, Thermometer } from 'lucide-react';
import { formatNodeId, type SensorReading } from '../engine';
import { cx } from './ui';

/** Clean display of one sensor reading. `muted` greys it out (e.g. for unverified data). */
export function SensorReadingCard({ reading, title = 'Sensor reading', muted, compact }: { reading: SensorReading; title?: string; muted?: boolean; compact?: boolean }) {
  const items = [
    { icon: Thermometer, label: 'Temperature', value: `${reading.temperatureC.toFixed(2)} °C` },
    { icon: Droplets, label: 'Humidity', value: `${reading.humidityPct.toFixed(2)} %` },
    { icon: Radio, label: 'Sensor ID', value: formatNodeId(reading.nodeId) },
    { icon: Hash, label: 'Packet', value: String(reading.sequence).padStart(3, '0') },
  ];
  return (
    <div className={cx('rounded-2xl border border-line bg-white', compact ? 'p-4' : 'p-5', muted && 'opacity-60')}>
      <div className="mb-3 text-xs font-medium uppercase tracking-wide text-ink-faint">{title}</div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-4">
        {items.map(({ icon: Icon, label, value }) => (
          <div key={label} className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-ink-soft">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <div>
              <dt className="text-xs text-ink-faint">{label}</dt>
              <dd className={cx('font-mono font-semibold tabular-nums text-ink', compact ? 'text-base' : 'text-lg')}>{value}</dd>
            </div>
          </div>
        ))}
      </dl>
    </div>
  );
}
