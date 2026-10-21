import { CheckCircle2, Loader2, Play, SkipForward } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { bitsToString, bytesToBits, encodePacket, formatNodeId, fskMarkHz, fskSpaceHz, simulateLink, toHex, type LinkResult, type Modulation } from '../../engine';
import { BitStrip } from '../../components/BitStrip';
import { BitChart, COLORS, SpectrumChart, WaveformChart } from '../../components/SignalChart';
import { Banner, ExpandableSection, PrimaryButton, ProgressBar, SecondaryButton, Segmented, TechNote } from '../../components/ui';
import { useSettings } from '../../lib/settings';
import { modsFor, useDemo } from './DemoContext';
import { StepFrame } from './StepFrame';
import type { StepProps } from './StepSensor';

type Stage = 'idle' | 'encoding' | 'modulating' | 'channel' | 'revealing' | 'done' | 'error';
const STAGE_TEXT: Record<Stage, string> = {
  idle: 'Ready to transmit',
  encoding: 'Encoding packet into bits…',
  modulating: 'Modulating bits onto the carrier…',
  channel: 'Passing the signal through the simulated channel…',
  revealing: 'Sending bits…',
  done: 'Signal generated successfully.',
  error: 'Transmission could not be simulated',
};

export type WindowSize = '16' | '32' | 'all';
export function windowBits(size: WindowSize, total: number): number {
  return size === 'all' ? total : Math.min(total, Number(size));
}

const pause = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function StepTransmit({ goNext, hint }: StepProps) {
  const { reading, params, selection, inputKey, validTransmission, setTransmission, autoTransmit, setAutoTransmit, presentation } = useDemo();
  const { reducedMotion } = useSettings();
  const mods = modsFor(selection);
  const [stage, setStage] = useState<Stage>(validTransmission ? 'done' : 'idle');
  const [error, setError] = useState<string | null>(null);
  const [reveal, setReveal] = useState<number | null>(null);
  const [view, setView] = useState<Modulation>(mods[0] ?? 'ASK');
  const [win, setWin] = useState<WindowSize>('16');
  const skipRef = useRef(false);
  const rafRef = useRef<number>(0);

  const txBits = useMemo(() => {
    try {
      return bytesToBits(encodePacket(reading, params.paddingBytes));
    } catch {
      return new Uint8Array(0);
    }
  }, [reading, params.paddingBytes]);
  const txBytes = useMemo(() => {
    try {
      return encodePacket(reading, params.paddingBytes);
    } catch {
      return new Uint8Array(0);
    }
  }, [reading, params.paddingBytes]);

  const transmit = useCallback(async () => {
    cancelAnimationFrame(rafRef.current);
    skipRef.current = false;
    setError(null);
    setTransmission(null);
    const fast = reducedMotion;
    try {
      setStage('encoding');
      setReveal(0);
      if (!fast) await pause(250);
      setStage('modulating');
      if (!fast) await pause(250);
      setStage('channel');
      // The real computation: modulation, channel and receiver for each selected scheme.
      const results: Partial<Record<Modulation, LinkResult>> = {};
      for (const m of mods) results[m] = simulateLink(reading, m, params, { keepSignals: true });
      if (!fast) await pause(200);
      setTransmission({ key: inputKey, results });
      const total = txBits.length;
      if (fast) {
        setReveal(null);
        setStage('done');
        return;
      }
      setStage('revealing');
      const start = performance.now();
      const duration = 1600;
      const tick = (t: number) => {
        const frac = skipRef.current ? 1 : Math.min(1, (t - start) / duration);
        setReveal(Math.round(frac * total));
        if (frac < 1) rafRef.current = requestAnimationFrame(tick);
        else {
          setReveal(null);
          setStage('done');
        }
      };
      rafRef.current = requestAnimationFrame(tick);
    } catch (e) {
      setStage('error');
      setError((e as Error).message);
    }
  }, [mods, reading, params, inputKey, setTransmission, reducedMotion, txBits.length]);

  useEffect(() => {
    if (autoTransmit) {
      setAutoTransmit(false);
      if (!validTransmission) void transmit();
    }
  }, [autoTransmit, setAutoTransmit, validTransmission, transmit]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  // Settings changed since the last transmission → show idle again.
  useEffect(() => {
    if (!validTransmission && (stage === 'done' || stage === 'revealing')) setStage('idle');
  }, [validTransmission, stage]);

  useEffect(() => {
    if (!mods.includes(view) && mods[0]) setView(mods[0]);
  }, [mods, view]);

  const results = validTransmission?.results;
  const total = txBits.length;
  const nWin = windowBits(win, total);
  const revealedBits = reveal === null ? total : reveal;
  const running = stage !== 'idle' && stage !== 'done' && stage !== 'error';
  const chartH = presentation ? 300 : 240;
  const both = selection === 'BOTH';

  const tx = (m: Modulation) => results?.[m]?.txSignal;
  const fs = results?.[mods[0]]?.sampleRate ?? params.bitRate * params.samplesPerBit;

  return (
    <StepFrame
      title="Watch your data become a signal"
      description="Your packet is converted to bits, and the bits are converted into a radio waveform. Everything below is drawn from the simulator's actual samples."
      context={`"Signal generated successfully" means the waveform was produced and sent through the channel. Whether the receiver could decode it is shown on the next step.`}
      primaryLabel="Proceed to Receiver"
      onPrimary={goNext}
      hint={hint}
      extraActions={
        stage === 'revealing' ? (
          <SecondaryButton size="lg" icon={<SkipForward className="h-4 w-4" />} onClick={() => (skipRef.current = true)}>
            Skip animation
          </SecondaryButton>
        ) : validTransmission ? (
          <SecondaryButton size="lg" icon={<Play className="h-4 w-4" />} onClick={() => void transmit()} disabled={running}>
            Transmit again
          </SecondaryButton>
        ) : null
      }
    >
      <div className="space-y-5">
        {/* 1. Packet */}
        <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-line bg-white px-4 py-2.5 font-mono text-sm text-ink">
            <span className="font-sans text-xs font-medium uppercase tracking-wide text-ink-faint">1 · Packet</span>
            <span>{formatNodeId(reading.nodeId)}</span>
            <span>{reading.temperatureC.toFixed(2)} °C</span>
            <span>{reading.humidityPct.toFixed(2)} %</span>
            <span>#{String(reading.sequence).padStart(3, '0')}</span>
          </div>
          <code className="truncate rounded-lg bg-slate-100 px-3 py-2 font-mono text-xs text-ink-soft" title={toHex(txBytes)}>
            {toHex(txBytes)}
          </code>
        </div>

        {/* 2. Bits */}
        <div className="rounded-xl border border-line bg-white px-4 py-3">
          <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-wide text-ink-faint">
            <span>2 · Encoded binary sequence · {total} bits</span>
            {stage !== 'idle' && <span className="font-mono normal-case">{revealedBits}/{total} sent</span>}
          </div>
          <BitStrip bits={txBits} revealed={stage === 'idle' ? 0 : revealedBits} label={`Transmitted bits: ${bitsToString(txBits)}`} />
        </div>

        {/* 3. Waveform */}
        <div className="rounded-2xl border border-line bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs font-medium uppercase tracking-wide text-ink-faint">3 · Modulated waveform {both ? '(ASK and FSK, same bits)' : `(${mods[0]})`}</div>
            <div className="flex flex-wrap gap-2">
              {!both && mods.length > 1 && (
                <Segmented label="Waveform" value={view} onChange={setView} options={mods.map((m) => ({ value: m, label: `${m} waveform` }))} />
              )}
              <Segmented
                label="Time window"
                value={win}
                onChange={setWin}
                options={[
                  { value: '16', label: 'First 16 bits' },
                  { value: '32', label: '32 bits' },
                  { value: 'all', label: 'Whole packet' },
                ]}
              />
            </div>
          </div>

          {!results ? (
            <div className="flex flex-col items-center justify-center rounded-xl bg-slate-50 py-14 text-center" style={{ minHeight: chartH }}>
              {running ? (
                <>
                  <Loader2 className="mb-3 h-6 w-6 animate-spin text-accent motion-reduce:animate-none" aria-hidden />
                  <p className="text-sm text-ink-soft">{STAGE_TEXT[stage]}</p>
                </>
              ) : (
                <>
                  <p className="mb-4 max-w-sm text-sm text-ink-soft">{error ?? 'Click below to modulate your packet and send it through the simulated channel.'}</p>
                  <PrimaryButton size="lg" icon={<Play className="h-4 w-4" />} onClick={() => void transmit()}>
                    Show transmission
                  </PrimaryButton>
                </>
              )}
            </div>
          ) : both ? (
            <div className="space-y-1">
              <BitChart tx={txBits} bitRate={params.bitRate} startBit={0} endBit={nWin} height={90} ariaLabel="Transmitted bits" />
              {(['ASK', 'FSK'] as Modulation[]).map((m) => (
                <div key={m}>
                  <div className="ml-14 text-xs font-medium" style={{ color: COLORS[m] }}>
                    {m}
                  </div>
                  <WaveformChart
                    series={[{ key: m, label: `${m} transmitted`, color: COLORS[m], data: tx(m) }]}
                    sampleRate={fs}
                    bitRate={params.bitRate}
                    startBit={0}
                    endBit={nWin}
                    height={presentation ? 190 : 150}
                    revealBits={reveal ?? undefined}
                    ariaLabel={`${m} transmitted waveform`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <WaveformChart
              series={[{ key: view, label: `${view} transmitted`, color: COLORS[view], data: tx(view) }]}
              sampleRate={fs}
              bitRate={params.bitRate}
              startBit={0}
              endBit={nWin}
              height={chartH}
              revealBits={reveal ?? undefined}
              zoomable={win === 'all'}
              ariaLabel={`${view} transmitted waveform`}
            />
          )}

          {stage !== 'idle' && (
            <div className="mt-3" aria-live="polite">
              {stage === 'done' ? (
                <Banner tone="success" title={STAGE_TEXT.done}>
                  {mods.join(' and ')} waveform{mods.length > 1 ? 's' : ''} of {total} bits ({results?.[mods[0]]?.airtimeMs.toFixed(0)} ms on air at {params.bitRate} bit/s).
                </Banner>
              ) : stage === 'error' ? (
                <Banner tone="error" title={STAGE_TEXT.error}>
                  {error}
                </Banner>
              ) : (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-sm text-ink-soft">
                    <Loader2 className="h-4 w-4 animate-spin text-accent motion-reduce:animate-none" aria-hidden />
                    {STAGE_TEXT[stage]}
                  </div>
                  <ProgressBar value={(revealedBits / total) * 100} label="Transmission progress" />
                </div>
              )}
            </div>
          )}
        </div>

        {results && (
          <ExpandableSection title="Frequency spectrum" icon={<CheckCircle2 className="h-4 w-4 text-ink-faint" aria-hidden />}>
            <SpectrumPanel results={results} mods={mods} />
          </ExpandableSection>
        )}
      </div>
    </StepFrame>
  );
}

function SpectrumPanel({ results, mods }: { results: Partial<Record<Modulation, LinkResult>>; mods: Modulation[] }) {
  const [m, setM] = useState<Modulation>(mods[0]);
  const [which, setWhich] = useState<'tx' | 'rx'>('tx');
  const r = results[m] ?? results[mods[0]]!;
  const sig = which === 'tx' ? r.txSignal! : r.rxSignal!;
  const markers =
    r.modulation === 'ASK'
      ? [{ hz: r.params.carrierHz, label: 'fc' }]
      : [
          { hz: fskSpaceHz(r.params), label: 'f0' },
          { hz: fskMarkHz(r.params), label: 'f1' },
        ];
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        {mods.length > 1 && <Segmented label="Modulation" value={m} onChange={setM} options={mods.map((x) => ({ value: x, label: x }))} />}
        <Segmented
          label="Signal"
          value={which}
          onChange={setWhich}
          options={[
            { value: 'tx', label: 'Transmitted' },
            { value: 'rx', label: 'Received (noisy)' },
          ]}
        />
      </div>
      <SpectrumChart signal={sig} sampleRate={r.sampleRate} markers={markers} color={COLORS[r.modulation]} />
      <TechNote>
        ASK (on-off keying) puts its energy around the single carrier fc, with sidebands about ±Rb wide created by switching it on and off. FSK concentrates energy at the two tones
        f0 and f1, so it occupies roughly Δf + 2·Rb of bandwidth: wider than ASK at the same bit rate.
      </TechNote>
    </div>
  );
}
