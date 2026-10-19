/**
 * Brings a project read from a file up to the current shape: any field missing (older file, hand-edited file)
 * gets its default value, so the app never crashes on an incomplete project file.
 */
import type { Project } from '../types';
import { createProject } from './defaults';

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

/** Recursively fills missing keys of plain objects from `defaults`. Arrays and present values are kept. */
function fill<T>(value: unknown, defaults: T): T {
  if (!isObj(defaults)) return (value === undefined ? defaults : value) as T;
  if (!isObj(value)) return defaults;
  const out: Record<string, unknown> = { ...value };
  for (const [k, d] of Object.entries(defaults)) out[k] = k in value ? fill(value[k], d) : d;
  return out as T;
}

export type ProjectFileProblem = 'not-json' | 'not-a-project' | 'newer-version';

export function parseProjectJson(text: string): { project: Project | null; problem: ProjectFileProblem | null } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { project: null, problem: 'not-json' };
  }
  if (!isObj(raw) || raw.schema !== 'delphi-pugh/project') return { project: null, problem: 'not-a-project' };
  if (typeof raw.version === 'number' && raw.version > 1) return { project: null, problem: 'newer-version' };
  const d = createProject();
  // Collections and keyed maps keep the file's content; only top-level and settings-like objects are filled.
  const p = fill(raw, { ...d, domains: [], groups: [], experts: [], params: [], concepts: [], candidates: [] }) as Project;
  for (const e of p.experts) {
    e.status = fill(e.status, { r1: { state: 'none', date: null }, r2: { state: 'none', date: null }, pugh: { state: 'none', date: null } });
    e.excludeAllData ??= false;
    e.inclusionMet ??= null;
    e.active ??= true;
  }
  for (const dm of p.domains) {
    dm.inclusionCriteria ??= '';
    dm.minYears ??= null;
  }
  return { project: p, problem: null };
}
