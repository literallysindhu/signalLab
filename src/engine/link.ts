import { bitsToBytes, bytesToBits, countBitErrors } from './bits';
import { applyChannel, linkSnrDb } from './channel';
import { demodulateASK, demodulateFSK } from './demodulation';
import { modulate, type WaveformConfig } from './modulation';
import { decodePacket, encodePacket } from './packet';
import { fskMarkHz, fskSpaceHz, sampleRateOf, validateParams } from './params';
import { Rng } from './rng';
import type { LinkResult, Modulation, SensorReading, SimParams } from './types';

/** Peak transmit amplitude actually used by a modulation (see SimParams.askEqualEnergy). */
export function txAmplitude(p: SimParams, mod: Modulation): number {
  return mod === 'ASK' && p.askEqualEnergy ? p.amplitude * Math.SQRT2 : p.amplitude;
}

export function waveformConfig(p: SimParams, mod: Modulation = 'FSK'): WaveformConfig {
  return {
    bitRate: p.bitRate,
    samplesPerBit: p.samplesPerBit,
    amplitude: txAmplitude(p, mod),
    carrierHz: p.carrierHz,
    f0Hz: fskSpaceHz(p),
    f1Hz: fskMarkHz(p),
  };
}

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export interface LinkOptions {
  /** Seed for this packet's channel randomness. Defaults to params.seed. */
  channelSeed?: number;
  /** Keep transmitted/received sample arrays (needed for plots). */
  keepSignals?: boolean;
}

/**
 * Full pipeline for one packet:
 * sensor reading → bytes → bits → modulation → channel → demodulation → bytes → validation.
 * The receiver only sees the noisy received samples; the transmitted bits are used
 * afterwards purely to score the result (BER, ground-truth delivery).
 */
export function simulateLink(reading: SensorReading, mod: Modulation, params: SimParams, opts: LinkOptions = {}): LinkResult {
  const v = validateParams(params);
  if (v.errors.length) throw new Error(v.errors[0]);

  const t0 = now();
  const txBytes = encodePacket(reading, params.paddingBytes);
  const txBits = bytesToBits(txBytes);
  const cfg = waveformConfig(params, mod);
  const amp = cfg.amplitude;
  const fs = sampleRateOf(params);
  const N = params.samplesPerBit;

  const tx = modulate(mod, txBits, cfg);
  const rng = new Rng(opts.channelSeed ?? params.seed);
  const ch = applyChannel(
    tx,
    {
      distanceM: params.distanceM,
      snrDb: params.snrDb,
      pathLossExponent: params.pathLossExponent,
      samplesPerBit: N,
      sampleRate: fs,
      fading: params.fading,
      interference: params.interference,
      interferenceDb: params.interferenceDb,
      interferenceHz: params.interferenceHz,
    },
    rng,
  );

  // The ASK receiver is calibrated to the nominal path loss at the configured
  // distance (like a fixed AGC set-point). It does NOT know the fading gain.
  const expectedAmp = amp * ch.pathGain;
  const demod =
    mod === 'ASK'
      ? demodulateASK(ch.rx, txBits.length, N, fs, params.carrierHz, params.askThreshold * expectedAmp)
      : demodulateFSK(ch.rx, txBits.length, N, fs, cfg.f0Hz, cfg.f1Hz);

  const rxBytes = bitsToBytes(demod.bits);
  const decode = decodePacket(rxBytes, params.paddingBytes);
  const t1 = now();

  const bitErrors = countBitErrors(txBits, demod.bits);
  const delivered = decode.status === 'valid' && bitErrors === 0;
  const undetectedError = decode.status === 'valid' && bitErrors > 0;

  // Measured SINR on carrier-on bits, expressed on the same Ec/N0 scale:
  // Ec/N0 = P_signal · N / (2 · P_disturbance) for a sine of power P_signal.
  let sigPow = 0;
  let onSamples = 0;
  for (let k = 0; k < txBits.length; k++) {
    if (mod === 'ASK' && !txBits[k]) continue;
    for (let n = 0; n < N; n++) {
      const s = ch.clean[k * N + n];
      sigPow += s * s;
    }
    onSamples += N;
  }
  sigPow = onSamples ? sigPow / onSamples : 0;
  const measuredSnrDb = ch.disturbancePower > 0 && sigPow > 0 ? 10 * Math.log10((sigPow * N) / (2 * ch.disturbancePower)) : Infinity;

  let txEnergy = 0;
  for (let n = 0; n < tx.length; n++) txEnergy += tx[n] * tx[n];
  txEnergy /= fs;

  return {
    modulation: mod,
    params,
    reading,
    sampleRate: fs,
    txBytes,
    txBits,
    rxBits: demod.bits,
    decisions: demod.decisions,
    bitErrors,
    ber: bitErrors / txBits.length,
    decode,
    delivered,
    undetectedError,
    channel: {
      pathLossDb: ch.pathLossDb,
      pathGain: ch.pathGain,
      fadingGain: ch.fadingGain,
      rxAmplitude: expectedAmp * ch.fadingGain,
      noiseSigma: ch.noiseSigma,
      interferenceAmplitude: ch.interferenceAmplitude,
      effectiveSnrDb: linkSnrDb(params.snrDb, amp, params.distanceM, params.pathLossExponent, ch.fadingGain),
      measuredSnrDb,
    },
    processingMs: t1 - t0,
    airtimeMs: (txBits.length / params.bitRate) * 1000,
    txEnergy,
    txSignal: opts.keepSignals ? tx : undefined,
    rxSignal: opts.keepSignals ? ch.rx : undefined,
  };
}
