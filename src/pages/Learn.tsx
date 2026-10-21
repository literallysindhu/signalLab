import { ChevronLeft, ChevronRight, FlaskConical } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { applyChannel, DEFAULT_PARAMS, fskMarkHz, fskSpaceHz, modulate, Rng, sampleRateOf, waveformConfig, type Modulation } from '../engine';
import { PipelineDiagram } from '../components/PipelineDiagram';
import { ParameterSlider } from '../components/ParameterSlider';
import { COLORS, WaveformChart } from '../components/SignalChart';
import { EmptyState, ExpandableSection, inputCls, PageHeader, SecondaryButton, Segmented, StatusBadge } from '../components/ui';
import { observations } from '../lib/export';
import { useExperimentHistory } from '../lib/experimentStore';
import { fmtDate } from '../lib/format';
import { useDemo } from './demo/DemoContext';
import type { Page } from '../App';

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-6">
      <h2 id={`${id}-h`} className="mb-3 text-lg font-semibold text-ink">
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-ink-soft">{children}</div>
    </section>
  );
}

const Eq = ({ children }: { children: ReactNode }) => <div className="rounded-lg bg-slate-100 px-4 py-2.5 font-mono text-[13px] text-ink">{children}</div>;

/** Step-by-step: shows the waveform growing one bit at a time from the real modulator. */
function WaveBuilder() {
  const [text, setText] = useState('1011001');
  const [mod, setMod] = useState<Modulation>('ASK');
  const [shown, setShown] = useState(1);
  const bits = useMemo(() => Uint8Array.from(text.replace(/[^01]/g, '').slice(0, 16), (c) => Number(c)), [text]);
  const p = DEFAULT_PARAMS;
  const signal = useMemo(() => (bits.length ? modulate(mod, bits, waveformConfig(p, mod)) : undefined), [bits, mod, p]);
  const n = bits.length;
  const k = Math.min(shown, n);
  const cur = k > 0 ? bits[k - 1] : null;

  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-4 flex flex-wrap items-end gap-4">
        <label className="text-sm font-medium text-ink">
          Bits (up to 16)
          <input
            className={`${inputCls} mt-1.5 w-48 font-mono`}
            value={text}
            onChange={(e) => {
              setText(e.target.value.replace(/[^01]/g, '').slice(0, 16));
              setShown(1);
            }}
            aria-describedby="bits-help"
          />
        </label>
        <Segmented label="Modulation" value={mod} onChange={setMod} options={[{ value: 'ASK', label: 'ASK' }, { value: 'FSK', label: 'FSK' }]} />
        <div className="flex items-center gap-2">
          <SecondaryButton aria-label="Previous bit" icon={<ChevronLeft className="h-4 w-4" />} onClick={() => setShown((s) => Math.max(1, s - 1))} disabled={k <= 1} />
          <span className="w-20 text-center font-mono text-sm text-ink">
            {k} / {n}
          </span>
          <SecondaryButton aria-label="Next bit" icon={<ChevronRight className="h-4 w-4" />} onClick={() => setShown((s) => Math.min(n, s + 1))} disabled={k >= n} />
          <SecondaryButton onClick={() => setShown(n)} disabled={k >= n}>
            Show all
          </SecondaryButton>
        </div>
      </div>
      <p id="bits-help" className="sr-only">
        Type a binary sequence using 0 and 1.
      </p>
      {n === 0 ? (
        <p className="text-sm text-bad">Enter at least one bit (0 or 1).</p>
      ) : (
        <>
          <div className="mb-2 flex font-mono text-sm">
            {Array.from(bits, (b, i) => (
              <span key={i} className={`flex-1 text-center ${i < k ? (i === k - 1 ? 'font-bold text-accent' : 'text-ink') : 'text-slate-300'}`}>
                {b}
              </span>
            ))}
          </div>
          <WaveformChart
            series={[{ key: 's', label: mod, color: COLORS[mod], data: signal }]}
            sampleRate={sampleRateOf(p)}
            bitRate={p.bitRate}
            startBit={0}
            endBit={n}
            revealBits={k}
            height={200}
            ariaLabel={`${mod} waveform for ${text}`}
          />
          <p className="mt-2 text-sm text-ink" aria-live="polite">
            Bit {k} is <span className="font-mono font-semibold">{cur}</span>:{' '}
            {mod === 'ASK'
              ? cur
                ? `the ${p.carrierHz / 1000} kHz carrier is switched on at full amplitude.`
                : 'the carrier is switched off (amplitude 0).'
              : cur
                ? `the transmitter uses the mark frequency f1 = ${fskMarkHz(p) / 1000} kHz.`
                : `the transmitter uses the space frequency f0 = ${fskSpaceHz(p) / 1000} kHz.`}
          </p>
        </>
      )}
    </div>
  );
}

/** Shows how the same bits look after AWGN at a chosen SNR (real channel code). */
function NoiseDemo() {
  const [snr, setSnr] = useState(12);
  const [mod, setMod] = useState<Modulation>('FSK');
  const p = DEFAULT_PARAMS;
  const bits = useMemo(() => Uint8Array.from([1, 0, 1, 1, 0, 0, 1, 0]), []);
  const { tx, rx } = useMemo(() => {
    const t = modulate(mod, bits, waveformConfig(p, mod));
    const ch = applyChannel(t, { distanceM: 1, snrDb: snr, pathLossExponent: 2, samplesPerBit: p.samplesPerBit, sampleRate: sampleRateOf(p), fading: false, interference: false, interferenceDb: -20, interferenceHz: 4500 }, new Rng(11));
    return { tx: t, rx: ch.rx };
  }, [snr, mod, bits, p]);
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-3 grid items-end gap-4 sm:grid-cols-[1fr_auto]">
        <ParameterSlider label="SNR (Ec/N0)" value={snr} min={-5} max={30} step={1} unit="dB" onChange={setSnr} />
        <Segmented label="Modulation" value={mod} onChange={setMod} options={[{ value: 'ASK', label: 'ASK' }, { value: 'FSK', label: 'FSK' }]} />
      </div>
      <WaveformChart
        series={[
          { key: 'rx', label: 'Received (noisy)', color: COLORS.rx, data: rx, width: 1 },
          { key: 'tx', label: 'Transmitted', color: COLORS[mod], data: tx, width: 1.6 },
        ]}
        sampleRate={sampleRateOf(p)}
        bitRate={p.bitRate}
        startBit={0}
        endBit={8}
        height={200}
        ariaLabel="Transmitted versus noisy received waveform"
      />
      <p className="mt-2 text-xs text-ink-faint">Bits 1 0 1 1 0 0 1 0 at 1 m. Grey: what the receiver sees. Coloured: what was sent.</p>
    </div>
  );
}

function Conclusion({ navigate }: { navigate: (p: Page) => void }) {
  const { list } = useExperimentHistory();
  const { comparison } = useDemo();
  const both = list.find((r) => r.config.modulations.length === 2);
  if (!both && !comparison) {
    return (
      <EmptyState
        icon={<FlaskConical className="h-8 w-8" />}
        title="No results to draw conclusions from yet"
        action={<SecondaryButton onClick={() => navigate('experiments')}>Go to Experiments</SecondaryButton>}
      >
        This section is written from your own simulations. Run an experiment that includes both ASK and FSK (or finish the Guided Demo comparison) and the conclusion will appear here.
      </EmptyState>
    );
  }
  const source = both ?? comparison!.runs[1];
  const obs = observations(source);
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-medium text-ink">Based on: {source.config.name}</span>
        <StatusBadge>{fmtDate(source.startedAt)}</StatusBadge>
        {source.config.isDemo && <StatusBadge tone="info">Demonstration preset</StatusBadge>}
      </div>
      <ul className="list-disc space-y-1.5 pl-5 text-[15px] text-ink-soft">
        {obs.map((o) => (
          <li key={o}>{o}</li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-ink-soft">
        In theory, a non-coherent FSK receiver tolerates amplitude disturbances better than a fixed-threshold OOK receiver at equal peak amplitude, while
        OOK uses less transmit energy and bandwidth. Whether that holds for your settings is shown by the measured results above, not assumed.
      </p>
    </div>
  );
}

export function Learn({ navigate }: { navigate: (p: Page) => void }) {
  const toc = [
    ['link', 'Wireless sensor links'],
    ['modulation', 'How modulation works'],
    ['ask-fsk', 'ASK and FSK'],
    ['noise', 'Channel noise'],
    ['metrics', 'BER and PDR'],
    ['limits', 'Limitations'],
    ['conclusion', 'Conclusion from your results'],
  ];
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Learn" subtitle="The ideas behind the simulator, in short sections. Expand any topic for the technical detail." />
      <div className="grid gap-10 lg:grid-cols-[200px_minmax(0,1fr)]">
        <nav aria-label="On this page" className="hidden lg:block">
          <ul className="sticky top-6 space-y-1 text-sm">
            {toc.map(([id, label]) => (
              <li key={id}>
                <a href={`#learn-${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }} className="block rounded-lg px-3 py-1.5 text-ink-soft hover:bg-slate-100 hover:text-ink">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>

        <div className="max-w-3xl space-y-12">
          <Section id="link" title="What is a wireless sensor link?">
            <p>
              A wireless sensor node measures something (here: temperature and humidity) and sends it by radio to a receiver, such as a gateway. Short-range links like these are used in
              smart buildings, agriculture, industrial monitoring and environmental sensing, where nodes are small, battery-powered and send short packets.
            </p>
            <PipelineDiagram detailed />
            <ExpandableSection title="Packet format used in this simulator">
              <table className="w-full text-left text-[13px]">
                <thead className="text-xs uppercase text-ink-faint">
                  <tr>
                    <th className="py-1">Bytes</th>
                    <th>Field</th>
                    <th>Encoding</th>
                  </tr>
                </thead>
                <tbody className="font-mono text-ink">
                  {[
                    ['1', 'Sync', '0x7E'],
                    ['1', 'Sensor ID', 'uint8 (1–255)'],
                    ['2', 'Sequence number', 'uint16'],
                    ['4', 'Timestamp', 'uint32 Unix seconds'],
                    ['2', 'Temperature', 'int16, °C × 100'],
                    ['2', 'Humidity', 'uint16, % × 100'],
                    ['1', 'Padding length P', 'uint8 (0–64)'],
                    ['P', 'Padding', 'deterministic filler'],
                    ['2', 'Checksum', 'CRC-16/CCITT-FALSE'],
                  ].map((r) => (
                    <tr key={r[1]} className="border-t border-line">
                      <td className="py-1">{r[0]}</td>
                      <td className="font-sans">{r[1]}</td>
                      <td>{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2">Big-endian, bits sent most-significant first. Base frame: 15 bytes = 120 bits. Every bit, including header and CRC, is modulated and counted in the BER.</p>
            </ExpandableSection>
          </Section>

          <Section id="modulation" title="How modulation works">
            <p>
              Bits cannot travel through the air directly. The transmitter changes a property of a sine-wave <em>carrier</em> according to each bit: its amplitude (ASK) or its frequency
              (FSK). Step through a bit sequence to see the waveform being built by the simulator's modulator.
            </p>
            <WaveBuilder />
          </Section>

          <Section id="ask-fsk" title="ASK and FSK">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-line bg-white p-5">
                <h3 className="font-semibold text-ask">Amplitude Shift Keying</h3>
                <p className="mt-2 text-sm">Bits change the carrier's strength. This simulator uses on-off keying (OOK): carrier on for 1, off for 0.</p>
                <div className="mt-3">
                  <Eq>s(t) = A(b) · sin(2π fc t), A(1) = A, A(0) = 0</Eq>
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-white p-5">
                <h3 className="font-semibold text-fsk">Frequency Shift Keying</h3>
                <p className="mt-2 text-sm">Bits change the carrier's frequency; amplitude stays constant. The phase is continuous across bits (CP-FSK).</p>
                <div className="mt-3">
                  <Eq>s(t) = A · sin(φ(t)), dφ/dt = 2π f(b), f(0) = f0, f(1) = f1</Eq>
                </div>
              </div>
            </div>
            <ExpandableSection title="Why ASK reacts more to amplitude disturbances">
              <p>
                An OOK receiver decides each bit by asking "is the carrier strong enough?" It measures the envelope â = (2/N)·√(I² + Q²) at fc and compares it with a fixed threshold
                (a fraction of the amplitude it expects at that distance). Anything that changes the received amplitude moves â relative to that threshold: extra path loss, fading dips,
                or noise. A 1 can fall below the threshold, or noise alone can push a 0 above it.
              </p>
              <p className="mt-2">
                A binary FSK receiver instead compares the energy at two frequencies, E1 vs E0, and picks the larger. Scaling the whole signal up or down scales both energies together,
                so the decision does not depend on knowing the absolute level. Noise still causes errors when it makes the wrong tone look stronger, and a narrow-band interferer near one
                tone can bias it. FSK pays for this robustness with more bandwidth (about Δf + 2Rb) and with transmitting the carrier for every bit, so it uses more energy than OOK.
              </p>
            </ExpandableSection>
            <ExpandableSection title="Demodulator details">
              <p>Both receivers are non-coherent and assume perfect bit timing. For bit interval k with N samples:</p>
              <div className="mt-2 space-y-2">
                <Eq>I = Σ r[n]·cos(2π f n / fs), Q = Σ r[n]·sin(2π f n / fs)</Eq>
                <Eq>ASK: b = 1 if (2/N)·√(I²+Q²) &gt; τ·A·g(d), else 0</Eq>
                <Eq>FSK: b = 1 if E(f1) &gt; E(f0), with E = I² + Q²</Eq>
              </div>
              <p className="mt-2">τ is the ASK threshold setting, A the transmit amplitude and g(d) the path-loss gain the receiver is calibrated for. The receiver does not know the fading gain.</p>
            </ExpandableSection>
          </Section>

          <Section id="noise" title="How channel noise affects communication">
            <p>
              The signal weakens with distance and picks up random noise. The ratio of signal energy to noise (SNR) decides how often a bit is misread. Move the slider to see the same
              bits at different SNRs.
            </p>
            <NoiseDemo />
            <ExpandableSection title="Channel model equations">
              <div className="space-y-2">
                <Eq>r[n] = h · g(d) · s[n] + i[n] + w[n]</Eq>
                <Eq>Path loss PL(d) = 10 · n · log10(d / 1 m) dB, g(d) = 10^(−PL/20)</Eq>
                <Eq>w[n] ~ N(0, σ²), σ² = N / (4 · 10^(SNR/10)) for reference amplitude 1</Eq>
                <Eq>h ~ Rayleigh with E[h²] = 1 (block fading, one value per packet)</Eq>
                <Eq>i[n] = Aᵢ · sin(2π fᵢ n / fs + θ) (optional interferer)</Eq>
              </div>
              <p className="mt-2">
                SNR is defined as Ec/N0: the energy of one bit-length of full-amplitude carrier divided by the noise spectral density. For FSK this equals Eb/N0; for OOK at equal peak
                amplitude the average Eb/N0 is 3 dB lower because no energy is sent for 0 bits.
              </p>
            </ExpandableSection>
          </Section>

          <Section id="metrics" title="What BER and PDR measure">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-line bg-white p-5">
                <h3 className="font-semibold text-ink">Bit Error Rate</h3>
                <p className="mt-2 text-sm">The fraction of bits the receiver got wrong.</p>
                <div className="mt-3">
                  <Eq>BER = incorrect recovered bits / total transmitted bits compared</Eq>
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-white p-5">
                <h3 className="font-semibold text-ink">Packet Delivery Ratio</h3>
                <p className="mt-2 text-sm">The share of packets that arrived intact and valid.</p>
                <div className="mt-3 space-y-2">
                  <Eq>PDR = valid packets delivered / packets transmitted × 100 %</Eq>
                  <Eq>Packet loss = 100 % − PDR</Eq>
                </div>
              </div>
            </div>
            <p className="text-sm">
              A packet counts as delivered only if the CRC passes, every field is in range and every recovered bit matches what was sent. One wrong bit anywhere fails the whole packet,
              which is why PDR drops sharply once BER rises above about 1/(packet length).
            </p>
          </Section>

          <Section id="limits" title="Limitations of this simulation">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Frequencies are scaled down (kHz instead of MHz/GHz) so each cycle can be sampled and drawn; signals are real-valued passband samples.</li>
              <li>Amplitudes and energies are in normalised units, not watts or dBm. The SNR is defined at a 1 m reference, not derived from real transmitter power or antenna gains.</li>
              <li>The receiver has perfect bit timing and frame alignment; real receivers need preambles, clock recovery and carrier detection.</li>
              <li>Path loss is a simple log-distance model; fading is flat Rayleigh block fading; interference is a single tone. There is no multipath delay spread, Doppler or shadowing.</li>
              <li>Processing time is JavaScript compute time in your browser, not radio or hardware latency. On-air time is reported separately as bits ÷ bit rate.</li>
              <li>The energy estimate counts radiated signal energy only, not oscillator, amplifier or microcontroller power.</li>
              <li>Results are software simulations and must not be presented as hardware measurements.</li>
            </ul>
          </Section>

          <Section id="conclusion" title="Conclusion from your results">
            <Conclusion navigate={navigate} />
          </Section>
        </div>
      </div>
    </div>
  );
}
