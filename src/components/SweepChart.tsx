import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  ErrorBar,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import type { ExperimentPoint, Modulation } from '../engine';
import { COLORS } from './SignalChart';
import { cx } from './ui';

type XKey = 'snrDb' | 'distanceM' | 'payloadBytes';
type YKey = 'ber' | 'pdr' | 'packetLoss' | 'avgProcessingMs';

const yInfo: Record<YKey, { label: string; std?: 'berStd' | 'pdrStd' }> = {
  ber: { label: 'Bit error rate', std: 'berStd' },
  pdr: { label: 'Packet delivery ratio (%)', std: 'pdrStd' },
  packetLoss: { label: 'Packet loss (%)', std: 'pdrStd' },
  avgProcessingMs: { label: 'Processing time (ms)' },
};
const xInfo: Record<XKey, string> = { snrDb: 'SNR at 1 m (dB)', distanceM: 'Distance (m)', payloadBytes: 'Payload size (bytes)' };

export function SeriesPicker({ available, shown, onChange }: { available: Modulation[]; shown: Modulation[]; onChange: (m: Modulation[]) => void }) {
  return (
    <div className="flex gap-2" role="group" aria-label="Series to show">
      {available.map((m) => {
        const on = shown.includes(m);
        return (
          <button
            key={m}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(on ? shown.filter((x) => x !== m) : [...shown, m])}
            className={cx(
              'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
              on ? (m === 'ASK' ? 'border-ask bg-ask-light text-ask' : 'border-fsk bg-fsk-light text-fsk') : 'border-line bg-white text-ink-faint',
            )}
          >
            <span className={cx('h-2 w-2 rounded-full', on ? (m === 'ASK' ? 'bg-ask' : 'bg-fsk') : 'bg-slate-300')} />
            {m}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Line chart of a metric against one swept variable, one line per modulation.
 * Points are averaged over repetitions; error bars show ±1 standard deviation
 * across repetitions when more than one was run.
 */
export function SweepChart({
  points,
  x,
  y,
  height = 260,
  logY: logInit = false,
  showLogToggle = y === 'ber',
}: {
  points: ExperimentPoint[];
  x: XKey;
  y: YKey;
  height?: number;
  logY?: boolean;
  showLogToggle?: boolean;
}) {
  const available = useMemo(() => Array.from(new Set(points.map((p) => p.modulation))) as Modulation[], [points]);
  const [shown, setShown] = useState<Modulation[]>(available);
  const [logY, setLogY] = useState(logInit);
  const std = yInfo[y].std;

  const { rows, zeros } = useMemo(() => {
    const map = new Map<number, Record<string, number | null | [number, number]>>();
    let zeros = 0;
    for (const p of points) {
      const xv = p[x];
      const row = map.get(xv) ?? { x: xv };
      let v: number | null = p[y];
      if (logY && v === 0) {
        v = null; // log scale cannot show zero; reported below the chart
        zeros++;
      }
      row[p.modulation] = v;
      if (std && !logY) row[`${p.modulation}_err`] = p[std];
      map.set(xv, row);
    }
    return { rows: Array.from(map.values()).sort((a, b) => (a.x as number) - (b.x as number)), zeros };
  }, [points, x, y, logY, std]);

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <SeriesPicker available={available} shown={shown} onChange={setShown} />
        {showLogToggle && (
          <label className="flex items-center gap-2 text-xs text-ink-soft">
            <input type="checkbox" checked={logY} onChange={(e) => setLogY(e.target.checked)} className="accent-teal-700" />
            Log scale
          </label>
        )}
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 18, left: 8 }}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
          <XAxis dataKey="x" type="number" domain={['dataMin', 'dataMax']} ticks={rows.map((r) => r.x as number)} interval={0} stroke={COLORS.axis} fontSize={11} tickLine={false} label={{ value: xInfo[x], position: 'insideBottom', offset: -10, fontSize: 11, fill: COLORS.axis }} />
          <YAxis
            stroke={COLORS.axis}
            fontSize={11}
            tickLine={false}
            width={60}
            scale={logY ? 'log' : 'auto'}
            domain={logY ? ['auto', 'auto'] : y === 'pdr' || y === 'packetLoss' ? [0, 100] : [0, 'auto']}
            allowDataOverflow={logY}
            tickFormatter={(v: number) => (logY || (y === 'ber' && v > 0 && v < 0.01) ? v.toExponential(0) : String(Number(v.toPrecision(3))))}
            label={{ value: yInfo[y].label, angle: -90, position: 'insideLeft', fontSize: 11, fill: COLORS.axis, dy: 50 }}
          />
          <Tooltip
            formatter={(v: number | [number, number], name: string) => [typeof v === 'number' ? (y === 'ber' ? v.toExponential(3) : v.toFixed(3)) : '', name]}
            labelFormatter={(l: number) => `${xInfo[x]}: ${l}`}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Legend verticalAlign="top" height={24} iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          {available
            .filter((m) => shown.includes(m))
            .map((m) => (
              <Line key={m} dataKey={m} name={m} stroke={COLORS[m]} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} connectNulls={false}>
                {std && !logY && <ErrorBar dataKey={`${m}_err`} width={4} strokeWidth={1} stroke={COLORS[m]} />}
              </Line>
            ))}
        </LineChart>
      </ResponsiveContainer>
      {logY && zeros > 0 && (
        <p className="mt-1 text-xs text-ink-faint">
          {zeros} point{zeros === 1 ? '' : 's'} with zero observed bit errors cannot be drawn on a log scale (true BER is below 1 / bits tested).
        </p>
      )}
    </div>
  );
}

/** Scatter of energy spent per delivered packet versus PDR (energy model). */
export function EnergyChart({ points, height = 260 }: { points: ExperimentPoint[]; height?: number }) {
  const available = useMemo(() => Array.from(new Set(points.map((p) => p.modulation))) as Modulation[], [points]);
  const [shown, setShown] = useState<Modulation[]>(available);
  const data = (m: Modulation) =>
    points.filter((p) => p.modulation === m && p.energyPerDelivered !== null).map((p) => ({ pdr: p.pdr, e: p.energyPerDelivered as number }));
  const excluded = points.filter((p) => p.energyPerDelivered === null).length;
  return (
    <div>
      <div className="mb-2">
        <SeriesPicker available={available} shown={shown} onChange={setShown} />
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <ScatterChart margin={{ top: 8, right: 16, bottom: 18, left: 8 }}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" />
          <XAxis dataKey="pdr" type="number" domain={[0, 100]} name="PDR" unit=" %" stroke={COLORS.axis} fontSize={11} label={{ value: 'Packet delivery ratio (%)', position: 'insideBottom', offset: -10, fontSize: 11, fill: COLORS.axis }} />
          <YAxis dataKey="e" type="number" name="Energy" stroke={COLORS.axis} fontSize={11} width={64} tickFormatter={(v: number) => v.toExponential(1)} label={{ value: 'Energy / delivered pkt', angle: -90, position: 'insideLeft', fontSize: 11, fill: COLORS.axis, dy: 60 }} />
          <ZAxis range={[50, 50]} />
          <Tooltip formatter={(v: number, n: string) => [n === 'Energy' ? v.toExponential(3) : v.toFixed(1), n]} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Legend verticalAlign="top" height={24} iconSize={10} wrapperStyle={{ fontSize: 12 }} />
          {available.filter((m) => shown.includes(m)).map((m) => (
            <Scatter key={m} name={m} data={data(m)} fill={COLORS[m]} isAnimationActive={false} />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-ink-faint">
        Energy model: radiated energy Σs²/fs per packet (normalised units), divided by delivered packets. Circuit power is not modelled.
        {excluded > 0 && ` ${excluded} point(s) with no delivered packets are omitted.`}
      </p>
    </div>
  );
}
