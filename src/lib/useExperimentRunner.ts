import { useCallback, useEffect, useRef, useState } from 'react';
import type { ExperimentConfig, ExperimentProgress, ExperimentResult } from '../engine';

type WorkerMsg =
  | { type: 'progress'; id: number; progress: ExperimentProgress }
  | { type: 'done'; id: number; result: ExperimentResult }
  | { type: 'error'; id: number; message: string };

function createWorker(): Worker {
  return new Worker(new URL('../workers/experiment.worker.ts', import.meta.url), { type: 'module' });
}

/**
 * Runs experiments in a Web Worker. Cancelling terminates the worker (the
 * simulation loop is synchronous inside it) and a fresh one is created.
 */
export function useExperimentRunner() {
  const workerRef = useRef<Worker | null>(null);
  const pending = useRef<{ id: number; resolve: (r: ExperimentResult) => void; reject: (e: Error) => void } | null>(null);
  const nextId = useRef(1);
  const [progress, setProgress] = useState<ExperimentProgress | null>(null);
  const [running, setRunning] = useState(false);

  const ensureWorker = useCallback(() => {
    if (workerRef.current) return workerRef.current;
    const w = createWorker();
    w.onmessage = (e: MessageEvent<WorkerMsg>) => {
      const msg = e.data;
      const p = pending.current;
      if (!p || msg.id !== p.id) return;
      if (msg.type === 'progress') setProgress(msg.progress);
      else if (msg.type === 'done') {
        pending.current = null;
        setRunning(false);
        p.resolve(msg.result);
      } else {
        pending.current = null;
        setRunning(false);
        p.reject(new Error(msg.message));
      }
    };
    w.onerror = (e) => {
      const p = pending.current;
      pending.current = null;
      setRunning(false);
      p?.reject(new Error(e.message || 'The simulation worker failed.'));
    };
    workerRef.current = w;
    return w;
  }, []);

  const run = useCallback(
    (config: ExperimentConfig): Promise<ExperimentResult> => {
      if (pending.current) return Promise.reject(new Error('An experiment is already running.'));
      const w = ensureWorker();
      const id = nextId.current++;
      setProgress(null);
      setRunning(true);
      return new Promise<ExperimentResult>((resolve, reject) => {
        pending.current = { id, resolve, reject };
        w.postMessage({ type: 'run', id, config });
      });
    },
    [ensureWorker],
  );

  const cancel = useCallback(() => {
    workerRef.current?.terminate();
    workerRef.current = null;
    const p = pending.current;
    pending.current = null;
    setRunning(false);
    setProgress(null);
    p?.reject(new Error('Experiment cancelled.'));
  }, []);

  useEffect(() => () => workerRef.current?.terminate(), []);

  return { run, cancel, progress, running };
}
