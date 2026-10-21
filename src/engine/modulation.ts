import type { Modulation } from './types';

export interface WaveformConfig {
  bitRate: number;
  samplesPerBit: number;
  amplitude: number;
  carrierHz: number;
  /** FSK space frequency (bit 0). */
  f0Hz: number;
  /** FSK mark frequency (bit 1). */
  f1Hz: number;
}

export class ModulationError extends Error {}

function checkBits(bits: ArrayLike<number>): void {
  if (!bits || bits.length === 0) throw new ModulationError('There are no bits to modulate.');
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] !== 0 && bits[i] !== 1) throw new ModulationError(`Bit ${i} has value ${bits[i]}; only 0 and 1 are allowed.`);
  }
}

function checkConfig(cfg: WaveformConfig): void {
  if (!Number.isInteger(cfg.samplesPerBit) || cfg.samplesPerBit < 2)
    throw new ModulationError('Samples per bit must be a whole number of at least 2.');
  if (!(cfg.bitRate > 0)) throw new ModulationError('Bit rate must be positive.');
}

/**
 * On-off keying (OOK), the special case of ASK where A(0) = 0 and A(1) = A:
 *   s(t) = A(b) · sin(2π fc t)
 * The carrier phase reference runs continuously across bits (t is absolute time),
 * so a run of 1s is one unbroken sine wave.
 */
export function modulateASK(bits: ArrayLike<number>, cfg: WaveformConfig): Float64Array {
  checkBits(bits);
  checkConfig(cfg);
  const N = cfg.samplesPerBit;
  const fs = cfg.bitRate * N;
  const w = (2 * Math.PI * cfg.carrierHz) / fs;
  const out = new Float64Array(bits.length * N);
  for (let k = 0; k < bits.length; k++) {
    if (!bits[k]) continue; // amplitude 0 for bit 0
    for (let n = 0; n < N; n++) {
      const idx = k * N + n;
      out[idx] = cfg.amplitude * Math.sin(w * idx);
    }
  }
  return out;
}

/**
 * Continuous-phase binary FSK:
 *   s(t) = A · sin(φ(t)),  dφ/dt = 2π f_b
 * with f_b = f0 for bit 0 and f1 for bit 1. A phase accumulator carries the
 * phase across bit boundaries, so there are no artificial jumps in the waveform.
 */
export function modulateFSK(bits: ArrayLike<number>, cfg: WaveformConfig): Float64Array {
  checkBits(bits);
  checkConfig(cfg);
  const N = cfg.samplesPerBit;
  const fs = cfg.bitRate * N;
  const w0 = (2 * Math.PI * cfg.f0Hz) / fs;
  const w1 = (2 * Math.PI * cfg.f1Hz) / fs;
  const out = new Float64Array(bits.length * N);
  let phase = 0;
  for (let k = 0; k < bits.length; k++) {
    const w = bits[k] ? w1 : w0;
    for (let n = 0; n < N; n++) {
      out[k * N + n] = cfg.amplitude * Math.sin(phase);
      phase += w;
    }
    phase %= 2 * Math.PI; // keep numerically small; continuity is preserved
  }
  return out;
}

export function modulate(mod: Modulation, bits: ArrayLike<number>, cfg: WaveformConfig): Float64Array {
  return mod === 'ASK' ? modulateASK(bits, cfg) : modulateFSK(bits, cfg);
}
