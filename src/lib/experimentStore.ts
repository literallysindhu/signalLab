import { useCallback, useEffect, useState } from 'react';
import type { ExperimentResult } from '../engine';
import { loadJSON, saveJSON, STORAGE_KEYS } from './storage';

const MAX_SAVED = 40;
const listeners = new Set<(list: ExperimentResult[]) => void>();
let cache: ExperimentResult[] | null = null;

function read(): ExperimentResult[] {
  if (!cache) {
    const v = loadJSON<ExperimentResult[]>(STORAGE_KEYS.experiments, []);
    cache = Array.isArray(v) ? v.filter((r) => r && Array.isArray(r.points) && r.config) : [];
  }
  return cache;
}

function write(list: ExperimentResult[]): boolean {
  cache = list;
  const ok = saveJSON(STORAGE_KEYS.experiments, list);
  listeners.forEach((l) => l(list));
  return ok;
}

/** Saved experiment history, shared across pages and persisted in localStorage. */
export function useExperimentHistory() {
  const [list, setList] = useState<ExperimentResult[]>(read);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);

  const add = useCallback((r: ExperimentResult) => write([r, ...read().filter((x) => x.id !== r.id)].slice(0, MAX_SAVED)), []);
  const remove = useCallback((id: string) => write(read().filter((x) => x.id !== id)), []);
  const clear = useCallback(() => write([]), []);
  return { list, add, remove, clear };
}
