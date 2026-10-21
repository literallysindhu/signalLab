/** Core types shared by the simulation engine and the UI. */

export type Modulation = 'ASK' | 'FSK';
export const MODULATIONS: Modulation[] = ['ASK', 'FSK'];

/** One environmental reading from the simulated sensor node. */
export interface SensorReading {
  /** Node identifier, 1–255 (displayed as S01, S02, …). */
  nodeId: number;
  /** Packet sequence number, 0–65535 (wraps). */
  sequence: number;
  /** Unix time in whole seconds. */
  timestamp: number;
  /** Temperature in °C, −40 … 125, transmitted with 0.01 °C resolution. */
  temperatureC: number;
  /** Relative humidity in %, 0 … 100, transmitted with 0.01 % resolution. */
  humidityPct: number;
}

/**
 * All parameters of one simulated link. Signal quantities are in normalised
 * simulation units (amplitude 1.0 = reference transmitter), not real RF watts.
 */
export interface SimParams {
  /** Bit rate in bits per second. */
  bitRate: number;
  /** Samples per bit; sample rate fs = bitRate × samplesPerBit. */
  samplesPerBit: number;
  /** Peak transmit amplitude (normalised; 1.0 = reference transmitter). */
  amplitude: number;
  /** ASK carrier frequency, and centre frequency for FSK (Hz, simulated). */
  carrierHz: number;
  /** FSK tone spacing: f1 − f0 (Hz). f0 = fc − Δf/2, f1 = fc + Δf/2. */
  fskSeparationHz: number;
  /** ASK decision threshold as a fraction of the expected received amplitude. */
  askThreshold: number;
  /** Transmitter–receiver distance (m). */
  distanceM: number;
  /**
   * Reference SNR in dB: the Ec/N0 that a full-amplitude carrier from the
   * reference transmitter (A = 1.0) would have at the 1 m reference distance.
   */
  snrDb: number;
  /** Log-distance path-loss exponent n (2 = free space). */
  pathLossExponent: number;
  /** Rayleigh block fading (one random gain per packet). */
  fading: boolean;
  /** Narrow-band interfering tone at the receiver. */
  interference: boolean;
  /** Interferer amplitude relative to the reference carrier at 1 m (dB). */
  interferenceDb: number;
  /** Interferer frequency (Hz, simulated). */
  interferenceHz: number;
  /**
   * When true, the ASK peak amplitude is raised by √2 so that OOK (carrier on
   * for about half the bits) radiates the same average energy as FSK.
   * When false, both schemes use the same peak amplitude.
   */
  askEqualEnergy: boolean;
  /** Extra payload bytes appended after the sensor fields (0–64). */
  paddingBytes: number;
  /** Seed for the reproducible random-number generator. */
  seed: number;
}

/** Per-bit receiver decision metrics, kept for bit inspection in the UI. */
export interface BitDecision {
  /** ASK: estimated envelope amplitude. FSK: correlator energy at f0. */
  m0: number;
  /** ASK: decision threshold amplitude. FSK: correlator energy at f1. */
  m1: number;
}

export type DecodeStatus = 'valid' | 'checksum_failed' | 'invalid_fields' | 'undecodable';

export interface DecodeResult {
  status: DecodeStatus;
  syncOk: boolean;
  lengthOk: boolean;
  crcOk: boolean;
  receivedCrc: number | null;
  computedCrc: number | null;
  /** Only present when the checksum passed and every field is in range. */
  reading?: SensorReading;
  /** Human-readable reasons for failure (empty when valid). */
  errors: string[];
}

export interface ChannelReport {
  pathLossDb: number;
  /** Linear amplitude gain from path loss only. */
  pathGain: number;
  /** Linear Rayleigh fading amplitude gain (1 when fading is off). */
  fadingGain: number;
  /** Peak carrier amplitude arriving at the receiver. */
  rxAmplitude: number;
  noiseSigma: number;
  interferenceAmplitude: number;
  /** Ec/N0 at the receiver predicted by the link budget (dB), including fading. */
  effectiveSnrDb: number;
  /** SINR measured from the actual samples (carrier-on bits, Ec/N0 scale, dB). */
  measuredSnrDb: number;
}

export interface LinkResult {
  modulation: Modulation;
  params: SimParams;
  reading: SensorReading;
  sampleRate: number;
  txBytes: Uint8Array;
  txBits: Uint8Array;
  rxBits: Uint8Array;
  decisions: BitDecision[];
  bitErrors: number;
  ber: number;
  decode: DecodeResult;
  /**
   * Ground-truth delivery: checksum passed AND every recovered bit matches.
   * A packet whose CRC passes despite bit errors is an undetected error, not a delivery.
   */
  delivered: boolean;
  undetectedError: boolean;
  channel: ChannelReport;
  /** Wall-clock JavaScript compute time for this packet (ms). Not radio latency. */
  processingMs: number;
  /** Theoretical on-air time = bits / bitRate (ms). */
  airtimeMs: number;
  /** Radiated signal energy Σ s² / fs (normalised units). */
  txEnergy: number;
  txSignal?: Float64Array;
  rxSignal?: Float64Array;
}
