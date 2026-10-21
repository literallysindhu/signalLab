import type { BitDecision } from './types';

/**
 * Non-coherent receivers. Both assume ideal bit timing (the receiver knows
 * where each bit starts), which is a deliberate simplification.
 */

interface Tone {
  cos: Float64Array;
  sin: Float64Array;
}

function toneTable(freqHz: number, sampleRate: number, N: number): Tone {
  const w = (2 * Math.PI * freqHz) / sampleRate;
  const cos = new Float64Array(N);
  const sin = new Float64Array(N);
  for (let n = 0; n < N; n++) {
    cos[n] = Math.cos(w * n);
    sin[n] = Math.sin(w * n);
  }
  return { cos, sin };
}

/** Squared magnitude of the I/Q correlation of one bit interval with a tone. */
function correlateEnergy(rx: Float64Array, start: number, tone: Tone): number {
  let i = 0;
  let q = 0;
  const N = tone.cos.length;
  for (let n = 0; n < N; n++) {
    const v = rx[start + n];
    i += v * tone.cos[n];
    q += v * tone.sin[n];
  }
  return i * i + q * q;
}

function bitCount(rx: Float64Array, N: number, nBits: number): void {
  if (!Number.isInteger(nBits) || nBits <= 0) throw new Error('Number of bits to demodulate must be positive.');
  if (rx.length < nBits * N) throw new Error(`Received signal has ${rx.length} samples; ${nBits * N} are needed.`);
}

/**
 * ASK (OOK) envelope detector. For each bit interval, the received samples are
 * correlated with quadrature references at fc; the envelope estimate
 *   â = (2/N)·√(I² + Q²)
 * equals the carrier amplitude for a clean sine (phase-independent). A bit is
 * 1 when â exceeds the threshold amplitude.
 */
export function demodulateASK(
  rx: Float64Array,
  nBits: number,
  samplesPerBit: number,
  sampleRate: number,
  carrierHz: number,
  thresholdAmplitude: number,
): { bits: Uint8Array; decisions: BitDecision[] } {
  bitCount(rx, samplesPerBit, nBits);
  const tone = toneTable(carrierHz, sampleRate, samplesPerBit);
  const bits = new Uint8Array(nBits);
  const decisions: BitDecision[] = new Array(nBits);
  for (let k = 0; k < nBits; k++) {
    const env = (2 / samplesPerBit) * Math.sqrt(correlateEnergy(rx, k * samplesPerBit, tone));
    bits[k] = env > thresholdAmplitude ? 1 : 0;
    decisions[k] = { m0: env, m1: thresholdAmplitude };
  }
  return { bits, decisions };
}

/**
 * Binary FSK non-coherent detector: two quadrature correlator pairs at f0 and
 * f1. The bit is whichever tone has more energy in the interval:
 *   b = 1 if E1 > E0, else 0.
 */
export function demodulateFSK(
  rx: Float64Array,
  nBits: number,
  samplesPerBit: number,
  sampleRate: number,
  f0Hz: number,
  f1Hz: number,
): { bits: Uint8Array; decisions: BitDecision[] } {
  bitCount(rx, samplesPerBit, nBits);
  const t0 = toneTable(f0Hz, sampleRate, samplesPerBit);
  const t1 = toneTable(f1Hz, sampleRate, samplesPerBit);
  const bits = new Uint8Array(nBits);
  const decisions: BitDecision[] = new Array(nBits);
  const scale = 4 / (samplesPerBit * samplesPerBit); // energies in amplitude² units
  for (let k = 0; k < nBits; k++) {
    const e0 = correlateEnergy(rx, k * samplesPerBit, t0) * scale;
    const e1 = correlateEnergy(rx, k * samplesPerBit, t1) * scale;
    bits[k] = e1 > e0 ? 1 : 0;
    decisions[k] = { m0: e0, m1: e1 };
  }
  return { bits, decisions };
}
