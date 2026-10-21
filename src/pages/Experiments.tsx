import { FileJson, FileText, FlaskConical, History, Loader2, Play, Sparkles, Trash2, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
  bestPoint,
  DEFAULT_PARAMS,
  experimentPacketCount,
  METRIC_INFO,
  validateExperiment,
  type ExperimentConfig,
  type ExperimentPoint,
  type ExperimentResult,
  type MetricKey,
  type Modulation,
  type SimParams,
} from '../engine';
import { ExperimentResultsTable } from '../components/ExperimentResultsTable';
import { EnergyChart, SweepChart } from '../components/SweepChart';
import { Banner, Card, EmptyState, ExpandableSection, Field, inputCls, PageHeader, PrimaryButton, ProgressBar, SecondaryButton, Segmented, StatusBadge, TechNote, cx } from '../components/ui';
import { downloadFile, experimentSummary, experimentToJson, observations, pointsToCsv, safeFileName } from '../lib/export';
import { useExperimentHistory } from '../lib/experimentStore';
import { fmtBer, fmtDate, fmtMs, fmtNum, fmtPct, parseNumberList } from '../lib/format';
import { loadJSON, saveJSON, STORAGE_KEYS } from '../lib/storage';
import { useExperimentRunner } from '../lib/useExperimentRunner';
import { AdvancedChannelSettings } from './demo/StepChannel';

interface Draft {
  name: string;
  mods: 'ASK' | 'FSK' | 'BOTH';
  snr: string;
  distance: string;
  payload: string;
  packets: string;
  repetitions: string;
  params: SimParams;
}

const DEFAULT_DRAFT: Draft = {
  name: 'BER vs SNR sweep',
  mods: 'BOTH',
  snr: '0, 5, 10, 15, 20, 25',
  distance: '1',
  payload: '10',
  packets: '100',
  repetitions: '1',
  params: { ...DEFAULT_PARAMS },
};

/** Built-in demonstration presets. Their results are labelled as demonstrations. */
const PRESETS: { title: string; description: string; draft: Omit<Draft, 'params'>; patch?: Partial<SimParams> }[] = [
  {
    title: 'BER vs SNR',
    description: 'Both schemes at 1 m, SNR 0–25 dB, 100 packets per point',
    draft: { name: 'Demo: BER vs SNR', mods: 'BOTH', snr: '0, 5, 10, 15, 20, 25', distance: '1', payload: '10', packets: '100', repetitions: '1' },
  },
  {
    title: 'PDR vs distance',
    description: 'Both schemes at SNR 30 dB, 1–50 m, 100 packets per point',
    draft: { name: 'Demo: PDR vs distance', mods: 'BOTH', snr: '30', distance: '1, 5, 10, 15, 20, 30, 50', payload: '10', packets: '100', repetitions: '1' },
  },
  {
    title: 'Fading channel',
    description: 'Rayleigh fading, SNR sweep, 3 repetitions for error bars',
    draft: { name: 'Demo: Fading channel', mods: 'BOTH', snr: '10, 15, 20, 25, 30', distance: '1', payload: '10', packets: '100', repetitions: '3' },
    patch: { fading: true },
  },
];

function buildConfig(d: Draft, isDemo = false): { config?: ExperimentConfig; errors: string[] } {
  const errors: string[] = [];
  const snr = parseNumberList(d.snr);
  const dist = parseNumberList(d.distance);
  const pay = parseNumberList(d.payload);
  if (snr.error) errors.push(`SNR values: ${snr.error}`);
  if (dist.error) errors.push(`Distances: ${dist.error}`);
  if (pay.error) errors.push(`Payload sizes: ${pay.error}`);
  const packets = Number(d.packets);
  const reps = Number(d.repetitions);
  if (pay.values.some((v) => !Number.isInteger(v) || v < 10 || v > 74)) errors.push('Payload sizes must be whole numbers from 10 to 74 bytes.');
  if (errors.length) return { errors };
  const config: ExperimentConfig = {
    name: d.name.trim() || 'Untitled experiment',
    modulations: d.mods === 'BOTH' ? ['ASK', 'FSK'] : [d.mods],
    snrValues: snr.values,
    distanceValues: dist.values,
    paddingValues: pay.values.map((v) => v - 10),
    packetsPerPoint: packets,
    repetitions: reps,
    base: d.params,
    isDemo,
  };
  const v = validateExperiment(config);
  return v.length ? { errors: v } : { config, errors: [] };
}

export function Experiments() {
  const [draft, setDraft] = useState<Draft>(() => {
    const saved = loadJSON<Partial<Draft> | null>(STORAGE_KEYS.experimentDraft, null);
    return saved ? { ...DEFAULT_DRAFT, ...saved, params: { ...DEFAULT_PARAMS, ...(saved.params ?? {}) } } : DEFAULT_DRAFT;
  });
  const [isDemo, setIsDemo] = useState(false);
  const { list, add, remove, clear } = useExperimentHistory();
  const [selectedId, setSelectedId] = useState<string | null>(list[0]?.id ?? null);
  const [runError, setRunError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const runner = useExperimentRunner();

  useEffect(() => {
    saveJSON(STORAGE_KEYS.experimentDraft, draft);
  }, [draft]);

  const built = useMemo(() => buildConfig(draft, isDemo), [draft, isDemo]);
  const total = built.config ? experimentPacketCount(built.config) : 0;
  const estSeconds = (total * 0.4 * (draft.params.samplesPerBit / 32)) / 1000;
  const selected = list.find((r) => r.id === selectedId) ?? list[0] ?? null;

  const set = (patch: Partial<Draft>) => {
    setIsDemo(false);
    setDraft((d) => ({ ...d, ...patch }));
  };

  async function run() {
    if (!built.config) return;
    setRunError(null);
    try {
      const result = await runner.run(built.config);
      const ok = add(result);
      setSaveWarning(!ok);
      setSelectedId(result.id);
    } catch (e) {
      const msg = (e as Error).message;
      if (!/cancelled/i.test(msg)) setRunError(msg);
    }
  }

  function applyPreset(p: (typeof PRESETS)[number]) {
    setDraft({ ...p.draft, params: { ...DEFAULT_PARAMS, ...(p.patch ?? {}) } });
    setIsDemo(true);
  }

  const pct = runner.progress ? (runner.progress.donePackets / runner.progress.totalPackets) * 100 : 0;

  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Experiments" subtitle="Run controlled parameter sweeps and compare ASK and FSK with measured simulation results. Completed experiments are saved in this browser." />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Card>
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
              <Field label="Experiment name" htmlFor="ename">
                <input id="ename" className={inputCls} value={draft.name} onChange={(e) => set({ name: e.target.value })} maxLength={80} />
              </Field>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-ink">Modulation</span>
                <Segmented
                  label="Modulation"
                  value={draft.mods}
                  onChange={(v) => set({ mods: v })}
                  options={[
                    { value: 'ASK', label: 'ASK' },
                    { value: 'FSK', label: 'FSK' },
                    { value: 'BOTH', label: 'Both' },
                  ]}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="SNR values (dB)" htmlFor="esnr" hint="e.g. 0, 5, 10 or 0:5:25">
                <input id="esnr" className={cx(inputCls, 'font-mono')} value={draft.snr} onChange={(e) => set({ snr: e.target.value })} />
              </Field>
              <Field label="Distances (m)" htmlFor="edist" hint="e.g. 1, 5, 10, 20, 50">
                <input id="edist" className={cx(inputCls, 'font-mono')} value={draft.distance} onChange={(e) => set({ distance: e.target.value })} />
              </Field>
              <Field label="Packets per test point" htmlFor="epk" hint="1 to 5000">
                <input id="epk" inputMode="numeric" className={cx(inputCls, 'font-mono')} value={draft.packets} onChange={(e) => set({ packets: e.target.value })} />
              </Field>
            </div>

            <ExpandableSection title="More sweep options">
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Payload sizes (bytes)" htmlFor="epay" hint="10 = sensor fields only; up to 74">
                  <input id="epay" className={cx(inputCls, 'font-mono')} value={draft.payload} onChange={(e) => set({ payload: e.target.value })} />
                </Field>
                <Field label="Independent repetitions" htmlFor="erep" hint="Gives ±1σ error bars (1–20)">
                  <input id="erep" inputMode="numeric" className={cx(inputCls, 'font-mono')} value={draft.repetitions} onChange={(e) => set({ repetitions: e.target.value })} />
                </Field>
                <Field label="Bit rate (bit/s)" htmlFor="ebr" hint="Carrier must stay below fs/2">
                  <select id="ebr" className={inputCls} value={draft.params.bitRate} onChange={(e) => set({ params: { ...draft.params, bitRate: Number(e.target.value) } })}>
                    {[500, 750, 1000, 1250, 1500, 2000].map((v) => (
                      <option key={v} value={v}>
                        {v}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </ExpandableSection>
            <ExpandableSection title="Channel and receiver settings">
              <p className="mb-4 text-xs text-ink-faint">Distance and SNR come from the sweep above; everything else here applies to every test point.</p>
              <AdvancedChannelSettings params={draft.params} update={(p) => set({ params: { ...draft.params, ...p } })} />
            </ExpandableSection>

            {built.errors.length > 0 && (
              <div className="space-y-1">
                {built.errors.map((e) => (
                  <p key={e} role="alert" className="rounded-lg bg-bad-light px-3 py-2 text-sm text-bad">
                    {e}
                  </p>
                ))}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
              <p className="text-sm text-ink-soft">
                {built.config ? (
                  <>
                    <span className="font-mono text-ink">{total.toLocaleString()}</span> packets · about {estSeconds < 1 ? '1' : estSeconds.toFixed(0)} s
                    {isDemo && <StatusBadge tone="info" className="ml-2">Demonstration preset</StatusBadge>}
                  </>
                ) : (
                  'Fix the highlighted settings to run.'
                )}
              </p>
              {runner.running ? (
                <SecondaryButton size="lg" icon={<X className="h-4 w-4" />} onClick={runner.cancel}>
                  Cancel
                </SecondaryButton>
              ) : (
                <PrimaryButton size="lg" icon={<Play className="h-4 w-4" />} onClick={() => void run()} disabled={!built.config}>
                  Run Experiment
                </PrimaryButton>
              )}
            </div>

            {runner.running && (
              <div className="rounded-xl bg-slate-50 p-4" aria-live="polite">
                <div className="mb-2 flex items-center gap-2 text-sm text-ink">
                  <Loader2 className="h-4 w-4 animate-spin text-accent motion-reduce:animate-none" aria-hidden />
                  {runner.progress ? `${Math.round(pct)} % · ${runner.progress.donePackets.toLocaleString()} / ${runner.progress.totalPackets.toLocaleString()} packets` : 'Starting…'}
                </div>
                <ProgressBar value={pct} label="Experiment progress" />
                {runner.progress && (
                  <p className="mt-2 font-mono text-xs text-ink-faint">
                    Now: {runner.progress.current.modulation} · SNR {runner.progress.current.snrDb} dB · {runner.progress.current.distanceM} m · {runner.progress.current.payloadBytes} B
                  </p>
                )}
              </div>
            )}
            {runError && (
              <Banner tone="error" title="Experiment failed">
                {runError}
              </Banner>
            )}
            {saveWarning && (
              <Banner tone="warning" title="Result not saved">
                The browser refused to store the result (storage full or disabled). Export it now to keep a copy.
              </Banner>
            )}
          </div>
        </Card>

        <div className="space-y-4">
          <div>
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-ink">
              <Sparkles className="h-4 w-4 text-accent" aria-hidden /> Try an example
            </div>
            <div className="space-y-2">
              {PRESETS.map((p) => (
                <button
                  key={p.title}
                  type="button"
                  onClick={() => applyPreset(p)}
                  className="w-full rounded-xl border border-line bg-white px-4 py-3 text-left hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
                >
                  <div className="text-sm font-medium text-ink">{p.title}</div>
                  <div className="text-xs text-ink-faint">{p.description}</div>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-ink-faint">Presets only fill in the form. Click Run Experiment to generate results; they are labelled as demonstrations.</p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium text-ink">
                <History className="h-4 w-4 text-ink-faint" aria-hidden /> Saved experiments
              </span>
              {list.length > 0 && !confirmClear && (
                <button type="button" onClick={() => setConfirmClear(true)} className="text-xs text-ink-faint hover:text-bad">
                  Clear all
                </button>
              )}
            </div>
            {confirmClear && (
              <div role="alertdialog" aria-label="Confirm clearing history" className="mb-2 rounded-xl border border-red-200 bg-bad-light/60 p-3 text-sm">
                <p className="text-ink">Delete all {list.length} saved experiments? This cannot be undone.</p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    className="rounded-lg bg-bad px-3 py-1.5 text-xs font-medium text-white hover:bg-red-800"
                    onClick={() => {
                      clear();
                      setConfirmClear(false);
                      setSelectedId(null);
                    }}
                  >
                    Delete all
                  </button>
                  <button type="button" className="rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-medium" onClick={() => setConfirmClear(false)}>
                    Keep
                  </button>
                </div>
              </div>
            )}
            {list.length === 0 ? (
              <p className="rounded-xl border border-dashed border-slate-300 px-4 py-6 text-center text-xs text-ink-faint">No experiments yet.</p>
            ) : (
              <ul className="max-h-72 space-y-1.5 overflow-auto pr-1">
                {list.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(r.id)}
                      aria-current={selected?.id === r.id}
                      className={cx(
                        'w-full rounded-lg px-3 py-2 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                        selected?.id === r.id ? 'bg-accent-light/60' : 'hover:bg-slate-100',
                      )}
                    >
                      <div className="truncate text-sm font-medium text-ink">{r.config.name}</div>
                      <div className="text-xs text-ink-faint">
                        {fmtDate(r.startedAt)} · {r.totalPackets.toLocaleString()} pkts
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      <section className="mt-10" aria-label="Experiment results">
        {selected ? (
          <ResultView result={selected} onDelete={() => remove(selected.id)} />
        ) : (
          <EmptyState icon={<FlaskConical className="h-8 w-8" />} title="No results yet">
            Configure a sweep above, or pick an example, then click Run Experiment. Results, charts and exports will appear here.
          </EmptyState>
        )}
      </section>
    </div>
  );
}

type ChartKind = 'ber-snr' | 'pdr-dist' | 'loss-snr' | 'time-payload' | 'energy';

function ResultView({ result, onDelete }: { result: ExperimentResult; onDelete: () => void }) {
  const c = result.config;
  const [metric, setMetric] = useState<MetricKey>('pdr');
  const best = useMemo(() => bestPoint(result.points, metric), [result, metric]);
  const obs = useMemo(() => observations(result), [result]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const charts: { id: ChartKind; label: string; ok: boolean }[] = [
    { id: 'ber-snr', label: 'BER vs SNR', ok: c.snrValues.length > 1 },
    { id: 'pdr-dist', label: 'PDR vs distance', ok: c.distanceValues.length > 1 },
    { id: 'loss-snr', label: 'Loss vs SNR', ok: c.snrValues.length > 1 },
    { id: 'time-payload', label: 'Time vs payload', ok: c.paddingValues.length > 1 },
    { id: 'energy', label: 'Energy vs delivery', ok: result.points.length > 1 },
  ];
  const firstOk = charts.find((x) => x.ok)?.id ?? 'ber-snr';
  const [chart, setChart] = useState<ChartKind>(firstOk);
  useEffect(() => setChart(firstOk), [result.id, firstOk]);

  // For multi-dimensional sweeps, pick fixed values for the dimensions not on the x-axis.
  const [fixSnr, setFixSnr] = useState(c.snrValues[c.snrValues.length - 1]);
  const [fixDist, setFixDist] = useState(c.distanceValues[0]);
  const [fixPay, setFixPay] = useState(c.paddingValues[0] + 10);
  useEffect(() => {
    setFixSnr(c.snrValues[c.snrValues.length - 1]);
    setFixDist(c.distanceValues[0]);
    setFixPay(c.paddingValues[0] + 10);
  }, [result.id, c]);

  const xKey = chart === 'pdr-dist' ? 'distanceM' : chart === 'time-payload' ? 'payloadBytes' : 'snrDb';
  const filtered = result.points.filter(
    (p) => (xKey === 'snrDb' || p.snrDb === fixSnr) && (xKey === 'distanceM' || p.distanceM === fixDist) && (xKey === 'payloadBytes' || p.payloadBytes === fixPay),
  );
  const fileBase = safeFileName(c.name);

  const pooled = (m: Modulation) => {
    const pts = result.points.filter((p) => p.modulation === m);
    if (!pts.length) return null;
    const sent = pts.reduce((a, p) => a + p.packetsSent, 0);
    const del = pts.reduce((a, p) => a + p.packetsDelivered, 0);
    const err = pts.reduce((a, p) => a + p.bitErrors, 0);
    const bits = pts.reduce((a, p) => a + p.bitsCompared, 0);
    return { pdr: (del / sent) * 100, ber: err / bits, del, sent, time: pts.reduce((a, p) => a + p.avgProcessingMs, 0) / pts.length };
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-ink">{c.name}</h2>
            {c.isDemo && <StatusBadge tone="info">Demonstration preset</StatusBadge>}
            <StatusBadge>Software simulation</StatusBadge>
          </div>
          <p className="mt-1 text-sm text-ink-soft">
            {fmtDate(result.startedAt)} · {c.modulations.join(' + ')} · {result.points.length} test points · {c.packetsPerPoint} packets × {c.repetitions} rep. · seed {c.base.seed}
            {c.base.fading ? ' · fading' : ''}
            {c.base.interference ? ' · interference' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <SecondaryButton icon={<FileText className="h-4 w-4" />} onClick={() => downloadFile(`${fileBase}.csv`, pointsToCsv(result.points), 'text/csv')}>
            CSV
          </SecondaryButton>
          <SecondaryButton icon={<FileJson className="h-4 w-4" />} onClick={() => downloadFile(`${fileBase}.json`, experimentToJson(result), 'application/json')}>
            JSON
          </SecondaryButton>
          <SecondaryButton icon={<FileText className="h-4 w-4" />} onClick={() => downloadFile(`${fileBase}-summary.txt`, experimentSummary(result), 'text/plain')}>
            Summary
          </SecondaryButton>
          {confirmDelete ? (
            <span className="flex items-center gap-2 rounded-xl border border-red-200 bg-bad-light/60 px-3 text-sm">
              Delete?
              <button type="button" className="font-medium text-bad" onClick={onDelete}>
                Yes
              </button>
              <button type="button" className="text-ink-soft" onClick={() => setConfirmDelete(false)}>
                No
              </button>
            </span>
          ) : (
            <SecondaryButton aria-label="Delete this experiment" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirmDelete(true)} />
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {c.modulations.map((m) => {
          const p = pooled(m)!;
          return (
            <div key={m} className="grid grid-cols-3 gap-3 rounded-2xl border border-line bg-white p-4">
              <div className="col-span-3 flex items-center gap-2 text-sm font-semibold" style={{ color: m === 'ASK' ? '#2563EB' : '#7C3AED' }}>
                {m} <span className="font-normal text-ink-faint">· all test points pooled</span>
              </div>
              <Stat label="BER" value={fmtBer(p.ber)} />
              <Stat label="PDR" value={fmtPct(p.pdr)} hint={`${p.del}/${p.sent}`} />
              <Stat label="Proc. time" value={fmtMs(p.time)} />
            </div>
          );
        })}
      </div>

      <div className="rounded-2xl border border-line bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div role="tablist" aria-label="Charts" className="flex flex-wrap gap-1">
            {charts.map((ch) => (
              <button
                key={ch.id}
                role="tab"
                type="button"
                aria-selected={chart === ch.id}
                onClick={() => setChart(ch.id)}
                className={cx(
                  'rounded-lg px-3 py-1.5 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent',
                  chart === ch.id ? 'bg-ink text-white' : ch.ok ? 'text-ink-soft hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-50',
                )}
              >
                {ch.label}
              </button>
            ))}
          </div>
          {chart !== 'energy' && (
            <div className="flex flex-wrap gap-2 text-xs">
              {xKey !== 'snrDb' && c.snrValues.length > 1 && <FixSelect label="SNR" unit="dB" values={c.snrValues} value={fixSnr} onChange={setFixSnr} />}
              {xKey !== 'distanceM' && c.distanceValues.length > 1 && <FixSelect label="Distance" unit="m" values={c.distanceValues} value={fixDist} onChange={setFixDist} />}
              {xKey !== 'payloadBytes' && c.paddingValues.length > 1 && <FixSelect label="Payload" unit="B" values={c.paddingValues.map((v) => v + 10)} value={fixPay} onChange={setFixPay} />}
            </div>
          )}
        </div>
        {!charts.find((x) => x.id === chart)!.ok ? (
          <EmptyState title="This chart needs more data">
            {chart === 'energy'
              ? 'Run an experiment with at least two test points.'
              : `Sweep at least two ${chart === 'pdr-dist' ? 'distances' : chart === 'time-payload' ? 'payload sizes' : 'SNR values'} to draw this chart.`}
          </EmptyState>
        ) : chart === 'energy' ? (
          <EnergyChart key={result.id} points={result.points} />
        ) : (
          <SweepChart
            key={`${result.id}-${chart}`}
            points={filtered}
            x={xKey}
            y={chart === 'ber-snr' ? 'ber' : chart === 'pdr-dist' ? 'pdr' : chart === 'loss-snr' ? 'packetLoss' : 'avgProcessingMs'}
            logY={chart === 'ber-snr'}
            height={300}
          />
        )}
        {chart === 'time-payload' && (
          <TechNote>Processing time is JavaScript compute time in your browser (modulate + channel + demodulate + decode). It is not radio latency.</TechNote>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-medium text-ink">Best configuration for</span>
        <select className={cx(inputCls, 'w-auto')} value={metric} onChange={(e) => setMetric(e.target.value as MetricKey)} aria-label="Metric for best configuration">
          {(Object.keys(METRIC_INFO) as MetricKey[]).map((k) => (
            <option key={k} value={k}>
              {METRIC_INFO[k].label} ({METRIC_INFO[k].better} is better)
            </option>
          ))}
        </select>
        {best ? <BestText p={best} metric={metric} /> : <span className="text-sm text-ink-faint">No valid points for this metric.</span>}
      </div>

      <ExperimentResultsTable points={result.points} highlight={best} />

      {obs.length > 0 && (
        <Banner tone="info" title="Observations from these results">
          <ul className="list-disc space-y-1 pl-4">
            {obs.map((o) => (
              <li key={o}>{o}</li>
            ))}
          </ul>
        </Banner>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <div className="text-xs text-ink-faint">{label}</div>
      <div className="font-mono text-lg font-semibold tabular-nums text-ink">{value}</div>
      {hint && <div className="font-mono text-[11px] text-ink-faint">{hint}</div>}
    </div>
  );
}

function FixSelect({ label, unit, values, value, onChange }: { label: string; unit: string; values: number[]; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-1.5 text-ink-soft">
      {label}
      <select className="h-8 rounded-lg border border-line bg-white px-2 text-xs text-ink" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {values.map((v) => (
          <option key={v} value={v}>
            {v} {unit}
          </option>
        ))}
      </select>
    </label>
  );
}

function BestText({ p, metric }: { p: ExperimentPoint; metric: MetricKey }) {
  const v = p[metric] as number;
  const shown = metric === 'ber' ? fmtBer(v) : metric === 'avgProcessingMs' ? fmtMs(v) : metric === 'energyPerDelivered' ? fmtNum(v) : fmtPct(v);
  return (
    <span className="text-sm text-ink">
      <StatusBadge tone={p.modulation === 'ASK' ? 'ask' : 'fsk'}>{p.modulation}</StatusBadge> at SNR {p.snrDb} dB, {p.distanceM} m, {p.payloadBytes} B →{' '}
      <span className="font-mono font-semibold">{shown}</span> <span className="text-ink-faint">(highlighted in the table)</span>
    </span>
  );
}
