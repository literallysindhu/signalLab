import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_PARAMS,
  generateReading,
  Rng,
  validateParams,
  type ExperimentPoint,
  type ExperimentResult,
  type LinkResult,
  type Modulation,
  type SensorReading,
  type SimParams,
} from '../../engine';
import { loadJSON, saveJSON, STORAGE_KEYS } from '../../lib/storage';

export type Selection = 'ASK' | 'FSK' | 'BOTH';
export const STEP_LABELS = ['Sensor data', 'Modulation', 'Channel', 'Transmit', 'Receive', 'Compare'];

export interface Transmission {
  key: string;
  results: Partial<Record<Modulation, LinkResult>>;
}

export interface DemoComparison {
  key: string;
  current: Record<Modulation, ExperimentPoint>;
  snrSweep: ExperimentPoint[];
  distanceSweep: ExperimentPoint[];
  runs: ExperimentResult[];
}

interface Persisted {
  reading: SensorReading;
  selection: Selection | null;
  params: SimParams;
  step: number;
}

export function modsFor(sel: Selection | null): Modulation[] {
  return sel === 'BOTH' ? ['ASK', 'FSK'] : sel ? [sel] : [];
}

export function newSampleReading(sequence: number): SensorReading {
  const rng = new Rng((Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0);
  return generateReading(rng, 1, sequence, Date.now() / 1000);
}

const initialReading: SensorReading = { nodeId: 1, sequence: 1, timestamp: Math.floor(Date.now() / 1000), temperatureC: 29.4, humidityPct: 62 };

function sanitize(p: Partial<Persisted> | null): Persisted {
  const params = { ...DEFAULT_PARAMS, ...(p?.params ?? {}) };
  const reading = p?.reading && typeof p.reading.temperatureC === 'number' ? p.reading : initialReading;
  const selection = p?.selection === 'ASK' || p?.selection === 'FSK' || p?.selection === 'BOTH' ? p.selection : null;
  return { reading, selection, params, step: Math.min(Math.max(0, p?.step ?? 0), 2) };
}

interface DemoCtx {
  step: number;
  setStep: (s: number) => void;
  reading: SensorReading;
  setReading: (r: SensorReading) => void;
  readingError: string | null;
  setReadingError: (e: string | null) => void;
  selection: Selection | null;
  setSelection: (s: Selection) => void;
  params: SimParams;
  updateParams: (patch: Partial<SimParams>) => void;
  /** Identifies the inputs a transmission was computed from. */
  inputKey: string;
  transmission: Transmission | null;
  setTransmission: (t: Transmission | null) => void;
  /** Results for the current inputs, or null when inputs changed since. */
  validTransmission: Transmission | null;
  comparison: DemoComparison | null;
  setComparison: (c: DemoComparison | null) => void;
  presentation: boolean;
  setPresentation: (v: boolean) => void;
  autoTransmit: boolean;
  setAutoTransmit: (v: boolean) => void;
  /** Message explaining why the user cannot leave step i yet, or null. */
  blocker: (i: number) => string | null;
  maxReachable: number;
  restart: () => void;
}

const Ctx = createContext<DemoCtx | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const init = useMemo(() => sanitize(loadJSON<Partial<Persisted> | null>(STORAGE_KEYS.demo, null)), []);
  const [step, setStep] = useState(init.step);
  const [reading, setReading] = useState<SensorReading>(init.reading);
  const [readingError, setReadingError] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(init.selection);
  const [params, setParams] = useState<SimParams>(init.params);
  const [transmission, setTransmission] = useState<Transmission | null>(null);
  const [comparison, setComparison] = useState<DemoComparison | null>(null);
  const [presentation, setPresentation] = useState(false);
  const [autoTransmit, setAutoTransmit] = useState(false);

  useEffect(() => {
    saveJSON(STORAGE_KEYS.demo, { reading, selection, params, step } satisfies Persisted);
  }, [reading, selection, params, step]);

  const updateParams = useCallback((patch: Partial<SimParams>) => setParams((p) => ({ ...p, ...patch })), []);
  const inputKey = useMemo(() => JSON.stringify({ reading, params }), [reading, params]);

  const validTransmission = useMemo(() => {
    if (!transmission || transmission.key !== inputKey) return null;
    return modsFor(selection).every((m) => transmission.results[m]) ? transmission : null;
  }, [transmission, inputKey, selection]);

  const paramErrors = useMemo(() => validateParams(params).errors, [params]);

  const blocker = useCallback(
    (i: number): string | null => {
      if (i === 0) return readingError ? `Fix the sensor values first: ${readingError}` : null;
      if (i === 1) return selection ? null : 'Choose ASK, FSK or Compare both to continue.';
      if (i === 2) return paramErrors.length ? paramErrors[0] : null;
      if (i === 3) return validTransmission ? null : 'Transmit the signal first: click "Show transmission".';
      return null;
    },
    [readingError, selection, paramErrors, validTransmission],
  );

  const maxReachable = useMemo(() => {
    for (let i = 0; i < STEP_LABELS.length - 1; i++) if (blocker(i)) return i;
    return STEP_LABELS.length - 1;
  }, [blocker]);

  const restart = useCallback(() => {
    setReading((r) => newSampleReading((r.sequence + 1) & 0xffff));
    setReadingError(null);
    setTransmission(null);
    setComparison(null);
    setStep(0);
  }, []);

  const value: DemoCtx = {
    step,
    setStep,
    reading,
    setReading,
    readingError,
    setReadingError,
    selection,
    setSelection,
    params,
    updateParams,
    inputKey,
    transmission,
    setTransmission,
    validTransmission,
    comparison,
    setComparison,
    presentation,
    setPresentation,
    autoTransmit,
    setAutoTransmit,
    blocker,
    maxReachable,
    restart,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo(): DemoCtx {
  const v = useContext(Ctx);
  if (!v) throw new Error('useDemo must be used inside DemoProvider');
  return v;
}
