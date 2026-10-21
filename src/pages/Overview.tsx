import { ArrowRight, BarChart3, FlaskConical, Radio, Thermometer } from 'lucide-react';
import { PipelineDiagram } from '../components/PipelineDiagram';
import { PrimaryButton, SecondaryButton } from '../components/ui';
import type { Page } from '../App';

const FEATURES = [
  { icon: Thermometer, title: 'Generate sensor data', text: 'A simulated node reads temperature and humidity and packs them into a checksummed packet.' },
  { icon: Radio, title: 'Transmit using ASK or FSK', text: 'Watch the bits become a real modulated waveform and travel through a noisy channel.' },
  { icon: BarChart3, title: 'Compare reception and performance', text: 'Measure bit errors and packet delivery for both schemes under identical conditions.' },
];

export function Overview({ navigate }: { navigate: (p: Page) => void }) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 py-2 lg:py-6">
      <section>
        <p className="mb-3 text-sm font-medium text-accent">ASK vs FSK · Wireless Sensor Links</p>
        <h1 className="max-w-3xl text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl">Understand how wireless signals carry data.</h1>
        <p className="mt-4 max-w-2xl text-[17px] leading-relaxed text-ink-soft">
          Explore ASK and FSK modulation, simulate a wireless sensor link, and compare how both techniques perform under different channel conditions.
        </p>
        <div className="mt-7 flex flex-wrap gap-3">
          <PrimaryButton size="lg" onClick={() => navigate('demo')}>
            Start Guided Demo <ArrowRight className="h-4 w-4" />
          </PrimaryButton>
          <SecondaryButton size="lg" icon={<FlaskConical className="h-4 w-4" />} onClick={() => navigate('experiments')}>
            Explore Experiments
          </SecondaryButton>
        </div>
      </section>

      <section aria-label="Communication pipeline" className="rounded-2xl border border-line bg-white/70 px-5 py-4">
        <PipelineDiagram compact />
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {FEATURES.map(({ icon: Icon, title, text }, i) => (
          <div key={title} className="flex gap-4">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h2 className="font-medium text-ink">
                <span className="mr-1.5 text-ink-faint">{i + 1}.</span>
                {title}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">{text}</p>
            </div>
          </div>
        ))}
      </section>

      <section aria-label="Project information" className="rounded-2xl border border-line bg-white p-5">
        <dl className="grid gap-x-8 gap-y-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          {[
            ['Project', 'Modulation Comparison for Wireless Sensor Links Using ASK & FSK'],
            ['Subject', 'Short Range Wireless Communication'],
            ['Simulation type', 'Software-based'],
            ['Hardware required', 'None'],
          ].map(([k, v]) => (
            <div key={k}>
              <dt className="text-xs uppercase tracking-wide text-ink-faint">{k}</dt>
              <dd className="mt-0.5 font-medium text-ink">{v}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
