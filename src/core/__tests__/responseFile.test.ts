import { describe, expect, it } from 'vitest';
import { createHash } from 'node:crypto';
import { canonicalJson, sha256Hex } from '../../shared/sha256.js';
import { parseEnvelope, sealEnvelope, type DelphiPayload } from '../io/responseFile';

describe('bundled SHA-256', () => {
  it('matches Node’s implementation, including Persian text and padding boundaries', () => {
    for (const s of ['', 'abc', 'سلام دنیا ۱۲۳', 'a'.repeat(55), 'a'.repeat(56), 'a'.repeat(64), 'x'.repeat(1000)])
      expect(sha256Hex(s)).toBe(createHash('sha256').update(s, 'utf8').digest('hex'));
  });

  it('canonical JSON sorts keys and drops undefined', () => {
    expect(canonicalJson({ b: 1, a: [3, { d: undefined, c: 'x' }], e: null })).toBe('{"a":[3,{"c":"x"}],"b":1,"e":null}');
  });
});

describe('response file envelope', () => {
  const payload: DelphiPayload = {
    consent: { given: true, at: '2026-10-20T10:00:00Z' },
    ratings: { p1: 7, p2: 'CJ', p3: null },
    openTexts: { g1: 'پارامتر پیشنهادی' },
    allocation: null,
    submittedAt: '2026-10-20T10:05:00Z',
  };
  const sealed = sealEnvelope({ format: 'delphi-pugh/response', version: 1, projectId: 'P', kind: 'r1', expertId: 'e1', expertCode: 'E07', payload });

  it('round-trips and verifies', () => {
    const { envelope, problems } = parseEnvelope(JSON.stringify(sealed, null, 2), 'P');
    expect(problems).toEqual([]);
    expect(envelope!.payload).toEqual(payload);
  });

  it('detects edits, foreign projects and non-JSON', () => {
    const edited = { ...sealed, payload: { ...payload, ratings: { ...payload.ratings, p1: 9 } } };
    expect(parseEnvelope(JSON.stringify(edited), 'P').problems).toEqual(['bad-checksum']);
    expect(parseEnvelope(JSON.stringify(sealed), 'OTHER').problems).toEqual(['wrong-project']);
    expect(parseEnvelope('not json', 'P').problems).toEqual(['not-json']);
    expect(parseEnvelope('{"a":1}', 'P').problems).toEqual(['wrong-format']);
  });
});
