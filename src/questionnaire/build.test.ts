/** The offline expert files: content, privacy (no other expert's individual answer), blinding. */
import { describe, expect, it } from 'vitest';
import { buildProject } from '../core/__tests__/fixtures';
import { makeBlindingKey, questionnaireData, questionnaireHtml } from './build';

const opts = { digits: 'fa' as const, deadlineText: '' };
/** The JSON data embedded in the file (the font is base64 and could contain any short string by chance). */
const dataBlock = (html: string) => /<script type="application\/json" id="qdata">([^]*?)<\/script>/.exec(html)![1];

describe('expert questionnaire files', () => {
  it('round 1 lists the initial parameters by group, with consent text and the scale', () => {
    const p = buildProject();
    const d = questionnaireData(p, 'E1', 'r1', opts);
    expect(d.expertCode).toBe('E01');
    expect(d.groups.map((g) => g.params.map((x) => x.id))).toEqual([['p1', 'p2', 'p3'], ['p4', 'p5'], ['p6']]);
    expect(d.consentText).toContain('رضایت');
    expect(d.groups[0].params[0].feedback).toBeUndefined();
  });

  it('round 2 feedback is aggregated by domain plus the expert’s own score only', () => {
    const p = buildProject();
    p.params.push({ id: 'p7', code: 'P7', name: 'جدید', groupId: 'G1', requirement: '', explanation: '', range: '', source: 'literature', origin: 'round2' });
    const d = questionnaireData(p, 'E1', 'r2', opts);
    const p6 = d.groups[2].params[0];
    // E1's own round-1 answer for p6 was 5
    expect(p6.feedback!.own).toBe(5);
    // surgery domain (E1, E2, E5) p6 round 1: 5, 9, 7 → low 0, mid 1, high 2 → 0 %, 33.3 %, 66.7 %
    const S = p.domains[0].id;
    expect(p6.feedback!.byDomain[S].n).toBe(3);
    expect(p6.feedback!.byDomain[S].percents[1]).toBeCloseTo(100 / 3, 9);
    const p7 = d.groups[0].params.find((x) => x.id === 'p7')!;
    expect(p7.isNew).toBe(true);
    expect(p7.feedback).toBeUndefined();
    // privacy: no other expert id, code, or individual round-1 vector anywhere in the file
    const data = dataBlock(questionnaireHtml(d));
    for (const other of ['E2', 'E3', 'E4', 'E5']) expect(data).not.toContain(`"${other}"`);
    for (const code of ['E02', 'E03', 'E04', 'E05']) expect(data).not.toContain(code);
    expect(data).not.toContain('ratings');
  });

  it('the html is self-contained (font, checksum code and runtime inlined; no external URL)', () => {
    const html = questionnaireHtml(questionnaireData(buildProject(), 'E2', 'r1', opts));
    expect(html).toContain('data:font/woff2;base64,');
    expect(html).toContain('function sha256Hex');
    expect(html).toContain('bootQuestionnaire');
    expect(html).not.toMatch(/export function/);
    expect(html).not.toMatch(/(src|href)=["']https?:/);
    expect(html).not.toMatch(/<\/script>[^]*<\/script>[^]*<\/script>/); // exactly two script blocks
  });

  it('carries the print-only answer sheet, the PDF button and the CORTEX mark, still with no external resource', () => {
    const html = questionnaireHtml(questionnaireData(buildProject(), 'E2', 'r2', opts));
    // the sheet container exists once, outside the interactive app, and is print-only
    expect(html.match(/<section id="print-sheet"/g)).toHaveLength(1);
    expect(html).toMatch(/<\/main>\s*(<!--[^]*?-->\s*)?<section id="print-sheet" class="sheet" aria-hidden="true"><\/section>/);
    expect(html).toContain('#print-sheet{display:none}');
    expect(html).toMatch(/@media print\{[^]*#app\{display:none!important\}[^]*#print-sheet\{display:block\}/);
    expect(html).toContain('@page{size:A4');
    expect(html).toContain('break-inside:avoid');
    expect(html).toContain('display:table-header-group');
    // the runtime offers the PDF copy through the browser's own print dialog (no PDF library)
    expect(html).toContain('ذخیره نسخه PDF');
    expect(html).toContain('window.print()');
    expect(html).toContain('پیش‌نویس — هنوز ذخیره نشده');
    expect(html).not.toMatch(/jspdf|pdfmake|pdf-lib/i);
    // brand mark as an inline data URL; nothing is fetched
    expect(html).toContain('<template id="qlogo"><img class="logo" alt="" src="data:image/svg+xml,');
    expect(html).toContain('ساخته‌شده با ');
    expect(html).not.toMatch(/(src|href)=["']https?:/);
    expect(html).not.toMatch(/url\(\s*["']?https?:/);
  });

  it('the answer sheet is empty in the generated file: answers and other experts never appear outside the data block', () => {
    const p = buildProject();
    const html = questionnaireHtml(questionnaireData(p, 'E1', 'r2', opts));
    const rest = html.replace(dataBlock(html), '').replace(/data:font\/woff2;base64,[A-Za-z0-9+/=]+/, '');
    for (const code of ['E01', 'E02', 'E03', 'E04', 'E05']) expect(rest.replace(/<title>[^]*?<\/title>/, '')).not.toContain(code);
    // the response file format written by the runtime is unchanged
    expect(rest).toContain("format: 'delphi-pugh/response', version: 1, projectId: DATA.projectId, kind: DATA.kind, expertId: DATA.expertId, expertCode: DATA.expertCode, payload: payload(submittedAt)");
    expect(rest).toContain('env.checksum = sha256Hex(canonicalJson(env))');
  });

  it('blinding: random two-digit codes and order, reproducible from the seed', () => {
    const a = makeBlindingKey(['K1', 'K2', 'K3', 'K4', 'K5'], 12345);
    const b = makeBlindingKey(['K1', 'K2', 'K3', 'K4', 'K5'], 12345);
    expect(a).toEqual(b);
    const codes = Object.values(a.codes);
    expect(new Set(codes).size).toBe(5);
    for (const c of codes) expect(Number(c)).toBeGreaterThanOrEqual(10);
    expect([...a.order].sort()).toEqual(['K1', 'K2', 'K3', 'K4', 'K5']);
    expect(makeBlindingKey(['K1', 'K2', 'K3', 'K4', 'K5'], 999)).not.toEqual(a);
  });

  it('the pugh file shows blinded codes in the expert’s order, never concept names or screening results', () => {
    const p = buildProject();
    p.concepts = ['C1', 'C2'].map((id) => ({ id, code: id, name: `نام واقعی ${id}`, sketch: null, description: 'توضیح', feasible: true }));
    p.weighted.conceptIds = ['C1', 'C2'];
    p.weighted.columns = [{ paramId: 'p1', weight: 1 }];
    p.weighted.blinding.E3 = makeBlindingKey(['C1', 'C2'], 7);
    const d = questionnaireData(p, 'E3', 'pugh', opts);
    expect(d.concepts.map((c) => c.code)).toEqual(p.weighted.blinding.E3.order.map((id) => p.weighted.blinding.E3.codes[id]));
    const data = dataBlock(questionnaireHtml(d));
    expect(data).not.toContain('نام واقعی');
    expect(data).not.toContain('"C1"');
  });
});
