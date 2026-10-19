/**
 * Local persistence in IndexedDB (via Dexie). Nothing leaves the computer.
 * Two separate tables: the project data, and the expert identities (names, contacts, notes), which the
 * proposal requires to be kept apart from the data (DECISIONS C1).
 */
import Dexie, { type Table } from 'dexie';
import type { ExpertIdentity, Id, Project } from '../core';

export interface ProjectRow {
  id: Id;
  title: string;
  updatedAt: string;
  data: Project;
}

export interface IdentityRow {
  projectId: Id;
  data: Record<Id, ExpertIdentity>;
}

class AppDB extends Dexie {
  projects!: Table<ProjectRow, Id>;
  identities!: Table<IdentityRow, Id>;

  constructor() {
    super('delphi-pugh');
    this.version(1).stores({ projects: 'id, updatedAt', identities: 'projectId' });
  }
}

let instance: AppDB | null = null;

/** The database, or null when IndexedDB is unavailable (e.g. some private windows). */
export function getDb(): AppDB | null {
  if (instance) return instance;
  try {
    if (typeof indexedDB === 'undefined') return null;
    instance = new AppDB();
    return instance;
  } catch {
    return null;
  }
}

export async function listProjects(): Promise<{ id: Id; title: string; updatedAt: string }[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db.projects.orderBy('updatedAt').reverse().toArray();
  return rows.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }));
}

export async function loadProject(id: Id): Promise<{ project: Project; identities: Record<Id, ExpertIdentity> } | null> {
  const db = getDb();
  if (!db) return null;
  const row = await db.projects.get(id);
  if (!row) return null;
  const ids = await db.identities.get(id);
  return { project: row.data, identities: ids?.data ?? {} };
}

export async function saveProject(p: Project, identities: Record<Id, ExpertIdentity>): Promise<void> {
  const db = getDb();
  if (!db) throw new Error('no-indexeddb');
  await db.transaction('rw', db.projects, db.identities, async () => {
    await db.projects.put({ id: p.id, title: p.title, updatedAt: p.updatedAt, data: p });
    await db.identities.put({ projectId: p.id, data: identities });
  });
}

export async function deleteProject(id: Id): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.transaction('rw', db.projects, db.identities, async () => {
    await db.projects.delete(id);
    await db.identities.delete(id);
  });
}
