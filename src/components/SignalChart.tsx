import { RotateCcw } from 'lucide-react';
import { useMemo, useState } from 'react';
import {
  Brush,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { buildBitRows, buildWaveRows, magnitudeSpectrum } from '../engine';
import { GhostButton } from './ui';

export const COLORS = {
  ASK: '#2563EB',
  FSK: '#7C3AED',
  rx: '#64748B',
  bits: '#172033',
  recovered: '#0F766E',
  error: '#DC2626',
  grid: '#E2E8F0',
  axis: '#64748B',
};

const axisProps = { stroke: COLORS.axis, fontSize: 11, tickLine: false } as const;
const fmtT = (v: number) => (Math.abs(v) < 10 ? v.toFixed(1) : v.toFixed(0));

export interface WaveSeries {
  key: string;
  label: string;
  color: string;
  data: Float64Array | undefined;
  width?: number;
  opacity?: number;
}

interface WaveformChartProps {
  series: WaveSeries[];
  sampleRate: number;
  bitRate: number;
  startBit: number;
  endBit: number;
  height?: number;
  /** Bit indices to highlight in red (decision errors). */
  errorBits?: number[];
  /** Bit index to highlight (inspected bit). */
  selectedBit?: number | null;
  zoomable?: boolean;
  yLabel?: string;
  /** Number of bits revealed so far (for the transmission animation). */
  revealBits?: number;
  ariaLabel: string;
}

/** Time-domain plot of actual simulated samples, with optional bit boundaries, error shading and zoom. */
export function WaveformChart({
  series,
  sampleRate,
  bitRate,
  startBit,
  endBit,
  height = 240,
  errorBits,
  selectedBit,
  zoomable,
  yLabel = 'Amplitude',
  revealBits,
  ariaLabel,
}: WaveformChartProps) {
  const spb = sampleRate / bitRate;
  const [zoomKey, setZoomKey] = useState(0);
  const lastBit = revealBits !== undefined ? Math.min(endBit, startBit + revealBits) : endBit;

  const rows = useMemo(() => {
    const sig: Record<string, Float64Array | undefined> = {};
    series.forEach((s) => (sig[s.key] = s.data));
    const all = buildWaveRows(sig, sampleRate, startBit * spb, endBit * spb, 1400);
    if (lastBit >= endBit) return all;
    const cut = (lastBit * 1000) / bitRate;
    // hide samples that have not been "transmitted" yet, keeping the axis fixed
    return all.map((r) => (r.t <= cut ? r : { t: r.t }));
  }, [series, sampleRate, spb, startBit, endBit, lastBit, bitRate]);

  const tb = 1000 / bitRate;
  const nBits = endBit - startBit;
  const boundaries = nBits <= 40 ? Array.from({ length: nBits + 1 }, (_, i) => (startBit + i) * tb) : [];
  const errs = (errorBits ?? []).filter((b) => b >= startBit && b < endBit);

  return (
    <div role="img" aria-label={ariaLabel}>
      {zoomable && (
        <div className="mb-1 flex justify-end">
          <GhostButton icon={<RotateCcw className="h-3.5 w-3.5" />} onClick={() => setZoomKey((k) => k + 1)}>
            Reset zoom
          </GhostButton>
        </div>
      )}
      <ResponsiveContainer width="100%" height={height}>
        <LineChart key={zoomKey} data={rows} margin={{ top: 8, right: 12, bottom: zoomable ? 4 : 18, left: 4 }}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="t"
            type="number"
            domain={[startBit * tb, endBit * tb]}
            allowDataOverflow
            tickFormatter={fmtT}
            {...axisProps}
            label={{ value: 'Time (ms)', position: 'insideBottom', offset: -10, fontSize: 11, fill: COLORS.axis }}
          />
          <YAxis {...axisProps} width={48} tickFormatter={(v: number) => v.toFixed(2)} label={{ value: yLabel, angle: -90, position: 'insideLeft', fontSize: 11, fill: COLORS.axis, dy: 30 }} />
          {errs.map((b) => (
            <ReferenceArea key={`e${b}`} x1={b * tb} x2={(b + 1) * tb} fill={COLORS.error} fillOpacity={0.1} strokeOpacity={0} ifOverflow="hidden" />
          ))}
          {selectedBit !== null && selectedBit !== undefined && selectedBit >= startBit && selectedBit < endBit && (
            <ReferenceArea x1={selectedBit * tb} x2={(selectedBit + 1) * tb} fill="#F59E0B" fillOpacity={0.15} strokeOpacity={0} />
          )}
          {boundaries.map((x) => (
            <ReferenceLine key={x} x={x} stroke="#CBD5E1" strokeDasharray="2 4" ifOverflow="hidden" />
          ))}
          <Tooltip
            formatter={(v: number, name: string) => [v.toFixed(4), name]}
            labelFormatter={(t: number) => `t = ${t.toFixed(3)} ms · bit ${Math.floor(t / tb)}`}
            contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: COLORS.grid }}
          />
          {series.map((s) => (
            <Line
              key={s.key}
              dataKey={s.key}
              name={s.label}
              stroke={s.color}
              strokeWidth={s.width ?? 1.4}
              strokeOpacity={s.opacity ?? 1}
              dot={false}
              isAnimationActive={false}
              connectNulls={false}
            />
          ))}
          {zoomable && <Brush dataKey="t" height={22} stroke="#94A3B8" travellerWidth={8} tickFormatter={fmtT} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Digital step plot comparing transmitted and recovered bits. */
export function BitChart({
  tx,
  rx,
  bitRate,
  startBit,
  endBit,
  height = 140,
  ariaLabel,
}: {
  tx: Uint8Array;
  rx?: Uint8Array;
  bitRate: number;
  startBit: number;
  endBit: number;
  height?: number;
  ariaLabel: string;
}) {
  const rows = useMemo(() => {
    const series: Record<string, ArrayLike<number>> = { tx };
    if (rx) series.rx = Array.from(rx, (b) => b * 0.9 + 0.05); // slight offset so both lines stay visible
    return buildBitRows(series, bitRate, startBit, endBit);
  }, [tx, rx, bitRate, startBit, endBit]);
  const tb = 1000 / bitRate;
  const errs: number[] = [];
  if (rx) for (let i = startBit; i < endBit; i++) if (tx[i] !== rx[i]) errs.push(i);
  return (
    <div role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 8, right: 12, bottom: 18, left: 4 }}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="t" type="number" domain={[startBit * tb, endBit * tb]} tickFormatter={fmtT} {...axisProps} label={{ value: 'Time (ms)', position: 'insideBottom', offset: -10, fontSize: 11, fill: COLORS.axis }} />
          <YAxis domain={[-0.2, 1.2]} ticks={[0, 1]} {...axisProps} width={48} label={{ value: 'Bit', angle: -90, position: 'insideLeft', fontSize: 11, fill: COLORS.axis, dy: 10 }} />
          {errs.map((b) => (
            <ReferenceArea key={b} x1={b * tb} x2={(b + 1) * tb} fill={COLORS.error} fillOpacity={0.15} strokeOpacity={0} />
          ))}
          <Tooltip
            formatter={(v: number, name: string) => [Math.round(v), name]}
            labelFormatter={(t: number) => `bit ${Math.min(endBit - 1, Math.floor(t / tb))}`}
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
          />
          <Line type="stepAfter" dataKey="tx" name="Transmitted" stroke={COLORS.bits} strokeWidth={1.6} dot={false} isAnimationActive={false} />
          {rx && <Line type="stepAfter" dataKey="rx" name="Recovered" stroke={COLORS.recovered} strokeWidth={1.6} strokeDasharray="5 3" dot={false} isAnimationActive={false} />}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Single-sided magnitude spectrum (Hann window, amplitude-normalised, dB). */
export function SpectrumChart({
  signal,
  sampleRate,
  markers,
  color,
  height = 220,
}: {
  signal: Float64Array;
  sampleRate: number;
  markers: { hz: number; label: string }[];
  color: string;
  height?: number;
}) {
  const { rows, nfft } = useMemo(() => {
    const s = magnitudeSpectrum(signal, sampleRate);
    const out: { f: number; db: number }[] = [];
    const step = Math.max(1, Math.floor(s.freqHz.length / 1200));
    for (let k = 0; k < s.freqHz.length; k += step) {
      // keep the peak in each decimation bucket
      let best = k;
      for (let j = k; j < Math.min(k + step, s.freqHz.length); j++) if (s.db[j] > s.db[best]) best = j;
      out.push({ f: s.freqHz[best] / 1000, db: s.db[best] });
    }
    return { rows: out, nfft: s.nfft };
  }, [signal, sampleRate]);
  return (
    <div role="img" aria-label="Magnitude spectrum of the selected signal">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={rows} margin={{ top: 16, right: 16, bottom: 18, left: 4 }}>
          <CartesianGrid stroke={COLORS.grid} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="f" type="number" domain={[0, sampleRate / 2000]} tickFormatter={(v: number) => v.toFixed(0)} {...axisProps} label={{ value: 'Frequency (kHz)', position: 'insideBottom', offset: -10, fontSize: 11, fill: COLORS.axis }} />
          <YAxis domain={[-80, 'auto']} allowDataOverflow {...axisProps} width={48} label={{ value: 'dB', angle: -90, position: 'insideLeft', fontSize: 11, fill: COLORS.axis }} />
          {markers.map((m) => (
            <ReferenceLine key={m.label} x={m.hz / 1000} stroke="#F59E0B" strokeDasharray="4 3" label={{ value: m.label, position: 'top', fontSize: 11, fill: '#B45309' }} />
          ))}
          <Tooltip formatter={(v: number) => [`${v.toFixed(1)} dB`, 'Magnitude']} labelFormatter={(f: number) => `${(f * 1000).toFixed(0)} Hz`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
          <Line dataKey="db" stroke={color} strokeWidth={1.2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
      <p className="mt-1 text-xs text-ink-faint">
        {nfft}-point FFT, Hann window. Amplitude scaled by 2/Σw so a pure tone of amplitude A peaks near 20·log₁₀(A) dB.
      </p>
    </div>
  );
}

/** Tiny inline waveform drawn directly from samples (no axes). */
export function MiniWave({ data, color, height = 56, ariaLabel }: { data: Float64Array; color: string; height?: number; ariaLabel: string }) {
  const path = useMemo(() => {
    if (!data.length) return '';
    const W = 400;
    const step = Math.max(1, Math.floor(data.length / W));
    let max = 1e-9;
    for (let i = 0; i < data.length; i++) max = Math.max(max, Math.abs(data[i]));
    let d = '';
    for (let i = 0, x = 0; i < data.length; i += step, x++) {
      const px = (i / (data.length - 1)) * W;
      const py = 50 - (data[i] / max) * 44;
      d += `${x === 0 ? 'M' : 'L'}${px.toFixed(1)},${py.toFixed(1)}`;
    }
    return d;
  }, [data]);
  return (
    <svg viewBox="0 0 400 100" preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label={ariaLabel}>
      <line x1="0" y1="50" x2="400" y2="50" stroke="#E2E8F0" strokeWidth="1" />
      <path d={path} fill="none" stroke={color} strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
