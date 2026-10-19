/**
 * The project file (.json) and the separate identity key file.
 * The project file never contains names, contact details or notes (DECISIONS C1); those are in the key file.
 */
import { parseProjectJson, type ExpertIdentity, type Id, type Project } from '../core';

export const IDENTITY_FORMAT = 'delphi-pugh/identity-key';

export const serializeProject = (p: Project): string => JSON.stringify(p, null, 2);

export { parseProjectJson };

export interface IdentityKeyFile {
  format: typeof IDENTITY_FORMAT;
  version: 1;
  projectId: Id;
  projectTitle: string;
  exportedAt: string;
  entries: { expertId: Id; code: string; name: string; contact: string; notes: string }[];
}

export function serializeIdentityKey(p: Project, ids: Record<Id, ExpertIdentity>): string {
  const file: IdentityKeyFile = {
    format: IDENTITY_FORMAT,
    version: 1,
    projectId: p.id,
    projectTitle: p.title,
    exportedAt: new Date().toISOString(),
    entries: p.experts.map((e) => ({ expertId: e.id, code: e.code, name: ids[e.id]?.name ?? '', contact: ids[e.id]?.contact ?? '', notes: ids[e.id]?.notes ?? '' })),
  };
  return JSON.stringify(file, null, 2);
}

/** Reads a key file; entries are matched by expert id, then by code. */
export function parseIdentityKey(
  text: string,
  p: Project,
): { identities: Record<Id, ExpertIdentity> | null; matched: number; unmatched: number; otherProject: boolean; error: boolean } {
  try {
    const f = JSON.parse(text) as IdentityKeyFile;
    if (f.format !== IDENTITY_FORMAT || !Array.isArray(f.entries)) throw new Error('format');
    const identities: Record<Id, ExpertIdentity> = {};
    let matched = 0;
    for (const en of f.entries) {
      const e = p.experts.find((x) => x.id === en.expertId) ?? p.experts.find((x) => x.code === en.code);
      if (!e) continue;
      identities[e.id] = { name: en.name ?? '', contact: en.contact ?? '', notes: en.notes ?? '' };
      matched++;
    }
    return { identities, matched, unmatched: f.entries.length - matched, otherProject: f.projectId !== p.id, error: false };
  } catch {
    return { identities: null, matched: 0, unmatched: 0, otherProject: false, error: true };
  }
}
