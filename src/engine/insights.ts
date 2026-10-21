import { compareRates } from './metrics';
import type { ExperimentPoint } from './experiment';
import type { LinkResult } from './types';

const fmtBer = (v: number) => (v === 0 ? '0' : v < 0.001 ? v.toExponential(1) : v.toFixed(4));

/** Plain-English explanation of one packet's reception outcome. */
export function explainLink(r: LinkResult): string {
  const total = r.txBits.length;
  if (r.delivered) {
    return `All ${total} bits were recovered correctly from the noisy signal and the checksum matched, so the sensor values below were decoded by the receiver.`;
  }
  if (r.undetectedError) {
    return `${r.bitErrors} of ${total} bits were wrong, yet the checksum happened to match. The simulator knows the true bits, so this is counted as a failed delivery (an undetected error).`;
  }
  const s = r.decode.status;
  const most = r.bitErrors <= total * 0.1;
  if (s === 'checksum_failed' || s === 'invalid_fields') {
    return most
      ? `The receiver recovered ${total - r.bitErrors} of ${total} bits, but ${r.bitErrors} error${r.bitErrors === 1 ? '' : 's'} broke the checksum, so the packet was rejected.`
      : `${r.bitErrors} of ${total} bits were wrong. The checksum failed, so the packet was rejected.`;
  }
  return `${r.bitErrors} of ${total} bits were wrong, including bits in the packet header, so the receiver could not even identify the frame.`;
}

export interface ComparisonSummary {
  sentences: string[];
  berWinner: 'ASK' | 'FSK' | 'tie';
  pdrWinner: 'ASK' | 'FSK' | 'tie';
}

/**
 * Observations drawn only from measured results. A difference is called only
 * when a two-proportion z-test says it is unlikely to be chance (≈95 %).
 */
export function compareOutcomes(ask: ExperimentPoint, fsk: ExperimentPoint): ComparisonSummary {
  const sentences: string[] = [];
  const berCmp = compareRates(ask.bitErrors, ask.bitsCompared, fsk.bitErrors, fsk.bitsCompared);
  const berWinner = berCmp === 'a' ? 'ASK' : berCmp === 'b' ? 'FSK' : 'tie';
  const lossCmp = compareRates(ask.packetsSent - ask.packetsDelivered, ask.packetsSent, fsk.packetsSent - fsk.packetsDelivered, fsk.packetsSent);
  const pdrWinner = lossCmp === 'a' ? 'ASK' : lossCmp === 'b' ? 'FSK' : 'tie';

  if (ask.bitErrors === 0 && fsk.bitErrors === 0) {
    sentences.push(`Neither scheme had a single bit error across ${ask.bitsCompared.toLocaleString()} bits each, so at this operating point both links are effectively error-free.`);
  } else if (berWinner === 'tie') {
    sentences.push(`ASK and FSK bit error rates (${fmtBer(ask.ber)} vs ${fmtBer(fsk.ber)}) are statistically tied for this number of bits.`);
  } else {
    const [w, l] = berWinner === 'ASK' ? [ask, fsk] : [fsk, ask];
    sentences.push(`At this setting, ${berWinner} produced a lower bit error rate than ${berWinner === 'ASK' ? 'FSK' : 'ASK'} in this run (${fmtBer(w.ber)} vs ${fmtBer(l.ber)}).`);
  }

  if (pdrWinner === 'tie') {
    if (ask.pdr !== fsk.pdr || ask.pdr < 100)
      sentences.push(`Packet delivery (ASK ${ask.pdr.toFixed(1)} %, FSK ${fsk.pdr.toFixed(1)} %) shows no statistically clear difference.`);
  } else {
    const [w, l] = pdrWinner === 'ASK' ? [ask, fsk] : [fsk, ask];
    sentences.push(`${pdrWinner} delivered more valid packets: ${w.pdr.toFixed(1)} % vs ${l.pdr.toFixed(1)} %.`);
  }

  if (ask.energyPerPacket > 0 && fsk.energyPerPacket > 0) {
    const ratio = ask.energyPerPacket / fsk.energyPerPacket;
    sentences.push(
      ask.energyPerPacket < fsk.energyPerPacket * 0.9
        ? `ASK (on-off keying) radiated ${(ratio * 100).toFixed(0)} % of FSK's signal energy per packet, because no carrier is sent for 0 bits. This run used equal peak amplitude, which gives ASK less energy per bit.`
        : `Both schemes radiated similar energy per packet (ASK ${(ratio * 100).toFixed(0)} % of FSK), so this is an equal-energy comparison.`,
    );
  }
  return { sentences, berWinner, pdrWinner };
}
