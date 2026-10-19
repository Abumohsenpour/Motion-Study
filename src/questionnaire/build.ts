/**
 * Builds the self-contained offline .html file for one expert (round 1, round 2 or weighted-Pugh scoring).
 *
 * Privacy: the file carries this expert's own data only. Round-2 feedback is aggregated per domain
 * (percent per band and n); the only individual score in the file is the expert's own (ethics ۹–۴).
 * Weighted-Pugh files show the concepts under random codes in a random order for this expert, and
 * contain no screening result (proposal: «کنترل سوگیری»).
 */
import fontUrl from 'vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2?inline';
import shaSource from '../shared/sha256.js?raw';
import runtimeSource from './runtime.js?raw';
import {
  buildFeedback,
  expertById,
  round1Params,
  round2Params,
  weightedConceptIds,
  type BlindingKey,
  type Id,
  type Parameter,
  type Project,
  type RoundKey,
} from '../core';
import { QUESTIONNAIRE_CSS } from './styles';

export interface QParam {
  id: Id;
  code: string;
  name: string;
  requirement: string;
  explanation: string;
  range: string;
  isNew: boolean;
  feedback?: { byDomain: Record<Id, { n: number; percents: (number | null)[] }>; own: unknown } | null;
}

export interface QData {
  kind: RoundKey;
  projectId: Id;
  projectTitle: string;
  expertId: Id;
  expertCode: string;
  consentText: string;
  digits: 'fa' | 'latin';
  deadline: string | null;
  deadlineText: string;
  scale: Project['scale'];
  domains: { id: Id; name: string; shortLabel: string; color: string }[];
  groups: { id: Id; name: string; params: QParam[] }[];
  // weighted Pugh
  valueLabels: string[];
  concepts: { code: string; label: string; sketch: string | null; description: string }[];
  params: { id: Id; code: string; name: string; requirement: string }[];
}

export const fileSuffix: Record<RoundKey, string> = { r1: 'round1', r2: 'round2', pugh: 'pugh' };

const qParam = (x: Parameter): QParam => ({
  id: x.id,
  code: x.code,
  name: x.name,
  requirement: x.requirement,
  explanation: x.explanation,
  range: x.range,
  isNew: x.origin === 'round2',
});

/** Small seeded PRNG (mulberry32) so a blinding key can be regenerated identically from its seed. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random two-digit codes and a random order of the concepts for one expert (DECISIONS D-43). */
export function makeBlindingKey(conceptIds: readonly Id[], seed = crypto.getRandomValues(new Uint32Array(1))[0]): BlindingKey {
  const rnd = mulberry32(seed);
  const pool = Array.from({ length: 90 }, (_, i) => i + 10);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const codes = Object.fromEntries(conceptIds.map((id, i) => [id, String(pool[i])]));
  const order = [...conceptIds];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  return { seed, codes, order };
}

export function questionnaireData(p: Project, expertId: Id, kind: RoundKey, opts: { digits: 'fa' | 'latin'; deadlineText: string }): QData {
  const e = expertById(p, expertId);
  if (!e) throw new Error('unknown expert');
  const sched = p.settings.schedule[kind];
  const base = {
    kind,
    projectId: p.id,
    projectTitle: p.title,
    expertId,
    expertCode: e.code,
    consentText: p.settings.consentText,
    digits: opts.digits,
    deadline: sched.extendedTo ?? sched.deadline,
    deadlineText: opts.deadlineText,
    scale: p.scale,
    domains: p.domains.map((d) => ({ id: d.id, name: d.name, shortLabel: d.shortLabel, color: d.color })),
    valueLabels: p.settings.valueLabels,
    groups: [] as QData['groups'],
    concepts: [] as QData['concepts'],
    params: [] as QData['params'],
  };
  if (kind === 'r1' || kind === 'r2') {
    const list = kind === 'r1' ? round1Params(p) : round2Params(p);
    const fb =
      kind === 'r2'
        ? new Map(buildFeedback(expertId, list, Object.values(p.responses.r1), p.experts, p.domains, p.scale).map((f) => [f.paramId, f]))
        : null;
    base.groups = p.groups
      .map((g) => ({
        id: g.id,
        name: g.name,
        params: list
          .filter((x) => x.groupId === g.id)
          .map((x) => {
            const q = qParam(x);
            const f = fb?.get(x.id);
            if (f && !f.isNew) q.feedback = { byDomain: f.byDomain!, own: f.own };
            return q;
          }),
      }))
      .filter((g) => g.params.length > 0);
    return base;
  }
  // weighted Pugh scoring
  const key = p.weighted.blinding[expertId];
  if (!key) throw new Error('no blinding key');
  const ids = weightedConceptIds(p);
  base.concepts = key.order
    .filter((id) => ids.includes(id))
    .map((id) => {
      const c = p.concepts.find((x) => x.id === id)!;
      const shown = opts.digits === 'fa' ? key.codes[id].replace(/[0-9]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[+d]) : key.codes[id];
      return { code: key.codes[id], label: `طرح ${shown}`, sketch: c.sketch, description: c.description };
    });
  base.params = p.weighted.columns
    .map((col) => p.params.find((x) => x.id === col.paramId))
    .filter((x): x is Parameter => !!x)
    .map((x) => ({ id: x.id, code: x.code, name: x.name, requirement: x.requirement }));
  return base;
}

const escHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function questionnaireHtml(data: QData): string {
  const json = JSON.stringify(data).replace(/</g, '\\u003c');
  const sha = shaSource.replace(/^export /gm, '');
  const title = `${data.expertCode} — ${data.projectTitle}`;
  return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escHtml(title)}</title>
<style>
@font-face{font-family:'Vazirmatn';src:url(${fontUrl}) format('woff2');font-weight:100 900;font-display:swap}
${QUESTIONNAIRE_CSS}
</style>
</head>
<body>
<main id="app"><noscript>برای پاسخ به این پرسش‌نامه باید جاوااسکریپت مرورگر فعال باشد.</noscript></main>
<script type="application/json" id="qdata">${json}</script>
<script>
${sha}
${runtimeSource}
</script>
</body>
</html>
`;
}

export function questionnaireFileName(code: string, kind: RoundKey): string {
  return `${code}_${fileSuffix[kind]}_questionnaire.html`;
}
