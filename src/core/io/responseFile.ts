/**
 * The small JSON file an expert sends back (e.g. `E07_round1.json`), see DECISIONS D-52.
 *
 *   { format, version, projectId, kind, expertId, expertCode, payload, checksum }
 *
 * `checksum` = SHA-256 of the canonical JSON of every other field. It detects a damaged or hand-edited file;
 * it is not a security measure. The offline expert file builds the envelope with the same shared code.
 */
import { canonicalJson, sha256Hex } from '../../shared/sha256.js';
import type { Id, RatingValue } from '../types';

export const RESPONSE_FORMAT = 'delphi-pugh/response';

export type ResponseKind = 'r1' | 'r2' | 'pugh';

export interface ConsentRecord {
  given: boolean;
  at: string | null;
}

export interface DelphiPayload {
  consent: ConsentRecord;
  ratings: Record<Id, RatingValue>;
  openTexts: Record<Id, string>;
  allocation: { groupPoints: Record<Id, number | null>; paramPoints: Record<Id, number | null> } | null;
  submittedAt: string;
}

export interface PughPayload {
  consent: ConsentRecord;
  /** Blinded concept code → parameter id → 1–5 or null */
  scores: Record<string, Record<Id, number | null>>;
  submittedAt: string;
}

export interface ResponseEnvelope<P = DelphiPayload | PughPayload> {
  format: typeof RESPONSE_FORMAT;
  version: 1;
  projectId: Id;
  kind: ResponseKind;
  expertId: Id;
  expertCode: string;
  payload: P;
  checksum: string;
}

export function envelopeChecksum(env: Omit<ResponseEnvelope, 'checksum'>): string {
  const { format, version, projectId, kind, expertId, expertCode, payload } = env;
  return sha256Hex(canonicalJson({ format, version, projectId, kind, expertId, expertCode, payload }));
}

export function sealEnvelope<P extends DelphiPayload | PughPayload>(
  env: Omit<ResponseEnvelope<P>, 'checksum'>,
): ResponseEnvelope<P> {
  return { ...env, checksum: envelopeChecksum(env) };
}

export type EnvelopeProblem = 'not-json' | 'wrong-format' | 'bad-checksum' | 'wrong-project' | 'unknown-kind';

/** Parses and checks a response file. Project/expert/parameter matching is done by the importer. */
export function parseEnvelope(
  text: string,
  projectId: Id,
): { envelope: ResponseEnvelope | null; problems: EnvelopeProblem[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { envelope: null, problems: ['not-json'] };
  }
  const env = raw as ResponseEnvelope;
  if (!env || env.format !== RESPONSE_FORMAT || env.version !== 1 || typeof env.payload !== 'object')
    return { envelope: null, problems: ['wrong-format'] };
  const problems: EnvelopeProblem[] = [];
  if (!['r1', 'r2', 'pugh'].includes(env.kind)) problems.push('unknown-kind');
  if (envelopeChecksum(env) !== env.checksum) problems.push('bad-checksum');
  if (env.projectId !== projectId) problems.push('wrong-project');
  return { envelope: env, problems };
}
