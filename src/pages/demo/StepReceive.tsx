import { useMemo, useState } from 'react';
import { bitsToString, explainLink, formatNodeId, type LinkResult, type Modulation } from '../../engine';
import { BitStrip } from '../../components/BitStrip';
import { SensorReadingCard } from '../../components/SensorReadingCard';
import { COLORS, WaveformChart } from '../../components/SignalChart';
import { Banner, ExpandableSection, Segmented, StatusBadge, TechNote } from '../../components/ui';
import { fmtBer, fmtDb, fmtMs } from '../../lib/format';
import { modsFor, useDemo } from './DemoContext';
import { StepFrame } from './StepFrame';
import type { StepProps } from './StepSensor';
import { windowBits, type WindowSize } from './StepTransmit';

export function statusOf(r: LinkResult): { tone: 'success' | 'warning' | 'error'; title: string } {
  if (r.delivered) return { tone: 'success', title: 'Packet received and validated' };
  if (r.decode.status === 'undecodable') return { tone: 'error', title: 'Packet could not be decoded' };
  return { tone: 'warning', title: 'Packet received with errors' };
}

export function StepReceive({ goNext, hint }: StepProps) {
  const { validTransmission, selection, presentation } = useDemo();
  const mods = modsFor(selection);
  const [view, setView] = useState<Modulation>(mods[0] ?? 'ASK');
  const [win, setWin] = useState<WindowSize>('16');
  const [selected, setSelected] = useState<number | null>(null);
  const [offset, setOffset] = useState(0);

  const r = validTransmission?.results[view] ?? (validTransmission ? validTransmission.results[mods[0]] : undefined);

  const errorBits = useMemo(() => {
    if (!r) return [];
    const out: number[] = [];
    for (let i = 0; i < r.txBits.length; i++) if (r.txBits[i] !== r.rxBits[i]) out.push(i);
    return out;
  }, [r]);

  if (!r) {
    return (
      <StepFrame title="Did the receiver recover your message?" description="Transmit a signal on the previous step first." hint={hint}>
        <></>
      </StepFrame>
    );
  }

  const total = r.txBits.length;
  const n = windowBits(win, total);
  const start = win === 'all' ? 0 : Math.min(offset, total - n);
  const status = statusOf(r);
  const chartH = presentation ? 220 : 170;

  function inspect(i: number) {
    setSelected(i);
    if (win !== 'all' && (i < start || i >= start + n)) setOffset(Math.max(0, Math.min(total - n, i - Math.floor(n / 2))));
  }

  const d = selected !== null ? r.decisions[selected] : null;

  return (
    <StepFrame
      title="Did the receiver recover your message?"
      description="The receiver only sees the noisy signal. It measures each bit, rebuilds the bytes and checks the checksum."
      primaryLabel="View Comparison"
      onPrimary={goNext}
      hint={hint}
    >
      <div className="space-y-5">
        {mods.length > 1 && (
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              label="Receiver"
              value={view}
              onChange={(v) => {
                setView(v);
                setSelected(null);
              }}
              options={mods.map((m) => {
                const s = statusOf(validTransmission!.results[m]!);
                return { value: m, label: <span className="inline-flex items-center gap-1.5">{m} receiver <span className={s.tone === 'success' ? 'text-ok' : s.tone === 'error' ? 'text-bad' : 'text-warn'}>●</span></span> };
              })}
            />
          </div>
        )}

        <Banner tone={status.tone} title={mods.length > 1 ? `${view}: ${status.title}` : status.title}>
          {explainLink(r)}
        </Banner>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Segmented
            label="Time window"
            value={win}
            onChange={(v) => setWin(v)}
            options={[
              { value: '16', label: '16 bits' },
              { value: '32', label: '32 bits' },
              { value: 'all', label: 'Whole packet' },
            ]}
          />
          {win !== 'all' && (
            <label className="flex items-center gap-2 text-sm text-ink-soft">
              Start at bit
              <input type="range" min={0} max={total - n} step={8} value={start} onChange={(e) => setOffset(Number(e.target.value))} className="slider w-40" aria-label="Window start bit" />
              <span className="w-8 font-mono text-ink">{start}</span>
            </label>
          )}
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-faint">Transmitted signal and original bits</div>
            <WaveformChart
              series={[{ key: 'tx', label: 'Transmitted', color: COLORS[r.modulation], data: r.txSignal }]}
              sampleRate={r.sampleRate}
              bitRate={r.params.bitRate}
              startBit={start}
              endBit={start + n}
              height={chartH}
              selectedBit={selected}
              ariaLabel="Transmitted waveform"
            />
            <div className="mt-3">
              <BitStrip bits={r.txBits} selected={selected} onSelect={inspect} label={`Original bits ${bitsToString(r.txBits)}`} />
            </div>
          </div>
          <div className="rounded-2xl border border-line bg-white p-4">
            <div className="mb-1 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-ink-faint">
              <span>Received signal and recovered bits</span>
              <span className={errorBits.length ? 'text-bad' : 'text-ok'}>{errorBits.length} bit error{errorBits.length === 1 ? '' : 's'}</span>
            </div>
            <WaveformChart
              series={[{ key: 'rx', label: 'Received', color: COLORS.rx, data: r.rxSignal, width: 1 }]}
              sampleRate={r.sampleRate}
              bitRate={r.params.bitRate}
              startBit={start}
              endBit={start + n}
              height={chartH}
              errorBits={errorBits}
              selectedBit={selected}
              ariaLabel="Received noisy waveform"
            />
            <div className="mt-3">
              <BitStrip bits={r.rxBits} compareTo={r.txBits} selected={selected} onSelect={inspect} label="Recovered bits; errors highlighted" />
            </div>
          </div>
        </div>

        {selected !== null && d && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-4 py-3 text-sm text-ink" aria-live="polite">
            <span className="font-semibold">Bit {selected}:</span> sent <span className="font-mono">{r.txBits[selected]}</span>, received{' '}
            <span className="font-mono">{r.rxBits[selected]}</span>
            {r.txBits[selected] !== r.rxBits[selected] && <span className="ml-1 font-medium text-bad">(error)</span>}.{' '}
            {r.modulation === 'ASK' ? (
              <>
                Measured carrier envelope <span className="font-mono">{d.m0.toFixed(4)}</span> vs threshold <span className="font-mono">{d.m1.toFixed(4)}</span>, so the receiver
                decided {d.m0 > d.m1 ? '1' : '0'}.
              </>
            ) : (
              <>
                Energy at f0 <span className="font-mono">{d.m0.toExponential(2)}</span> vs f1 <span className="font-mono">{d.m1.toExponential(2)}</span>, so the receiver decided{' '}
                {d.m1 > d.m0 ? '1' : '0'}.
              </>
            )}
          </div>
        )}
        {selected === null && <p className="text-xs text-ink-faint">Tip: click any bit to see how the receiver decided its value.</p>}

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          {r.decode.status === 'valid' && r.decode.reading && !r.undetectedError ? (
            <SensorReadingCard reading={r.decode.reading} title="Decoded sensor packet" compact />
          ) : (
            <div className="flex flex-col justify-center rounded-2xl border border-dashed border-slate-300 bg-white/60 p-5">
              <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">Decoded sensor packet</div>
              <p className="mt-2 text-[15px] text-ink">No sensor values recovered.</p>
              <p className="mt-1 text-sm text-ink-soft">
                The packet failed validation, so its contents cannot be trusted and are not shown. {r.decode.errors[0] ?? (r.undetectedError ? 'The checksum matched by chance despite bit errors.' : '')}
              </p>
            </div>
          )}
          <ExpandableSection title="Technical details" defaultOpen={!presentation}>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 font-mono text-[13px] text-ink">
              <dt className="font-sans text-ink-soft">Bit errors</dt>
              <dd>{r.bitErrors}</dd>
              <dt className="font-sans text-ink-soft">Total bits compared</dt>
              <dd>{total}</dd>
              <dt className="font-sans text-ink-soft">BER</dt>
              <dd>{fmtBer(r.ber)}</dd>
              <dt className="font-sans text-ink-soft">Checksum</dt>
              <dd>
                {r.decode.receivedCrc === null ? (
                  'not checked'
                ) : (
                  <StatusBadge tone={r.decode.crcOk ? 'success' : 'error'}>{r.decode.crcOk ? 'pass' : 'fail'}</StatusBadge>
                )}
              </dd>
              <dt className="font-sans text-ink-soft">Packet sequence</dt>
              <dd>
                {r.decode.reading ? r.decode.reading.sequence : '—'} (sent {r.reading.sequence}, {formatNodeId(r.reading.nodeId)})
              </dd>
              <dt className="font-sans text-ink-soft">Receiver SNR (link budget)</dt>
              <dd>{fmtDb(r.channel.effectiveSnrDb)}</dd>
              <dt className="font-sans text-ink-soft">Measured SINR</dt>
              <dd>{fmtDb(r.channel.measuredSnrDb)}</dd>
              <dt className="font-sans text-ink-soft">Processing time</dt>
              <dd>{fmtMs(r.processingMs)}</dd>
            </dl>
            <div className="mt-3">
              <TechNote>
                Processing time is the JavaScript compute time to modulate, add channel effects, demodulate and decode in your browser. It is not radio propagation or hardware
                latency. On-air time at {r.params.bitRate} bit/s would be {r.airtimeMs.toFixed(0)} ms.
              </TechNote>
            </div>
          </ExpandableSection>
        </div>
      </div>
    </StepFrame>
  );
}
