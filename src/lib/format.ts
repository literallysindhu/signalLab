export function fmtBer(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  if (v === 0) return '0';
  if (v < 0.001) return v.toExponential(2);
  return v.toFixed(4);
}

export function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)} %`;
}

export function fmtDb(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined) return '—';
  if (v === Infinity) return '∞ dB';
  if (!Number.isFinite(v)) return '—';
  return `${v.toFixed(digits)} dB`;
}

export function fmtMs(v: number | null | undefined): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return v < 1 ? `${(v * 1000).toFixed(0)} µs` : `${v.toFixed(2)} ms`;
}

export function fmtHz(v: number): string {
  return v >= 1000 ? `${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 2)} kHz` : `${v.toFixed(0)} Hz`;
}

export function fmtNum(v: number | null | undefined, digits = 3): string {
  if (v === null || v === undefined || !Number.isFinite(v)) return '—';
  return Number(v.toPrecision(digits)).toString();
}

export function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return iso;
  }
}

/** Parse "0, 5, 10" or "0:5:30" (start:step:stop) into numbers. Returns an error string on failure. */
export function parseNumberList(text: string): { values: number[]; error?: string } {
  const t = text.trim();
  if (!t) return { values: [], error: 'Enter at least one value.' };
  const range = t.match(/^(-?[\d.]+)\s*:\s*(-?[\d.]+)\s*:\s*(-?[\d.]+)$/);
  if (range) {
    const [start, step, stop] = range.slice(1).map(Number);
    if (!(step > 0)) return { values: [], error: 'Range step must be positive (start:step:stop).' };
    if (stop < start) return { values: [], error: 'Range stop must be ≥ start.' };
    const values: number[] = [];
    for (let v = start; v <= stop + 1e-9 && values.length <= 500; v += step) values.push(Number(v.toFixed(6)));
    return { values };
  }
  const parts = t.split(/[,\s;]+/).filter(Boolean);
  const values = parts.map(Number);
  if (values.some((v) => !Number.isFinite(v))) return { values: [], error: 'Use numbers separated by commas, or start:step:stop.' };
  return { values: Array.from(new Set(values)).sort((a, b) => a - b) };
}
