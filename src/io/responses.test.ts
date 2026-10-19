/** Importing response files: checks, warnings and what gets stored. */
import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { buildProject } from '../core/__tests__/fixtures';
import { sealEnvelope, type DelphiPayload } from '../core';
import { prepareFileImports } from './responses';

const payload: DelphiPayload = {
  consent: { given: true, at: '2026-11-01T10:00:00Z' },
  ratings: { p1: 9, p2: 'CJ', p3: null, p4: 7, p5: 8, p6: 2, unknownParam: 5 },
  openTexts: { G1: 'متن' },
  allocation: null,
  submittedAt: '2026-11-01T10:05:00Z',
};

const file = (obj: unknown, name = 'E01_round1.json') => new File([JSON.stringify(obj)], name, { type: 'application/json' });

describe('response file import', () => {
  it('accepts a valid file, ignores unknown parameters, and stores it with the responded status', async () => {
    const p = buildProject();
    const env = sealEnvelope({ format: 'delphi-pugh/response', version: 1, projectId: p.id, kind: 'r1', expertId: 'E1', expertCode: 'E01', payload });
    const [item] = await prepareFileImports([file(env)], p, 'r1');
    expect(item.problems).toEqual([]);
    expect(item.warnings.join()).toContain('ناشناخته');
    expect(item.replaces).toBe(true); // the fixture already has a round-1 response for E1
    expect(item.changed).toBeGreaterThan(0);
    const next = produce(p, (d) => item.apply!(d, '2026-11-02'));
    expect(next.responses.r1.E1.ratings).toEqual({ p1: 9, p2: 'CJ', p3: null, p4: 7, p5: 8, p6: 2 });
    expect(next.responses.r1.E1.source).toBe('file');
    expect(next.experts[0].status.r1).toEqual({ state: 'responded', date: '2026-11-02' });
  });

  it('flags an edited file (checksum) and leaves it unselected', async () => {
    const p = buildProject();
    const env = sealEnvelope({ format: 'delphi-pugh/response', version: 1, projectId: p.id, kind: 'r1', expertId: 'E1', expertCode: 'E01', payload });
    const tampered = { ...env, payload: { ...payload, ratings: { ...payload.ratings, p1: 1 } } };
    const [item] = await prepareFileImports([file(tampered)], p, 'r1');
    expect(item.warnings.join()).toContain('checksum');
    expect(item.defaultSelected).toBe(false);
    expect(item.apply).not.toBeNull();
  });

  it('blocks files from another project, another round, or an unknown expert', async () => {
    const p = buildProject();
    const mk = (over: object) => file(sealEnvelope({ format: 'delphi-pugh/response', version: 1, projectId: p.id, kind: 'r1', expertId: 'E1', expertCode: 'E01', payload, ...over }));
    const items = await prepareFileImports([mk({ projectId: 'other' }), mk({ kind: 'r2' }), mk({ expertId: 'zz', expertCode: 'E99' }), file('nope')], p, 'r1');
    expect(items.map((i) => i.apply)).toEqual([null, null, null, null]);
    expect(items[0].problems.join()).toContain('پروژه دیگری');
    expect(items[1].problems.join()).toContain('دور دوم');
    expect(items[2].problems.join()).toContain('E99');
  });
});
