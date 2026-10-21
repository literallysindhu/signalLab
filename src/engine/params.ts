import { MAX_PADDING } from './packet';
import type { SimParams } from './types';

/**
 * Default link: 1 kbit/s, 32 samples per bit (fs = 32 kHz), 4 kHz carrier,
 * FSK tones at 3 kHz and 5 kHz (Δf = 2·Rb, orthogonal for non-coherent detection).
 * Frequencies are scaled-down simulation frequencies, not real ISM-band RF.
 */
export const DEFAULT_PARAMS: SimParams = {
  bitRate: 1000,
  samplesPerBit: 32,
  amplitude: 1,
  carrierHz: 4000,
  fskSeparationHz: 2000,
  askThreshold: 0.5,
  distanceM: 5,
  snrDb: 30,
  pathLossExponent: 2,
  fading: false,
  interference: false,
  interferenceDb: -20,
  interferenceHz: 4500,
  askEqualEnergy: false,
  paddingBytes: 0,
  seed: 2024,
};

export const PARAM_LIMITS = {
  bitRate: { min: 100, max: 10000 },
  samplesPerBit: { min: 8, max: 128 },
  amplitude: { min: 0.05, max: 4 },
  carrierHz: { min: 100, max: 100000 },
  fskSeparationHz: { min: 50, max: 50000 },
  askThreshold: { min: 0.05, max: 0.95 },
  distanceM: { min: 1, max: 100 },
  snrDb: { min: -5, max: 30 },
  pathLossExponent: { min: 1.5, max: 4.5 },
  interferenceDb: { min: -60, max: 10 },
  interferenceHz: { min: 10, max: 100000 },
  paddingBytes: { min: 0, max: MAX_PADDING },
  seed: { min: 0, max: 0xffffffff },
} as const;

export const sampleRateOf = (p: Pick<SimParams, 'bitRate' | 'samplesPerBit'>) => p.bitRate * p.samplesPerBit;
export const fskSpaceHz = (p: Pick<SimParams, 'carrierHz' | 'fskSeparationHz'>) => p.carrierHz - p.fskSeparationHz / 2;
export const fskMarkHz = (p: Pick<SimParams, 'carrierHz' | 'fskSeparationHz'>) => p.carrierHz + p.fskSeparationHz / 2;

export interface ParamValidation {
  errors: string[];
  warnings: string[];
}

/**
 * Check that the parameters describe a link the simulator can represent
 * faithfully. Errors block transmission; warnings explain degraded behaviour.
 */
export function validateParams(p: SimParams): ParamValidation {
  const errors: string[] = [];
  const warnings: string[] = [];

  for (const [key, lim] of Object.entries(PARAM_LIMITS) as [keyof typeof PARAM_LIMITS, { min: number; max: number }][]) {
    const v = p[key] as number;
    if (typeof v !== 'number' || !Number.isFinite(v)) errors.push(`${label(key)} must be a number.`);
    else if (v < lim.min || v > lim.max) errors.push(`${label(key)} must be between ${lim.min} and ${lim.max}.`);
  }
  if (!Number.isInteger(p.samplesPerBit)) errors.push('Samples per bit must be a whole number.');
  if (!Number.isInteger(p.paddingBytes)) errors.push('Extra payload bytes must be a whole number.');
  if (!Number.isInteger(p.seed)) errors.push('Random seed must be a whole number.');
  if (errors.length) return { errors, warnings };

  const fs = sampleRateOf(p);
  const nyq = fs / 2;
  const f0 = fskSpaceHz(p);
  const f1 = fskMarkHz(p);
  const khz = (f: number) => `${(f / 1000).toFixed(2)} kHz`;

  if (f0 <= 0) errors.push(`FSK space frequency f0 = ${khz(f0)} must be above 0 Hz. Reduce the separation or raise the carrier.`);
  if (p.carrierHz >= nyq) errors.push(`Carrier ${khz(p.carrierHz)} must be below the Nyquist limit fs/2 = ${khz(nyq)}.`);
  if (f1 >= nyq) errors.push(`FSK mark frequency f1 = ${khz(f1)} must be below the Nyquist limit fs/2 = ${khz(nyq)}.`);
  if (p.interference && p.interferenceHz >= nyq)
    errors.push(`Interferer frequency ${khz(p.interferenceHz)} must be below fs/2 = ${khz(nyq)}.`);
  if (errors.length) return { errors, warnings };

  if (f1 > 0.4 * fs) warnings.push('Highest tone is close to Nyquist; each cycle is drawn with fewer than 2.5 samples.');
  if (p.carrierHz / p.bitRate < 2) warnings.push('Fewer than 2 carrier cycles per bit; envelope detection becomes less reliable.');
  if (f0 / p.bitRate < 1) warnings.push('FSK space tone completes less than one cycle per bit.');
  const ratio = p.fskSeparationHz / p.bitRate;
  if (ratio < 1) {
    warnings.push(
      `FSK separation (${khz(p.fskSeparationHz)}) is below the bit rate; non-coherent detection needs Δf ≥ Rb for orthogonal tones, so the f0/f1 correlators will overlap.`,
    );
  } else if (Math.abs(ratio - Math.round(ratio)) > 0.05) {
    warnings.push('FSK separation is not a whole multiple of the bit rate, so the two tones are not exactly orthogonal over one bit (minor crosstalk).');
  }
  return { errors, warnings };
}

function label(key: string): string {
  const map: Record<string, string> = {
    bitRate: 'Data rate',
    samplesPerBit: 'Samples per bit',
    amplitude: 'Transmit amplitude',
    carrierHz: 'Carrier frequency',
    fskSeparationHz: 'FSK separation',
    askThreshold: 'ASK threshold',
    distanceM: 'Distance',
    snrDb: 'SNR',
    pathLossExponent: 'Path-loss exponent',
    interferenceDb: 'Interference level',
    interferenceHz: 'Interference frequency',
    paddingBytes: 'Extra payload bytes',
    seed: 'Random seed',
  };
  return map[key] ?? key;
}
