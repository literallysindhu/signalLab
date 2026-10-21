/** Safe localStorage helpers: storage can be unavailable or full, so never throw. */

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

/** Returns false when the value could not be saved (e.g. quota exceeded, private mode). */
export function saveJSON(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const STORAGE_KEYS = {
  experiments: 'signallab.experiments.v1',
  experimentDraft: 'signallab.experimentDraft.v1',
  demo: 'signallab.demo.v1',
  settings: 'signallab.settings.v1',
} as const;
