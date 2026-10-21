/**
 * CRC-16/CCITT-FALSE: polynomial 0x1021, initial value 0xFFFF, no reflection,
 * no final XOR. The check value for ASCII "123456789" is 0x29B1.
 */
export function crc16(bytes: Uint8Array, length = bytes.length): number {
  let crc = 0xffff;
  for (let i = 0; i < length; i++) {
    crc ^= bytes[i] << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}
