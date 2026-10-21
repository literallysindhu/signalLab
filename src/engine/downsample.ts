export type WaveRow = { t: number } & Record<string, number>;

/**
 * Build chart rows for one or more equally-sampled signals over [start, end).
 * When the window has more samples than maxPoints, each bucket emits two rows
 * holding the per-series minimum and maximum, which preserves the visible
 * envelope while keeping the chart light. Time `t` is in milliseconds.
 */
export function buildWaveRows(
  signals: Record<string, Float64Array | undefined>,
  sampleRate: number,
  start: number,
  end: number,
  maxPoints = 1200,
): WaveRow[] {
  const keys = Object.keys(signals).filter((k) => signals[k]);
  if (!keys.length) return [];
  const len = Math.min(...keys.map((k) => signals[k]!.length));
  const s = Math.max(0, Math.floor(start));
  const e = Math.min(len, Math.floor(end));
  if (e <= s) return [];
  const toMs = 1000 / sampleRate;
  const count = e - s;
  const rows: WaveRow[] = [];

  if (count <= maxPoints) {
    for (let n = s; n < e; n++) {
      const row = { t: n * toMs } as WaveRow;
      for (const k of keys) row[k] = signals[k]![n];
      rows.push(row);
    }
    return rows;
  }
  const buckets = Math.floor(maxPoints / 2);
  const size = count / buckets;
  for (let b = 0; b < buckets; b++) {
    const from = s + Math.floor(b * size);
    const to = Math.min(e, s + Math.floor((b + 1) * size));
    const lo = { t: from * toMs } as WaveRow;
    const hi = { t: (from + (to - from) / 2) * toMs } as WaveRow;
    for (const k of keys) {
      const arr = signals[k]!;
      let mn = Infinity;
      let mx = -Infinity;
      for (let n = from; n < to; n++) {
        if (arr[n] < mn) mn = arr[n];
        if (arr[n] > mx) mx = arr[n];
      }
      lo[k] = mn;
      hi[k] = mx;
    }
    rows.push(lo, hi);
  }
  return rows;
}

/** Rows for a digital step plot of bits (value held over each bit period). */
export function buildBitRows(
  series: Record<string, ArrayLike<number>>,
  bitRate: number,
  startBit: number,
  endBit: number,
): WaveRow[] {
  const keys = Object.keys(series);
  const rows: WaveRow[] = [];
  const tb = 1000 / bitRate;
  for (let k = startBit; k <= endBit; k++) {
    const row = { t: k * tb } as WaveRow;
    // repeat the last bit at the closing edge so the final step is drawn
    const idx = Math.min(k, endBit - 1);
    for (const key of keys) row[key] = series[key][idx] ?? 0;
    rows.push(row);
  }
  return rows;
}
