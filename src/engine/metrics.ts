/**
 * Performance metrics.
 *
 *   BER  = incorrect recovered bits / total transmitted bits compared
 *   PDR  = valid packets delivered / packets transmitted × 100 %
 *   Loss = 100 − PDR
 *
 * A packet counts as delivered only if its CRC passes, every field is in range,
 * AND every recovered bit equals the transmitted bit (the simulator knows the
 * ground truth, so an undetected CRC collision is still counted as a loss).
 * Every transmitted bit of every packet is compared, including header and CRC bits.
 */

export function bitErrorRate(bitErrors: number, bitsCompared: number): number {
  if (!Number.isFinite(bitsCompared) || bitsCompared <= 0) throw new Error('BER needs at least one compared bit.');
  if (!Number.isFinite(bitErrors) || bitErrors < 0 || bitErrors > bitsCompared)
    throw new Error('Bit errors must be between 0 and the number of compared bits.');
  return bitErrors / bitsCompared;
}

export function packetDeliveryRatio(delivered: number, sent: number): number {
  if (!Number.isFinite(sent) || sent <= 0) throw new Error('PDR needs at least one transmitted packet.');
  if (!Number.isFinite(delivered) || delivered < 0 || delivered > sent)
    throw new Error('Delivered packets must be between 0 and the number sent.');
  return (delivered / sent) * 100;
}

export function packetLossPercent(pdrPercent: number): number {
  return 100 - pdrPercent;
}

export function mean(values: number[]): number {
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : NaN;
}

/** Sample standard deviation (n − 1); 0 for fewer than two values. */
export function stdDev(values: number[]): number {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((a, v) => a + (v - m) ** 2, 0) / (values.length - 1));
}

/**
 * Two-proportion z-test. Returns which rate is lower ('a' | 'b') when the
 * difference is significant at ~95 %, otherwise 'tie'.
 */
export function compareRates(aCount: number, aTotal: number, bCount: number, bTotal: number): 'a' | 'b' | 'tie' {
  if (aTotal <= 0 || bTotal <= 0) return 'tie';
  const pa = aCount / aTotal;
  const pb = bCount / bTotal;
  const p = (aCount + bCount) / (aTotal + bTotal);
  if (p === 0 || p === 1) return 'tie';
  const z = (pa - pb) / Math.sqrt(p * (1 - p) * (1 / aTotal + 1 / bTotal));
  if (Math.abs(z) < 1.96) return 'tie';
  return pa < pb ? 'a' : 'b';
}
