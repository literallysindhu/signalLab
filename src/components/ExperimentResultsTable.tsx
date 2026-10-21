import type { ExperimentPoint } from '../engine';
import { fmtBer, fmtDb, fmtMs } from '../lib/format';
import { StatusBadge, cx } from './ui';

/** Results table for experiment points. `highlight` marks the best configuration. */
export function ExperimentResultsTable({ points, highlight }: { points: ExperimentPoint[]; highlight?: ExperimentPoint | null }) {
  const multiRep = points.some((p) => p.pdrStd > 0 || p.berStd > 0);
  return (
    <div className="max-h-[420px] overflow-auto rounded-xl border border-line">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead className="sticky top-0 z-10 bg-slate-50 text-left text-xs uppercase tracking-wide text-ink-faint">
          <tr>
            {['Scheme', 'SNR (1 m)', 'Distance', 'Payload', 'Link Ec/N0', 'Sent', 'Delivered', 'PDR', 'BER', 'Bit errors', 'CRC fail', 'Proc. time'].map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap border-b border-line px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="font-mono tabular-nums">
          {points.map((p, i) => (
            <tr key={i} className={cx('border-b border-line last:border-0', p === highlight ? 'bg-accent-light/50' : i % 2 ? 'bg-slate-50/50' : 'bg-white')}>
              <td className="px-3 py-2 font-sans">
                <StatusBadge tone={p.modulation === 'ASK' ? 'ask' : 'fsk'}>{p.modulation}</StatusBadge>
              </td>
              <td className="px-3 py-2">{p.snrDb} dB</td>
              <td className="px-3 py-2">{p.distanceM} m</td>
              <td className="px-3 py-2">{p.payloadBytes} B</td>
              <td className="px-3 py-2">{fmtDb(p.avgLinkSnrDb)}</td>
              <td className="px-3 py-2">{p.packetsSent}</td>
              <td className="px-3 py-2">{p.packetsDelivered}</td>
              <td className="px-3 py-2">
                {p.pdr.toFixed(1)} %{multiRep && <span className="text-ink-faint"> ±{p.pdrStd.toFixed(1)}</span>}
              </td>
              <td className="px-3 py-2">{fmtBer(p.ber)}</td>
              <td className="px-3 py-2">
                {p.bitErrors}/{p.bitsCompared}
              </td>
              <td className="px-3 py-2">{p.checksumFailures + p.undecodable}</td>
              <td className="px-3 py-2">{fmtMs(p.avgProcessingMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
