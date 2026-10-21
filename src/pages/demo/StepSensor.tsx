import { Pencil, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { encodePacket, formatNodeId, frameLength, toHex, validateReading, type SensorReading } from '../../engine';
import { SensorReadingCard } from '../../components/SensorReadingCard';
import { Field, inputCls, SecondaryButton, Segmented, TechNote } from '../../components/ui';
import { newSampleReading, useDemo } from './DemoContext';
import { StepFrame } from './StepFrame';

export interface StepProps {
  goNext: () => void;
  hint: string | null;
}

type Draft = { temperature: string; humidity: string; nodeId: string; sequence: string };
const toDraft = (r: SensorReading): Draft => ({
  temperature: String(r.temperatureC),
  humidity: String(r.humidityPct),
  nodeId: String(r.nodeId),
  sequence: String(r.sequence),
});

export function StepSensor({ goNext, hint }: StepProps) {
  const { reading, setReading, readingError, setReadingError, params, presentation } = useDemo();
  const [mode, setMode] = useState<'sample' | 'manual'>('sample');
  const [draft, setDraft] = useState<Draft>(() => toDraft(reading));

  useEffect(() => {
    if (mode === 'sample') setDraft(toDraft(reading));
  }, [reading, mode]);

  function editField(field: keyof Draft, value: string) {
    const next = { ...draft, [field]: value };
    setDraft(next);
    const candidate: SensorReading = {
      nodeId: Number(next.nodeId),
      sequence: Number(next.sequence),
      timestamp: Math.floor(Date.now() / 1000),
      temperatureC: Number(next.temperature),
      humidityPct: Number(next.humidity),
    };
    const blank = Object.values(next).some((v) => v.trim() === '');
    try {
      if (blank) throw new Error('All fields are required.');
      validateReading(candidate);
      setReadingError(null);
      setReading({ ...candidate, temperatureC: Math.round(candidate.temperatureC * 100) / 100, humidityPct: Math.round(candidate.humidityPct * 100) / 100 });
    } catch (e) {
      setReadingError((e as Error).message);
    }
  }

  function switchMode(m: 'sample' | 'manual') {
    setMode(m);
    if (m === 'sample') {
      setReadingError(null);
      setDraft(toDraft(reading));
    }
  }

  let packetHex = '';
  try {
    packetHex = toHex(encodePacket(reading, params.paddingBytes));
  } catch {
    packetHex = '';
  }

  return (
    <StepFrame
      title="Start with a sensor reading"
      description="Every wireless sensor link begins with information that needs to reach another device."
      context="This information will be encoded into bits before transmission."
      primaryLabel="Continue to Modulation"
      onPrimary={goNext}
      hint={hint}
    >
      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-4">
          <Segmented
            label="Reading source"
            value={mode}
            onChange={switchMode}
            options={[
              { value: 'sample', label: 'Generate Sample Reading' },
              { value: 'manual', label: 'Enter Values Manually' },
            ]}
          />
          {mode === 'sample' ? (
            <>
              <SensorReadingCard reading={reading} title="Current reading" />
              <SecondaryButton icon={<RefreshCw className="h-4 w-4" />} onClick={() => setReading(newSampleReading((reading.sequence + 1) & 0xffff))}>
                Generate new reading
              </SecondaryButton>
            </>
          ) : (
            <div className="rounded-2xl border border-line bg-white p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-ink">
                <Pencil className="h-4 w-4 text-ink-faint" aria-hidden /> Manual values
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Temperature (°C)" htmlFor="t" hint="−40 to 125">
                  <input id="t" inputMode="decimal" className={inputCls} value={draft.temperature} onChange={(e) => editField('temperature', e.target.value)} />
                </Field>
                <Field label="Humidity (%)" htmlFor="h" hint="0 to 100">
                  <input id="h" inputMode="decimal" className={inputCls} value={draft.humidity} onChange={(e) => editField('humidity', e.target.value)} />
                </Field>
                <Field label="Sensor ID" htmlFor="n" hint="1 to 255">
                  <input id="n" inputMode="numeric" className={inputCls} value={draft.nodeId} onChange={(e) => editField('nodeId', e.target.value)} />
                </Field>
                <Field label="Packet number" htmlFor="s" hint="0 to 65535">
                  <input id="s" inputMode="numeric" className={inputCls} value={draft.sequence} onChange={(e) => editField('sequence', e.target.value)} />
                </Field>
              </div>
              {readingError && (
                <p role="alert" className="mt-3 text-sm text-bad">
                  {readingError}
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-3">
          <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">Packet preview</div>
          <div className="rounded-2xl border border-line bg-white p-5">
            <dl className={presentation ? 'space-y-2 text-lg' : 'space-y-1.5 text-[15px]'}>
              {[
                ['Sensor', formatNodeId(reading.nodeId)],
                ['Temperature', `${reading.temperatureC.toFixed(2)} °C`],
                ['Humidity', `${reading.humidityPct.toFixed(2)} %`],
                ['Packet', String(reading.sequence).padStart(3, '0')],
              ].map(([k, v]) => (
                <div key={k} className="flex justify-between gap-4">
                  <dt className="text-ink-soft">{k}</dt>
                  <dd className="font-mono font-medium text-ink">{v}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-4">
              <div className="mb-1 text-xs text-ink-faint">
                Serialized packet · {frameLength(params.paddingBytes)} bytes ({frameLength(params.paddingBytes) * 8} bits)
              </div>
              <code className="block break-words rounded-lg bg-slate-900 px-3 py-2.5 font-mono text-[13px] leading-relaxed text-teal-200">
                {packetHex || 'Enter valid values to see the packet'}
              </code>
            </div>
          </div>
          <TechNote>
            Frame: sync 0x7E · node ID (1 B) · sequence (2 B) · Unix timestamp (4 B) · temperature int16 ×100 · humidity uint16 ×100 · padding length (1 B) ·
            CRC-16/CCITT-FALSE (2 B). Big-endian.
          </TechNote>
        </div>
      </div>
    </StepFrame>
  );
}
