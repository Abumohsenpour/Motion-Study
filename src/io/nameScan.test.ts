/** "Done" criterion: no expert name in any output. Runs the same scan the Exports screen offers. */
import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import { buildDemoProject } from '../demo/demoProject';
import { makeFmt } from '../ui/format';
import { scanOutputsForNames } from './nameScan';

describe('anonymity of the outputs', () => {
  const { project, identities } = buildDemoProject();
  const fmt = makeFmt('fa');

  it('finds no name, contact or note of any expert in any output of the demo project', () => {
    const r = scanOutputsForNames(project, identities, fmt);
    expect(r.terms).toBeGreaterThan(0);
    expect(r.outputs).toBeGreaterThan(40);
    expect(r.hits).toEqual([]);
  });

  it('does report a name the researcher typed into free text (the check is not vacuous)', () => {
    const e = project.experts[0];
    const name = identities[e.id].name;
    const leaked = produce(project, (d) => void (d.params[0].explanation = `پیشنهاد ${name}`));
    const r = scanOutputsForNames(leaked, identities, fmt);
    expect(r.hits.some((h) => h.term === name)).toBe(true);
  });
});
