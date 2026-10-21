import { Rng } from './rng';

/**
 * Simulated wireless channel.
 *
 *   r[n] = h · g(d) · s[n] + i[n] + w[n]
 *
 * g(d)  log-distance path loss, PL(d) = 10·n·log10(d / d0) dB with d0 = 1 m
 * h     Rayleigh block-fading amplitude (E[h²] = 1), constant for one packet
 * i[n]  optional narrow-band interfering tone with random phase
 * w[n]  additive white Gaussian noise with variance σ²
 *
 * SNR convention (Ec/N0): Ec = A²T/2 is the energy of one bit-duration of a
 * full-amplitude carrier. For real discrete-time noise of variance σ² at
 * sample rate fs, N0 = 2σ²/fs, so Ec/N0 = A²·N / (4σ²) with N samples per bit.
 * The SNR control sets Ec/N0 for the reference transmitter (A = 1) at 1 m,
 * which fixes the receiver noise floor. Transmit amplitude, distance and
 * fading then change the received Ec/N0 relative to that floor.
 */
export interface ChannelConfig {
  distanceM: number;
  snrDb: number;
  pathLossExponent: number;
  samplesPerBit: number;
  sampleRate: number;
  fading: boolean;
  interference: boolean;
  interferenceDb: number;
  interferenceHz: number;
}

export const REFERENCE_DISTANCE_M = 1;

export function pathLossDb(distanceM: number, exponent: number): number {
  return 10 * exponent * Math.log10(Math.max(distanceM, REFERENCE_DISTANCE_M) / REFERENCE_DISTANCE_M);
}

/** Noise standard deviation giving the requested reference Ec/N0 for A = 1. */
export function noiseSigmaFor(snrDb: number, samplesPerBit: number): number {
  return Math.sqrt(samplesPerBit / (4 * Math.pow(10, snrDb / 10)));
}

/** Link-budget Ec/N0 (dB) at the receiver. */
export function linkSnrDb(snrDb: number, amplitude: number, distanceM: number, exponent: number, fadingGain = 1): number {
  return snrDb + 20 * Math.log10(amplitude) - pathLossDb(distanceM, exponent) + 20 * Math.log10(Math.max(fadingGain, 1e-9));
}

export interface ChannelOutput {
  rx: Float64Array;
  /** The attenuated, faded transmitted signal without noise or interference. */
  clean: Float64Array;
  pathLossDb: number;
  pathGain: number;
  fadingGain: number;
  noiseSigma: number;
  interferenceAmplitude: number;
  /** Measured total power of (interference + noise) in the received samples. */
  disturbancePower: number;
}

export function applyChannel(tx: Float64Array, cfg: ChannelConfig, rng: Rng): ChannelOutput {
  const pl = pathLossDb(cfg.distanceM, cfg.pathLossExponent);
  const pathGain = Math.pow(10, -pl / 20);

  // Draw fading and interferer phase unconditionally so the noise stream is the
  // same whether these options are on or off (fairer A/B comparisons).
  const fx = rng.gaussian();
  const fy = rng.gaussian();
  const rayleigh = Math.sqrt((fx * fx + fy * fy) / 2);
  const intPhase = rng.uniform() * 2 * Math.PI;

  const fadingGain = cfg.fading ? rayleigh : 1;
  const sigma = noiseSigmaFor(cfg.snrDb, cfg.samplesPerBit);
  const intAmp = cfg.interference ? Math.pow(10, cfg.interferenceDb / 20) : 0;
  const wInt = (2 * Math.PI * cfg.interferenceHz) / cfg.sampleRate;
  const g = pathGain * fadingGain;

  const rx = new Float64Array(tx.length);
  const clean = new Float64Array(tx.length);
  let dist = 0;
  for (let n = 0; n < tx.length; n++) {
    const s = g * tx[n];
    const d = sigma * rng.gaussian() + (intAmp ? intAmp * Math.sin(wInt * n + intPhase) : 0);
    clean[n] = s;
    rx[n] = s + d;
    dist += d * d;
  }
  return {
    rx,
    clean,
    pathLossDb: pl,
    pathGain,
    fadingGain,
    noiseSigma: sigma,
    interferenceAmplitude: intAmp,
    disturbancePower: tx.length ? dist / tx.length : 0,
  };
}
