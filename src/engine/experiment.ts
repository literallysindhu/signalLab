import { simulateLink } from './link';
import { bitErrorRate, mean, packetDeliveryRatio, packetLossPercent, stdDev } from './metrics';
import { payloadBytes } from './packet';
import { validateParams } from './params';
import { hashSeed, Rng } from './rng';
import { generateReading } from './sensor';
import type { Modulation, SimParams } from './types';

export interface ExperimentConfig {
  name: string;
  modulations: Modulation[];
  snrValues: number[];
  distanceValues: number[];
  /** Extra payload bytes; payload size = 10 sensor bytes + padding. */
  paddingValues: number[];
  packetsPerPoint: number;
  repetitions: number;
  /** Everything else (bit rate, frequencies, fading, seed …). snr/distance/padding are overridden by the sweep. */
  base: SimParams;
  /** True for the built-in demonstration presets. */
  isDemo?: boolean;
}

export interface ExperimentPoint {
  modulation: Modulation;
  snrDb: number;
  distanceM: number;
  payloadBytes: number;
  packetBits: number;
  packetsSent: number;
  packetsDelivered: number;
  pdr: number;
  pdrStd: number;
  packetLoss: number;
  bitErrors: number;
  bitsCompared: number;
  ber: number;
  berStd: number;
  checksumFailures: number;
  undecodable: number;
  undetectedErrors: number;
  /** Mean link-budget Ec/N0 at the receiver (dB). */
  avgLinkSnrDb: number;
  /** Mean SINR measured from samples (dB). */
  avgMeasuredSnrDb: number;
  avgProcessingMs: number;
  airtimeMs: number;
  /** Mean radiated energy per transmitted packet (normalised units). */
  energyPerPacket: number;
  /** Radiated energy spent per delivered packet; null when nothing was delivered. */
  energyPerDelivered: number | null;
}

export interface ExperimentResult {
  id: string;
  config: ExperimentConfig;
  points: ExperimentPoint[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  totalPackets: number;
  engineVersion: string;
}

export interface ExperimentProgress {
  donePackets: number;
  totalPackets: number;
  current: { modulation: Modulation; snrDb: number; distanceM: number; payloadBytes: number };
}

export const ENGINE_VERSION = '1.0.0';
/** Fixed time base so readings (and therefore packets) are reproducible. */
const TIMESTAMP_BASE = 1767225600; // 2026-01-01T00:00:00Z

export const EXPERIMENT_LIMITS = {
  maxPoints: 400,
  maxPacketsPerPoint: 5000,
  maxRepetitions: 20,
  maxTotalPackets: 200000,
};

export function validateExperiment(cfg: ExperimentConfig): string[] {
  const errors: string[] = [];
  if (!cfg.modulations.length) errors.push('Select at least one modulation scheme.');
  if (!cfg.snrValues.length) errors.push('Enter at least one SNR value.');
  if (!cfg.distanceValues.length) errors.push('Enter at least one distance value.');
  if (!cfg.paddingValues.length) errors.push('Enter at least one payload size.');
  if (cfg.snrValues.some((v) => !Number.isFinite(v) || v < -5 || v > 30)) errors.push('SNR values must be between −5 and 30 dB.');
  if (cfg.distanceValues.some((v) => !Number.isFinite(v) || v < 1 || v > 100)) errors.push('Distances must be between 1 and 100 m.');
  if (cfg.paddingValues.some((v) => !Number.isInteger(v) || v < 0 || v > 64))
    errors.push('Payload sizes must be whole numbers from 10 to 74 bytes.');
  if (!Number.isInteger(cfg.packetsPerPoint) || cfg.packetsPerPoint < 1 || cfg.packetsPerPoint > EXPERIMENT_LIMITS.maxPacketsPerPoint)
    errors.push(`Packets per test point must be a whole number from 1 to ${EXPERIMENT_LIMITS.maxPacketsPerPoint}.`);
  if (!Number.isInteger(cfg.repetitions) || cfg.repetitions < 1 || cfg.repetitions > EXPERIMENT_LIMITS.maxRepetitions)
    errors.push(`Repetitions must be a whole number from 1 to ${EXPERIMENT_LIMITS.maxRepetitions}.`);
  const points = cfg.modulations.length * cfg.snrValues.length * cfg.distanceValues.length * cfg.paddingValues.length;
  if (points > EXPERIMENT_LIMITS.maxPoints) errors.push(`The sweep has ${points} test points; the limit is ${EXPERIMENT_LIMITS.maxPoints}.`);
  const total = points * cfg.packetsPerPoint * cfg.repetitions;
  if (total > EXPERIMENT_LIMITS.maxTotalPackets)
    errors.push(`The sweep would simulate ${total.toLocaleString()} packets; the limit is ${EXPERIMENT_LIMITS.maxTotalPackets.toLocaleString()}.`);
  const pv = validateParams({ ...cfg.base, snrDb: cfg.snrValues[0] ?? 0, distanceM: cfg.distanceValues[0] ?? 1, paddingBytes: cfg.paddingValues[0] ?? 0 });
  errors.push(...pv.errors);
  return errors;
}

export function experimentPacketCount(cfg: ExperimentConfig): number {
  return cfg.modulations.length * cfg.snrValues.length * cfg.distanceValues.length * cfg.paddingValues.length * cfg.packetsPerPoint * cfg.repetitions;
}

/**
 * Run a parameter sweep. For each (payload, distance, SNR) point, every
 * modulation sees the SAME sensor readings and the SAME channel random stream
 * (common random numbers), so ASK and FSK are compared under identical noise,
 * fading and interference realisations.
 */
export function runExperiment(
  cfg: ExperimentConfig,
  onProgress?: (p: ExperimentProgress) => void,
  shouldCancel?: () => boolean,
): ExperimentResult {
  const errors = validateExperiment(cfg);
  if (errors.length) throw new Error(errors[0]);

  const started = Date.now();
  const totalPackets = experimentPacketCount(cfg);
  let done = 0;
  const points: ExperimentPoint[] = [];

  cfg.paddingValues.forEach((padding, pi) => {
    cfg.distanceValues.forEach((distanceM, di) => {
      cfg.snrValues.forEach((snrDb, si) => {
        for (const modulation of cfg.modulations) {
          const params: SimParams = { ...cfg.base, snrDb, distanceM, paddingBytes: padding };
          const repPdr: number[] = [];
          const repBer: number[] = [];
          let delivered = 0, sent = 0, bitErrors = 0, bits = 0, crcFail = 0, undec = 0, undetected = 0;
          let procMs = 0, energy = 0, airtime = 0;
          const linkSnr: number[] = [];
          const measSnr: number[] = [];
          let packetBits = 0;

          for (let rep = 0; rep < cfg.repetitions; rep++) {
            let rDelivered = 0, rErr = 0, rBits = 0;
            for (let k = 0; k < cfg.packetsPerPoint; k++) {
              if (shouldCancel?.()) throw new Error('Experiment cancelled.');
              const readingRng = new Rng(hashSeed(cfg.base.seed, 0xbeef, rep, k));
              const reading = generateReading(readingRng, 1, (rep * cfg.packetsPerPoint + k) & 0xffff, TIMESTAMP_BASE + k);
              const channelSeed = hashSeed(cfg.base.seed, rep, pi, di, si, k);
              const r = simulateLink(reading, modulation, params, { channelSeed });
              packetBits = r.txBits.length;
              sent++;
              if (r.delivered) { delivered++; rDelivered++; }
              if (r.decode.status === 'checksum_failed' || r.decode.status === 'invalid_fields') crcFail++;
              if (r.decode.status === 'undecodable') undec++;
              if (r.undetectedError) undetected++;
              bitErrors += r.bitErrors;
              rErr += r.bitErrors;
              bits += r.txBits.length;
              rBits += r.txBits.length;
              procMs += r.processingMs;
              energy += r.txEnergy;
              airtime = r.airtimeMs;
              linkSnr.push(r.channel.effectiveSnrDb);
              if (Number.isFinite(r.channel.measuredSnrDb)) measSnr.push(r.channel.measuredSnrDb);
              done++;
              if (onProgress && (done % 20 === 0 || done === totalPackets)) {
                onProgress({ donePackets: done, totalPackets, current: { modulation, snrDb, distanceM, payloadBytes: payloadBytes(padding) } });
              }
            }
            repPdr.push(packetDeliveryRatio(rDelivered, cfg.packetsPerPoint));
            repBer.push(bitErrorRate(rErr, rBits));
          }

          const pdr = packetDeliveryRatio(delivered, sent);
          points.push({
            modulation,
            snrDb,
            distanceM,
            payloadBytes: payloadBytes(padding),
            packetBits,
            packetsSent: sent,
            packetsDelivered: delivered,
            pdr,
            pdrStd: stdDev(repPdr),
            packetLoss: packetLossPercent(pdr),
            bitErrors,
            bitsCompared: bits,
            ber: bitErrorRate(bitErrors, bits),
            berStd: stdDev(repBer),
            checksumFailures: crcFail,
            undecodable: undec,
            undetectedErrors: undetected,
            avgLinkSnrDb: mean(linkSnr.filter(Number.isFinite)),
            avgMeasuredSnrDb: mean(measSnr),
            avgProcessingMs: procMs / sent,
            airtimeMs: airtime,
            energyPerPacket: energy / sent,
            energyPerDelivered: delivered ? energy / delivered : null,
          });
        }
      });
    });
  });

  const finished = Date.now();
  return {
    id: `exp-${started.toString(36)}-${hashSeed(started, cfg.base.seed).toString(36)}`,
    config: cfg,
    points,
    startedAt: new Date(started).toISOString(),
    finishedAt: new Date(finished).toISOString(),
    durationMs: finished - started,
    totalPackets,
    engineVersion: ENGINE_VERSION,
  };
}

export type MetricKey = 'ber' | 'pdr' | 'packetLoss' | 'avgProcessingMs' | 'energyPerDelivered';

export const METRIC_INFO: Record<MetricKey, { label: string; better: 'lower' | 'higher'; unit: string }> = {
  ber: { label: 'Bit error rate', better: 'lower', unit: '' },
  pdr: { label: 'Packet delivery ratio', better: 'higher', unit: '%' },
  packetLoss: { label: 'Packet loss', better: 'lower', unit: '%' },
  avgProcessingMs: { label: 'Processing time', better: 'lower', unit: 'ms' },
  energyPerDelivered: { label: 'Energy per delivered packet', better: 'lower', unit: 'a.u.' },
};

/** Best point for a metric; ties are broken by the lower BER, then higher PDR. */
export function bestPoint(points: ExperimentPoint[], metric: MetricKey): ExperimentPoint | null {
  const valid = points.filter((p) => p[metric] !== null && Number.isFinite(p[metric] as number));
  if (!valid.length) return null;
  const dir = METRIC_INFO[metric].better === 'lower' ? 1 : -1;
  return [...valid].sort((a, b) => dir * ((a[metric] as number) - (b[metric] as number)) || a.ber - b.ber || b.pdr - a.pdr)[0];
}
