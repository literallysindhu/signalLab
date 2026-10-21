/// <reference lib="webworker" />
import { runExperiment, type ExperimentConfig } from '../engine';

/** Runs parameter sweeps off the main thread so the UI never freezes. */
interface RunMessage {
  type: 'run';
  id: number;
  config: ExperimentConfig;
}

const ctx = self as unknown as DedicatedWorkerGlobalScope;

ctx.onmessage = (e: MessageEvent<RunMessage>) => {
  const { id, config } = e.data;
  try {
    const result = runExperiment(config, (progress) => ctx.postMessage({ type: 'progress', id, progress }));
    ctx.postMessage({ type: 'done', id, result });
  } catch (err) {
    ctx.postMessage({ type: 'error', id, message: (err as Error).message });
  }
};
