import { Rng } from './rng';
import type { SensorReading } from './types';

export interface SensorProfile {
  baseTemperatureC: number;
  baseHumidityPct: number;
  /** Standard deviation of the random variation (°C; humidity uses twice this in % RH). */
  variation: number;
}

export const DEFAULT_PROFILE: SensorProfile = { baseTemperatureC: 27.5, baseHumidityPct: 60, variation: 1.5 };

const round2 = (v: number) => Math.round(v * 100) / 100;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** A plausible simulated environmental reading. */
export function generateReading(
  rng: Rng,
  nodeId: number,
  sequence: number,
  timestamp: number,
  profile: SensorProfile = DEFAULT_PROFILE,
): SensorReading {
  return {
    nodeId,
    sequence: sequence & 0xffff,
    timestamp: Math.floor(timestamp) >>> 0,
    temperatureC: round2(clamp(profile.baseTemperatureC + profile.variation * rng.gaussian(), -40, 125)),
    humidityPct: round2(clamp(profile.baseHumidityPct + 2 * profile.variation * rng.gaussian(), 0, 100)),
  };
}
