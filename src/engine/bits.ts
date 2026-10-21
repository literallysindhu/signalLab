/** Byte ↔ bit conversion, most-significant bit first. */

export function bytesToBits(bytes: Uint8Array): Uint8Array {
  const bits = new Uint8Array(bytes.length * 8);
  for (let i = 0; i < bytes.length; i++) {
    for (let b = 0; b < 8; b++) bits[i * 8 + b] = (bytes[i] >> (7 - b)) & 1;
  }
  return bits;
}

export function bitsToBytes(bits: ArrayLike<number>): Uint8Array {
  if (bits.length % 8 !== 0) {
    throw new Error(`Bit count ${bits.length} is not a multiple of 8.`);
  }
  const bytes = new Uint8Array(bits.length / 8);
  for (let i = 0; i < bytes.length; i++) {
    let v = 0;
    for (let b = 0; b < 8; b++) v = (v << 1) | (bits[i * 8 + b] & 1);
    bytes[i] = v;
  }
  return bytes;
}

export function countBitErrors(a: ArrayLike<number>, b: ArrayLike<number>): number {
  if (a.length !== b.length) throw new Error(`Bit sequences differ in length (${a.length} vs ${b.length}).`);
  let e = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) e++;
  return e;
}

export function bitsToString(bits: ArrayLike<number>, groupSize = 8): string {
  let s = '';
  for (let i = 0; i < bits.length; i++) {
    if (i > 0 && i % groupSize === 0) s += ' ';
    s += bits[i] ? '1' : '0';
  }
  return s;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join(' ');
}
