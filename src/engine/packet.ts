import { crc16 } from './crc';
import type { DecodeResult, SensorReading } from './types';

/**
 * Packet format (big-endian, 15 + P bytes):
 *
 *  offset  size  field
 *  0       1     sync byte 0x7E
 *  1       1     node ID (uint8, 1–255)
 *  2       2     sequence number (uint16)
 *  4       4     timestamp (uint32, Unix seconds)
 *  8       2     temperature (int16, °C × 100)
 *  10      2     humidity (uint16, % RH × 100)
 *  12      1     padding length P (uint8, 0–64)
 *  13      P     padding bytes (deterministic filler derived from the sequence number)
 *  13+P    2     CRC-16/CCITT-FALSE over bytes 0 … 12+P
 */
export const SYNC_BYTE = 0x7e;
/** Bytes of sensor information (node ID through humidity). */
export const SENSOR_FIELD_BYTES = 10;
export const MAX_PADDING = 64;

export class PacketError extends Error {}

export function frameLength(paddingBytes: number): number {
  return 15 + paddingBytes;
}

/** Sensor payload size in bytes (sensor fields + padding), as shown to users. */
export function payloadBytes(paddingBytes: number): number {
  return SENSOR_FIELD_BYTES + paddingBytes;
}

export function formatNodeId(id: number): string {
  return `S${String(id).padStart(2, '0')}`;
}

/** Throws PacketError with a specific message if any field cannot be encoded. */
export function validateReading(r: SensorReading): void {
  if (!r || typeof r !== 'object') throw new PacketError('Sensor reading is missing.');
  const intIn = (v: number, lo: number, hi: number) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!intIn(r.nodeId, 1, 255)) throw new PacketError('Sensor ID must be a whole number from 1 to 255.');
  if (!intIn(r.sequence, 0, 65535)) throw new PacketError('Packet number must be a whole number from 0 to 65535.');
  if (!intIn(r.timestamp, 0, 0xffffffff)) throw new PacketError('Timestamp must be a valid Unix time in seconds.');
  if (!Number.isFinite(r.temperatureC) || r.temperatureC < -40 || r.temperatureC > 125)
    throw new PacketError('Temperature must be a number between −40 and 125 °C.');
  if (!Number.isFinite(r.humidityPct) || r.humidityPct < 0 || r.humidityPct > 100)
    throw new PacketError('Humidity must be a number between 0 and 100 %.');
}

function paddingByte(sequence: number, i: number): number {
  return (sequence * 31 + i * 17 + 0x5a) & 0xff;
}

export function encodePacket(r: SensorReading, paddingBytes = 0): Uint8Array {
  validateReading(r);
  if (!Number.isInteger(paddingBytes) || paddingBytes < 0 || paddingBytes > MAX_PADDING)
    throw new PacketError(`Padding must be a whole number from 0 to ${MAX_PADDING} bytes.`);

  const buf = new Uint8Array(frameLength(paddingBytes));
  const view = new DataView(buf.buffer);
  view.setUint8(0, SYNC_BYTE);
  view.setUint8(1, r.nodeId);
  view.setUint16(2, r.sequence);
  view.setUint32(4, r.timestamp);
  view.setInt16(8, Math.round(r.temperatureC * 100));
  view.setUint16(10, Math.round(r.humidityPct * 100));
  view.setUint8(12, paddingBytes);
  for (let i = 0; i < paddingBytes; i++) buf[13 + i] = paddingByte(r.sequence, i);
  view.setUint16(13 + paddingBytes, crc16(buf, 13 + paddingBytes));
  return buf;
}

/**
 * Parse a received frame. The receiver knows the configured frame length
 * (fixed-length framing). A reading is returned only when the checksum
 * passes and every field is physically valid.
 */
export function decodePacket(bytes: Uint8Array, expectedPadding: number): DecodeResult {
  const fail = (errors: string[], partial: Partial<DecodeResult> = {}): DecodeResult => ({
    status: 'undecodable',
    syncOk: false,
    lengthOk: false,
    crcOk: false,
    receivedCrc: null,
    computedCrc: null,
    errors,
    ...partial,
  });

  if (!bytes || bytes.length === 0) return fail(['No data was received (empty frame).']);
  const expected = frameLength(expectedPadding);
  if (bytes.length !== expected)
    return fail([`Frame length ${bytes.length} bytes does not match the expected ${expected} bytes.`]);

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const syncOk = bytes[0] === SYNC_BYTE;
  const lengthOk = bytes[12] === expectedPadding;
  const receivedCrc = view.getUint16(13 + expectedPadding);
  const computedCrc = crc16(bytes, 13 + expectedPadding);
  const crcOk = receivedCrc === computedCrc;
  const base = { syncOk, lengthOk, crcOk, receivedCrc, computedCrc };

  if (!syncOk || !lengthOk) {
    const errors: string[] = [];
    if (!syncOk)
      errors.push(`Sync byte is 0x${bytes[0].toString(16).toUpperCase()} instead of 0x7E, so the frame start was corrupted.`);
    if (!lengthOk) errors.push(`Length field reads ${bytes[12]} instead of ${expectedPadding}, so the header was corrupted.`);
    return fail(errors, base);
  }
  if (!crcOk) {
    return {
      status: 'checksum_failed',
      ...base,
      errors: [`Checksum mismatch: received 0x${hex4(receivedCrc)}, computed 0x${hex4(computedCrc)}.`],
    };
  }

  const reading: SensorReading = {
    nodeId: view.getUint8(1),
    sequence: view.getUint16(2),
    timestamp: view.getUint32(4),
    temperatureC: view.getInt16(8) / 100,
    humidityPct: view.getUint16(10) / 100,
  };
  try {
    validateReading(reading);
  } catch (e) {
    return { status: 'invalid_fields', ...base, errors: [(e as Error).message] };
  }
  return { status: 'valid', ...base, reading, errors: [] };
}

function hex4(v: number): string {
  return v.toString(16).toUpperCase().padStart(4, '0');
}
