import { CloudRain, Shuffle, Sun } from 'lucide-react';
import { useMemo } from 'react';
import { DEFAULT_PARAMS, fskMarkHz, fskSpaceHz, linkSnrDb, pathLossDb, sampleRateOf, txAmplitude, validateParams, type SimParams } from '../../engine';
import { ChannelIllustration } from '../../components/ChannelIllustration';
import { ParameterSlider } from '../../components/ParameterSlider';
import { ExpandableSection, Field, inputCls, SecondaryButton, TechNote, Toggle, cx } from '../../components/ui';
import { fmtHz } from '../../lib/format';
import { modsFor, useDemo } from './DemoContext';
import { StepFrame } from './StepFrame';
import type { StepProps } from './StepSensor';

/** Presets change real simulation parameters. */
export const CHANNEL_PRESETS: Record<'clear' | 'noisy', { label: string; description: string; patch: Partial<SimParams> }> = {
  clear: {
    label: 'Clear Channel',
    description: '3 m, SNR 30 dB, no fading or interference',
    patch: { distanceM: 3, snrDb: 30, fading: false, interference: false },
  },
  noisy: {
    label: 'Noisy Channel',
    description: '9 m, SNR 30 dB, interference on',
    patch: { distanceM: 9, snrDb: 30, fading: false, interference: true, interferenceDb: -30 },
  },
};

export function AdvancedChannelSettings({ params, update }: { params: SimParams; update: (p: Partial<SimParams>) => void }) {
  const fs = sampleRateOf(params);
  return (
    <div className="grid gap-x-8 gap-y-5 md:grid-cols-2">
      <ParameterSlider
        label="Transmit amplitude"
        value={params.amplitude}
        min={0.25}
        max={4}
        step={0.05}
        onChange={(v) => update({ amplitude: v })}
        format={(v) => `${v.toFixed(2)} (${(20 * Math.log10(v)).toFixed(1)} dB)`}
        tooltip="Peak transmitter amplitude in normalised units (1.0 = reference). Doubling it adds 6 dB of SNR. This is a simulated amplitude, not a real power in watts."
      />
      <ParameterSlider
        label="ASK detection threshold"
        value={params.askThreshold}
        min={0.1}
        max={0.9}
        step={0.05}
        onChange={(v) => update({ askThreshold: v })}
        format={(v) => `${Math.round(v * 100)} % of expected`}
        tooltip="The ASK receiver says '1' when the measured carrier envelope is above this fraction of the amplitude it expects at this distance."
      />
      <ParameterSlider
        label="FSK frequency separation"
        value={params.fskSeparationHz}
        min={250}
        max={4000}
        step={250}
        onChange={(v) => update({ fskSeparationHz: v })}
        format={(v) => `${fmtHz(v)}`}
        tooltip="Distance between the two FSK tones. Non-coherent detection works best when the separation is a whole multiple of the bit rate."
        hint={`Space f₀ = ${fmtHz(fskSpaceHz(params))} · Mark f₁ = ${fmtHz(fskMarkHz(params))}`}
      />
      <ParameterSlider
        label="Carrier frequency"
        value={params.carrierHz}
        min={1000}
        max={8000}
        step={250}
        onChange={(v) => update({ carrierHz: v })}
        format={fmtHz}
        tooltip="Simulated carrier (ASK) and centre frequency (FSK). Scaled down from real radio frequencies so every cycle can be sampled and plotted."
        hint={`Sample rate ${fmtHz(fs)} (Nyquist limit ${fmtHz(fs / 2)})`}
      />
      <ParameterSlider
        label="Path-loss exponent"
        value={params.pathLossExponent}
        min={1.6}
        max={4}
        step={0.1}
        onChange={(v) => update({ pathLossExponent: v })}
        format={(v) => v.toFixed(1)}
        tooltip="n in PL(d) = 10·n·log10(d / 1 m). 2 is free space; 2.7–4 is typical indoors or in cluttered environments."
      />
      <Field label="Samples per bit" htmlFor="spb" hint="More samples = smoother waveforms, slower simulation">
        <select id="spb" className={inputCls} value={params.samplesPerBit} onChange={(e) => update({ samplesPerBit: Number(e.target.value) })}>
          {[16, 24, 32, 48, 64].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <div className="space-y-4">
        <Toggle checked={params.fading} onChange={(v) => update({ fading: v })} label="Fading" description="Rayleigh block fading: each packet gets a random gain (average power unchanged)." />
        <Toggle checked={params.interference} onChange={(v) => update({ interference: v })} label="Interference" description="Adds an interfering tone at the receiver." />
        <Toggle
          checked={params.askEqualEnergy}
          onChange={(v) => update({ askEqualEnergy: v })}
          label="Equal-energy ASK"
          description="Raise ASK amplitude by √2 so ASK and FSK radiate the same average energy. Off = equal peak amplitude."
        />
      </div>
      <div className="space-y-4">
        {params.interference && (
          <>
            <ParameterSlider label="Interference level" value={params.interferenceDb} min={-50} max={-5} step={1} unit="dB" onChange={(v) => update({ interferenceDb: v })} tooltip="Interferer amplitude relative to the reference carrier at 1 m." />
            <ParameterSlider label="Interference frequency" value={params.interferenceHz} min={500} max={8000} step={100} onChange={(v) => update({ interferenceHz: v })} format={fmtHz} />
          </>
        )}
        <Field label="Random seed" htmlFor="seed" hint="Same seed + same settings = identical noise.">
          <div className="flex gap-2">
            <input
              id="seed"
              inputMode="numeric"
              className={inputCls}
              value={params.seed}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isInteger(v) && v >= 0 && v <= 0xffffffff) update({ seed: v });
              }}
            />
            <SecondaryButton aria-label="Random seed" icon={<Shuffle className="h-4 w-4" />} onClick={() => update({ seed: Math.floor(Math.random() * 1e6) })} />
          </div>
        </Field>
      </div>
    </div>
  );
}

export function StepChannel({ goNext, hint }: StepProps) {
  const { params, updateParams, selection, setAutoTransmit, blocker } = useDemo();
  const validation = useMemo(() => validateParams(params), [params]);
  const mods = modsFor(selection);
  const pl = pathLossDb(params.distanceM, params.pathLossExponent);
  const snrs = mods.map((m) => ({ m, snr: linkSnrDb(params.snrDb, txAmplitude(params, m), params.distanceM, params.pathLossExponent) }));
  const shownSnr = Math.min(...snrs.map((s) => s.snr));

  const matches = (p: Partial<SimParams>) => Object.entries(p).every(([k, v]) => params[k as keyof SimParams] === v);

  return (
    <StepFrame
      title="Choose the wireless conditions"
      description="Real wireless signals encounter noise and lose strength as they travel. Adjust the simulated environment to see how reception changes."
      context="The SNR slider sets the receiver noise floor as measured 1 m from a reference transmitter. Moving further away lowers the signal at the receiver, so the SNR that actually reaches the receiver is shown on the right."
      primaryLabel="Transmit Signal"
      onPrimary={() => {
        if (!blocker(2)) setAutoTransmit(true);
        goNext();
      }}
      hint={hint}
    >
      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        <div className="space-y-6">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(CHANNEL_PRESETS) as (keyof typeof CHANNEL_PRESETS)[]).map((k) => {
              const pr = CHANNEL_PRESETS[k];
              const active = matches(pr.patch);
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={active}
                  onClick={() => updateParams(pr.patch)}
                  className={cx(
                    'flex items-center gap-2 rounded-xl border px-3.5 py-2 text-left text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                    active ? 'border-accent bg-accent-light/60 text-ink' : 'border-line bg-white text-ink-soft hover:bg-slate-50',
                  )}
                >
                  {k === 'clear' ? <Sun className="h-4 w-4 text-amber-500" aria-hidden /> : <CloudRain className="h-4 w-4 text-slate-500" aria-hidden />}
                  <span>
                    <span className="block font-medium text-ink">{pr.label}</span>
                    <span className="block text-xs text-ink-faint">{pr.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <ParameterSlider
            large
            label="Distance"
            value={params.distanceM}
            min={1}
            max={100}
            step={1}
            unit="m"
            onChange={(v) => updateParams({ distanceM: v })}
            tooltip="Transmitter-to-receiver distance. Signal amplitude falls with distance according to the path-loss model."
          />
          <ParameterSlider
            large
            label="Signal-to-noise ratio (SNR)"
            value={params.snrDb}
            min={-5}
            max={30}
            step={1}
            unit="dB"
            onChange={(v) => updateParams({ snrDb: v })}
            tooltip="Ec/N0 of a full-strength reference carrier at 1 m. Lower values mean a noisier receiver."
          />
          <ParameterSlider
            large
            label="Data rate"
            value={params.bitRate}
            min={500}
            max={2000}
            step={250}
            onChange={(v) => updateParams({ bitRate: v })}
            format={(v) => `${v} bit/s`}
            tooltip="Bits per second. The SNR is defined per bit, so a faster rate means less time (and energy) per bit at the same noise density."
          />
        </div>
        <div className="space-y-3">
          <ChannelIllustration distanceM={params.distanceM} effectiveSnrDb={shownSnr} pathLossDb={pl} fading={params.fading} interference={params.interference} />
          {snrs.length > 1 && (
            <p className="text-xs text-ink-faint">
              Receiver SNR: {snrs.map((s) => `${s.m} ${s.snr.toFixed(1)} dB`).join(' · ')} (ASK differs only when equal-energy ASK is on).
            </p>
          )}
          {validation.errors.map((e) => (
            <p key={e} role="alert" className="rounded-lg bg-bad-light px-3 py-2 text-sm text-bad">
              {e}
            </p>
          ))}
          {validation.warnings.map((w) => (
            <p key={w} className="rounded-lg bg-warn-light px-3 py-2 text-xs text-warn">
              {w}
            </p>
          ))}
          <TechNote>
            Received Ec/N0 = SNR<sub>1m</sub> + 20·log₁₀(A) − 10·n·log₁₀(d) [+ fading]. With n = {params.pathLossExponent.toFixed(1)}: path loss {pl.toFixed(1)} dB. Noise σ² is fixed by the
            SNR slider: σ² = N / (4·10^(SNR/10)) for N = {params.samplesPerBit} samples per bit.
          </TechNote>
        </div>
      </div>

      <div className="mt-6">
        <ExpandableSection title="Advanced settings">
          <AdvancedChannelSettings params={params} update={updateParams} />
          <div className="mt-5 flex justify-end">
            <SecondaryButton onClick={() => updateParams({ ...DEFAULT_PARAMS, distanceM: params.distanceM, snrDb: params.snrDb, bitRate: params.bitRate })}>
              Reset advanced settings
            </SecondaryButton>
          </div>
        </ExpandableSection>
      </div>
    </StepFrame>
  );
}
