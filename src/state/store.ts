/**
 * Application state: the open project, the private identity store, undo/redo history, and the change log.
 *
 * Every edit goes through `apply(label, recipe)`. It produces a new immutable project (immer), records the
 * previous one for undo, and — once data collection has started — appends a change-log entry
 * (DECISIONS D-55/D-56). The change log is append-only: undo and redo are logged too, never erased.
 */
import { produce, type Draft } from 'immer';
import { create } from 'zustand';
import { dataCollectionStarted, newId, type ChangeLogEntry, type ExpertIdentity, type Id, type Project } from '../core';

export interface ApplyOptions {
  /** Shown in the change log (e.g. what changed). */
  detail?: string;
  /** Reason typed by the researcher in a confirmation dialog. */
  reason?: string;
  /** Do not write a change-log entry (UI-only bookkeeping). */
  silent?: boolean;
}

interface StoreState {
  project: Project | null;
  identities: Record<Id, ExpertIdentity>;
  past: Project[];
  future: Project[];
  lastEdit: { label: string; at: number } | null;
  /** Bumps on every change that must be saved. */
  revision: number;
  saveStatus: 'idle' | 'saving' | 'saved' | 'error';

  open: (project: Project, identities: Record<Id, ExpertIdentity>) => void;
  close: () => void;
  apply: (label: string, recipe: (draft: Draft<Project>) => void, opts?: ApplyOptions) => void;
  setIdentity: (expertId: Id, patch: Partial<ExpertIdentity>) => void;
  replaceIdentities: (ids: Record<Id, ExpertIdentity>) => void;
  undo: () => void;
  redo: () => void;
  setSaveStatus: (s: StoreState['saveStatus']) => void;
}

const HISTORY = 100;
/** Consecutive edits with the same label within this window form one undo step (e.g. typing a name). */
const COALESCE_MS = 1200;

const nowIso = () => new Date().toISOString();

function logEntry(action: string, detail = '', reason = ''): ChangeLogEntry {
  return { id: newId('l_'), at: nowIso(), action, detail, reason };
}

/** Appends to the change log, merging a repeat of the previous action within two minutes (e.g. data entry). */
function appendLog(d: Draft<Project>, entry: ChangeLogEntry) {
  const last = d.changeLog[d.changeLog.length - 1];
  if (last && last.action === entry.action && !entry.reason && Date.parse(entry.at) - Date.parse(last.at) < 120_000) {
    last.at = entry.at;
    if (entry.detail) last.detail = entry.detail;
    return;
  }
  d.changeLog.push(entry);
}

export const useStore = create<StoreState>((set, get) => ({
  project: null,
  identities: {},
  past: [],
  future: [],
  lastEdit: null,
  revision: 0,
  saveStatus: 'idle',

  open: (project, identities) => set({ project, identities, past: [], future: [], lastEdit: null, saveStatus: 'saved' }),
  close: () => set({ project: null, identities: {}, past: [], future: [], lastEdit: null }),

  apply: (label, recipe, opts = {}) => {
    const { project: prev, past, lastEdit, revision } = get();
    if (!prev) return;
    const edited = produce(prev, recipe);
    if (edited === prev) return;
    const started = dataCollectionStarted(prev) || dataCollectionStarted(edited);
    const next = produce(edited, (d) => {
      d.updatedAt = nowIso();
      // Freeze the settings when the first round-1 response arrives (DECISIONS C3).
      if (!d.settingsSnapshot && dataCollectionStarted(edited))
        d.settingsSnapshot = {
          at: nowIso(),
          scale: structuredClone(prev.scale),
          consensus: { ...prev.settings.consensus },
          candidatePct: prev.settings.candidatePct,
        };
      if (started && !opts.silent) appendLog(d, logEntry(label, opts.detail, opts.reason));
    });
    const t = Date.now();
    const coalesce = !!lastEdit && lastEdit.label === label && t - lastEdit.at < COALESCE_MS && past.length > 0;
    set({
      project: next,
      past: coalesce ? past : [...past, prev].slice(-HISTORY),
      future: [],
      lastEdit: { label, at: t },
      revision: revision + 1,
    });
  },

  setIdentity: (expertId, patch) => {
    const { identities, revision } = get();
    const cur = identities[expertId] ?? { name: '', contact: '', notes: '' };
    set({ identities: { ...identities, [expertId]: { ...cur, ...patch } }, revision: revision + 1 });
  },

  replaceIdentities: (ids) => set({ identities: ids, revision: get().revision + 1 }),

  undo: () => {
    const { project, past, future, revision } = get();
    if (!project || past.length === 0) return;
    const target = past[past.length - 1];
    const restored = produce(target, (d) => {
      d.changeLog = structuredClone(project.changeLog) as Draft<ChangeLogEntry>[];
      if (dataCollectionStarted(project)) d.changeLog.push(logEntry('بازگردانی (Undo)'));
      d.updatedAt = nowIso();
    });
    set({ project: restored, past: past.slice(0, -1), future: [project, ...future], lastEdit: null, revision: revision + 1 });
  },

  redo: () => {
    const { project, past, future, revision } = get();
    if (!project || future.length === 0) return;
    const target = future[0];
    const restored = produce(target, (d) => {
      d.changeLog = structuredClone(project.changeLog) as Draft<ChangeLogEntry>[];
      if (dataCollectionStarted(project)) d.changeLog.push(logEntry('انجام دوباره (Redo)'));
      d.updatedAt = nowIso();
    });
    set({ project: restored, past: [...past, project].slice(-HISTORY), future: future.slice(1), lastEdit: null, revision: revision + 1 });
  },

  setSaveStatus: (saveStatus) => set({ saveStatus }),
}));

/** The open project (components are only rendered when one is open). */
export const useProject = (): Project => useStore((s) => s.project)!;
