/** Iterative radix-2 Cooley–Tukey FFT (in place). Length must be a power of two. */
export function fftInPlace(re: Float64Array, im: Float64Array): void {
  const n = re.length;
  if (n !== im.length || (n & (n - 1)) !== 0) throw new Error('FFT length must be a power of two.');
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const ncr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = ncr;
      }
    }
  }
}

export interface Spectrum {
  freqHz: Float64Array;
  /** Single-sided amplitude: a sine of amplitude A reads ≈ A at its frequency. */
  amplitude: Float64Array;
  /** 20·log10(amplitude), floored at −120 dB. */
  db: Float64Array;
  nfft: number;
  samplesUsed: number;
}

/**
 * Single-sided magnitude spectrum with a Hann window and zero padding to the
 * next power of two. Normalisation: |X[k]|·2 / Σw, so a pure tone of amplitude A
 * shows a peak close to A (0 dB ≙ amplitude 1.0).
 */
export function magnitudeSpectrum(signal: Float64Array, sampleRate: number, maxSamples = 65536): Spectrum {
  const used = Math.min(signal.length, maxSamples);
  if (used < 2) throw new Error('Spectrum needs at least 2 samples.');
  let nfft = 1;
  while (nfft < used) nfft <<= 1;
  const re = new Float64Array(nfft);
  const im = new Float64Array(nfft);
  let wsum = 0;
  for (let n = 0; n < used; n++) {
    const w = 0.5 - 0.5 * Math.cos((2 * Math.PI * n) / (used - 1));
    re[n] = signal[n] * w;
    wsum += w;
  }
  fftInPlace(re, im);
  const half = nfft / 2 + 1;
  const freqHz = new Float64Array(half);
  const amplitude = new Float64Array(half);
  const db = new Float64Array(half);
  for (let k = 0; k < half; k++) {
    const mag = Math.hypot(re[k], im[k]);
    const scale = k === 0 || k === nfft / 2 ? 1 : 2;
    freqHz[k] = (k * sampleRate) / nfft;
    amplitude[k] = (scale * mag) / wsum;
    db[k] = Math.max(-120, 20 * Math.log10(amplitude[k] + 1e-12));
  }
  return { freqHz, amplitude, db, nfft, samplesUsed: used };
}
