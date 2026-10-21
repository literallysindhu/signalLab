import { describe, expect, it } from 'vitest';
import {
  applyChannel,
  bestPoint,
  bitErrorRate,
  bitsToBytes,
  bytesToBits,
  compareRates,
  countBitErrors,
  crc16,
  decodePacket,
  DEFAULT_PARAMS,
  demodulateASK,
  demodulateFSK,
  encodePacket,
  frameLength,
  magnitudeSpectrum,
  modulateASK,
  modulateFSK,
  packetDeliveryRatio,
  packetLossPercent,
  PacketError,
  Rng,
  runExperiment,
  simulateLink,
  validateExperiment,
  validateParams,
  waveformConfig,
  type ExperimentConfig,
  type SensorReading,
  type SimParams,
} from '../index';

const reading: SensorReading = { nodeId: 1, sequence: 42, timestamp: 1767225600, temperatureC: 29.4, humidityPct: 62 };
const P = DEFAULT_PARAMS;
const fs = P.bitRate * P.samplesPerBit;
const cfg = waveformConfig(P);
const noiseless: SimParams = { ...P, snrDb: 30, distanceM: 1, amplitude: 4 }; // ≈42 dB Ec/N0

function randomBits(n: number, seed: number): Uint8Array {
  const r = new Rng(seed);
  return Uint8Array.from({ length: n }, () => (r.uniform() < 0.5 ? 0 : 1));
}

describe('bits and CRC', () => {
  it('round-trips bytes through bits (MSB first)', () => {
    const bytes = Uint8Array.from([0x7e, 0x00, 0xff, 0xa5]);
    const bits = bytesToBits(bytes);
    expect(Array.from(bits.slice(0, 8))).toEqual([0, 1, 1, 1, 1, 1, 1, 0]);
    expect(Array.from(bitsToBytes(bits))).toEqual(Array.from(bytes));
  });
  it('rejects bit counts that are not whole bytes', () => {
    expect(() => bitsToBytes([1, 0, 1])).toThrow(/multiple of 8/);
  });
  it('matches the CRC-16/CCITT-FALSE check value', () => {
    expect(crc16(new TextEncoder().encode('123456789'))).toBe(0x29b1);
  });
});

describe('1. ASK noiseless modulation/demodulation', () => {
  it('recovers a known sequence exactly from the waveform', () => {
    const bits = Uint8Array.from([1, 0, 1, 1, 0, 0, 1, 0, 1, 1, 1, 0]);
    const tx = modulateASK(bits, cfg);
    expect(tx.length).toBe(bits.length * P.samplesPerBit);
    // bit 0 intervals carry no energy (on-off keying)
    expect(Math.max(...Array.from(tx.slice(P.samplesPerBit, 2 * P.samplesPerBit)).map(Math.abs))).toBe(0);
    const { bits: rx, decisions } = demodulateASK(tx, bits.length, P.samplesPerBit, fs, P.carrierHz, 0.5);
    expect(Array.from(rx)).toEqual(Array.from(bits));
    expect(decisions[0].m0).toBeCloseTo(1, 6); // envelope ≈ amplitude
  });
});

describe('2. FSK noiseless modulation/demodulation', () => {
  it('recovers a known sequence and keeps constant amplitude with continuous phase', () => {
    const bits = Uint8Array.from([0, 1, 1, 0, 1, 0, 0, 0, 1, 1]);
    const tx = modulateFSK(bits, cfg);
    const { bits: rx, decisions } = demodulateFSK(tx, bits.length, P.samplesPerBit, fs, cfg.f0Hz, cfg.f1Hz);
    expect(Array.from(rx)).toEqual(Array.from(bits));
    expect(decisions[1].m1).toBeGreaterThan(10 * decisions[1].m0);
    expect(Math.max(...Array.from(tx).map(Math.abs))).toBeLessThanOrEqual(P.amplitude + 1e-12);
    // continuous phase: sample-to-sample steps never exceed the largest per-sample step
    const maxStep = P.amplitude * 2 * Math.sin((Math.PI * cfg.f1Hz) / fs) + 1e-9;
    for (let n = 1; n < tx.length; n++) expect(Math.abs(tx[n] - tx[n - 1])).toBeLessThanOrEqual(maxStep);
  });
});

describe('3. Bit recovery through the full link', () => {
  for (const mod of ['ASK', 'FSK'] as const) {
    it(`${mod}: high-SNR link recovers 512 random bits and full packets`, () => {
      const bits = randomBits(512, 7);
      const hcfg = waveformConfig(noiseless);
      const tx = mod === "ASK" ? modulateASK(bits, hcfg) : modulateFSK(bits, hcfg);
      const ch = applyChannel(tx, { ...noiseless, sampleRate: fs, samplesPerBit: P.samplesPerBit }, new Rng(1));
      const rx =
        mod === 'ASK'
          ? demodulateASK(ch.rx, bits.length, P.samplesPerBit, fs, P.carrierHz, 0.5 * noiseless.amplitude * ch.pathGain).bits
          : demodulateFSK(ch.rx, bits.length, P.samplesPerBit, fs, cfg.f0Hz, cfg.f1Hz).bits;
      expect(countBitErrors(bits, rx)).toBe(0);

      const r = simulateLink(reading, mod, noiseless);
      expect(r.bitErrors).toBe(0);
      expect(r.delivered).toBe(true);
      expect(r.decode.reading).toEqual(reading);
    });
  }
});

describe('4. Empty and invalid payloads', () => {
  it('rejects empty and non-binary bit sequences', () => {
    expect(() => modulateASK([], cfg)).toThrow(/no bits/i);
    expect(() => modulateFSK([0, 2, 1], cfg)).toThrow(/only 0 and 1/);
  });
  it('rejects invalid sensor readings with clear messages', () => {
    expect(() => encodePacket({ ...reading, temperatureC: NaN })).toThrow(PacketError);
    expect(() => encodePacket({ ...reading, humidityPct: 120 })).toThrow(/Humidity/);
    expect(() => encodePacket({ ...reading, nodeId: 0 })).toThrow(/Sensor ID/);
    expect(() => encodePacket(reading, 99)).toThrow(/Padding/);
  });
  it('reports empty or wrongly sized frames as undecodable', () => {
    expect(decodePacket(new Uint8Array(0), 0).status).toBe('undecodable');
    expect(decodePacket(new Uint8Array(5), 0).status).toBe('undecodable');
  });
  it('rejects invalid link parameters', () => {
    expect(validateParams({ ...P, carrierHz: 20000 }).errors[0]).toMatch(/Nyquist/);
    expect(validateParams({ ...P, snrDb: 99 }).errors.length).toBeGreaterThan(0);
    expect(() => simulateLink(reading, 'ASK', { ...P, samplesPerBit: 4 })).toThrow();
  });
});

describe('5. Deterministic output with a fixed seed', () => {
  it('produces identical noisy waveforms and bits for the same seed', () => {
    const p = { ...P, snrDb: 12, distanceM: 4, fading: true, interference: true };
    const a = simulateLink(reading, 'FSK', p, { keepSignals: true });
    const b = simulateLink(reading, 'FSK', p, { keepSignals: true });
    expect(Array.from(a.rxSignal!)).toEqual(Array.from(b.rxSignal!));
    expect(Array.from(a.rxBits)).toEqual(Array.from(b.rxBits));
    const c = simulateLink(reading, 'FSK', { ...p, seed: p.seed + 1 }, { keepSignals: true });
    expect(Array.from(c.rxSignal!)).not.toEqual(Array.from(a.rxSignal!));
  });
});

describe('6. BER calculation', () => {
  it('counts errors against known sequences', () => {
    const tx = [1, 0, 1, 1, 0, 0, 1, 0];
    const rx = [1, 1, 1, 0, 0, 0, 1, 0];
    expect(countBitErrors(tx, rx)).toBe(2);
    expect(bitErrorRate(2, 8)).toBe(0.25);
    expect(() => bitErrorRate(0, 0)).toThrow();
    expect(() => countBitErrors([1], [1, 0])).toThrow();
  });
});

describe('7. PDR and packet loss', () => {
  it('computes delivery ratio and loss percentages', () => {
    expect(packetDeliveryRatio(87, 100)).toBe(87);
    expect(packetLossPercent(87)).toBe(13);
    expect(packetDeliveryRatio(0, 10)).toBe(0);
    expect(() => packetDeliveryRatio(1, 0)).toThrow();
    expect(() => packetDeliveryRatio(11, 10)).toThrow();
  });
});

describe('8. Checksum failure detection', () => {
  it('detects any single flipped payload bit and never returns sensor values', () => {
    const bytes = encodePacket(reading);
    const bits = bytesToBits(bytes);
    for (let i = 8 * 1; i < bits.length; i++) {
      if (i >= 96 && i < 104) continue; // the length byte is reported as a header error
      const flipped = bits.slice();
      flipped[i] ^= 1;
      const d = decodePacket(bitsToBytes(flipped), 0);
      expect(d.status).not.toBe('valid');
      expect(d.reading).toBeUndefined();
    }
  });
  it('flags a corrupted sync byte as undecodable', () => {
    const bytes = encodePacket(reading);
    bytes[0] ^= 0x01;
    const d = decodePacket(bytes, 0);
    expect(d.status).toBe('undecodable');
    expect(d.syncOk).toBe(false);
  });
});

describe('9. Very low SNR behaviour', () => {
  it('produces many bit errors and never claims delivery when bits differ', () => {
    for (const mod of ['ASK', 'FSK'] as const) {
      let delivered = 0;
      let errs = 0;
      let bits = 0;
      for (let k = 0; k < 20; k++) {
        const r = simulateLink(reading, mod, { ...P, snrDb: -5, distanceM: 30 }, { channelSeed: k });
        if (r.delivered) {
          delivered++;
          expect(r.bitErrors).toBe(0);
        }
        if (r.bitErrors > 0) expect(r.delivered).toBe(false);
        errs += r.bitErrors;
        bits += r.txBits.length;
      }
      expect(delivered).toBe(0);
      expect(errs / bits).toBeGreaterThan(0.2);
    }
  });
});

describe('10. Experiment runner', () => {
  const base: ExperimentConfig = {
    name: 'test',
    modulations: ['ASK', 'FSK'],
    snrValues: [0, 30],
    distanceValues: [1, 3],
    paddingValues: [0],
    packetsPerPoint: 10,
    repetitions: 2,
    base: { ...P },
  };
  it('runs every point, reports progress and is reproducible', () => {
    const progress: number[] = [];
    const res = runExperiment(base, (p) => progress.push(p.donePackets));
    expect(res.points).toHaveLength(2 * 2 * 2);
    expect(res.totalPackets).toBe(160);
    expect(progress.at(-1)).toBe(160);
    for (const p of res.points) {
      expect(p.packetsSent).toBe(20);
      expect(p.bitsCompared).toBe(20 * frameLength(0) * 8);
      expect(p.pdr + p.packetLoss).toBeCloseTo(100);
      expect(p.ber).toBeCloseTo(p.bitErrors / p.bitsCompared);
    }
    const strong = res.points.filter((p) => p.snrDb === 30 && p.distanceM === 1);
    strong.forEach((p) => expect(p.pdr).toBe(100));
    const weak = res.points.filter((p) => p.snrDb === 0 && p.distanceM === 3);
    weak.forEach((p) => expect(p.pdr).toBeLessThan(50));

    const again = runExperiment(base);
    expect(again.points.map((p) => p.bitErrors)).toEqual(res.points.map((p) => p.bitErrors));
    expect(bestPoint(res.points, 'pdr')!.pdr).toBe(100);
  });
  it('validates configurations and supports cancellation', () => {
    expect(validateExperiment({ ...base, modulations: [] })[0]).toMatch(/modulation/);
    expect(validateExperiment({ ...base, snrValues: [50] }).length).toBeGreaterThan(0);
    expect(() => runExperiment(base, undefined, () => true)).toThrow(/cancelled/);
  });
});

describe('Physics sanity checks', () => {
  it('BER falls as SNR rises for both schemes', () => {
    const res = runExperiment({
      name: 'ber-trend',
      modulations: ['ASK', 'FSK'],
      snrValues: [2, 8, 14],
      distanceValues: [1],
      paddingValues: [0],
      packetsPerPoint: 30,
      repetitions: 1,
      base: { ...P },
    });
    for (const mod of ['ASK', 'FSK']) {
      const b = res.points.filter((p) => p.modulation === mod).map((p) => p.ber);
      expect(b[0]).toBeGreaterThan(b[1]);
      expect(b[1]).toBeGreaterThanOrEqual(b[2]);
    }
  });
  it('spectrum peaks at the FSK tones and the ASK carrier', () => {
    const bits = randomBits(256, 3);
    const peak = (sig: Float64Array) => {
      const s = magnitudeSpectrum(sig, fs);
      let best = 0;
      for (let k = 1; k < s.amplitude.length; k++) if (s.amplitude[k] > s.amplitude[best]) best = k;
      return s.freqHz[best];
    };
    expect(Math.abs(peak(modulateASK(bits, cfg)) - P.carrierHz)).toBeLessThan(50);
    const f = peak(modulateFSK(bits, cfg));
    expect(Math.min(Math.abs(f - cfg.f0Hz), Math.abs(f - cfg.f1Hz))).toBeLessThan(50);
  });
  it('compareRates only calls significant differences', () => {
    expect(compareRates(0, 1000, 0, 1000)).toBe('tie');
    expect(compareRates(5, 1000, 6, 1000)).toBe('tie');
    expect(compareRates(10, 10000, 200, 10000)).toBe('a');
  });
});
