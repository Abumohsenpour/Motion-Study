import { describe, expect, it } from 'vitest';
import { createProject } from '../project/defaults';
import { parseProjectJson } from '../project/normalize';
import { describeImpact } from '../project/impact';

describe('project file reading', () => {
  it('round-trips a project', () => {
    const p = createProject('آزمون');
    const { project, problem } = parseProjectJson(JSON.stringify(p));
    expect(problem).toBeNull();
    expect(project).toEqual(p);
  });

  it('fills fields missing from an older or hand-edited file', () => {
    const p = createProject('آزمون') as unknown as Record<string, unknown>;
    delete p.weighted;
    delete p.expertCodeCounter;
    (p.settings as Record<string, unknown>).sensitivity = undefined;
    const { project } = parseProjectJson(JSON.stringify(p));
    expect(project!.weighted.columns).toEqual([]);
    expect(project!.expertCodeCounter).toBe(0);
    expect(project!.settings.sensitivity.pctOfRange).toBe(10);
  });

  it('rejects other files', () => {
    expect(parseProjectJson('nope').problem).toBe('not-json');
    expect(parseProjectJson('{"a":1}').problem).toBe('not-a-project');
    expect(parseProjectJson(JSON.stringify({ ...createProject(), version: 2 })).problem).toBe('newer-version');
  });
});

describe('impact preview', () => {
  it('reports nothing for an edit that changes no result', () => {
    const p = createProject();
    expect(describeImpact(p, { ...p, title: 'x' })).toEqual([]);
  });
});
