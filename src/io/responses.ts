/**
 * Importing experts' answers: response files (.json from the offline questionnaire) and spreadsheets.
 * Every import is checked and previewed first (project, round, expert, checksum, unknown items, differences
 * with what is already stored); nothing changes until the researcher confirms (DECISIONS D-52, D-53).
 */
import type { Draft } from 'immer';
import {
  CJ,
  parseEnvelope,
  paramsOfRound,
  type DelphiPayload,
  type DelphiResponse,
  type Id,
  type Project,
  type PughPayload,
  type RatingValue,
  type ResponseKind,
} from '../core';
import { readRows, normHeader, type Row } from './sheets';
import { writeWorkbook } from './sheets';

export interface ImportItem {
  key: string;
  fileName: string;
  kind: ResponseKind | null;
  expertId: Id | null;
  expertCode: string;
  /** Blocking problems: the item cannot be imported. */
  problems: string[];
  /** Non-blocking warnings shown before confirming. */
  warnings: string[];
  /** Selected by default (false when the checksum failed). */
  defaultSelected: boolean;
  replaces: boolean;
  /** Answers that differ from the stored ones (only when replacing). */
  changed: number;
  answered: number;
  total: number;
  apply: ((d: Draft<Project>, today: string) => void) | null;
}

const KIND_FA: Record<ResponseKind, string> = { r1: 'دور اول', r2: 'دور دوم', pugh: 'ماتریس وزن‌دار' };

const isAns = (v: RatingValue | undefined) => v === CJ || typeof v === 'number';

/** Builds the stored Delphi response from a payload, keeping only known parameters and groups. */
function toResponse(p: Project, expertId: Id, round: 'r1' | 'r2', pl: DelphiPayload, source: DelphiResponse['source']): DelphiResponse {
  const ids = new Set(paramsOfRound(p, round).map((x) => x.id));
  const ratings: Record<Id, RatingValue> = {};
  for (const [k, v] of Object.entries(pl.ratings ?? {})) if (ids.has(k)) ratings[k] = v === CJ || typeof v === 'number' ? v : null;
  const groups = new Set(p.groups.map((g) => g.id));
  const openTexts: Record<Id, string> = {};
  for (const [k, v] of Object.entries(pl.openTexts ?? {})) if (groups.has(k) && typeof v === 'string' && v.trim()) openTexts[k] = v.trim();
  const allocation =
    round === 'r2' && pl.allocation
      ? {
          groupPoints: Object.fromEntries(Object.entries(pl.allocation.groupPoints ?? {}).filter(([k]) => groups.has(k))),
          paramPoints: Object.fromEntries(Object.entries(pl.allocation.paramPoints ?? {}).filter(([k]) => ids.has(k))),
        }
      : null;
  return {
    expertId,
    round,
    ratings,
    openTexts,
    allocation,
    consent: { given: !!pl.consent?.given, at: pl.consent?.at ?? null },
    source,
    receivedAt: new Date().toISOString(),
  };
}

function countChanged(prev: DelphiResponse | undefined, next: DelphiResponse): number {
  if (!prev) return 0;
  const keys = new Set([...Object.keys(prev.ratings), ...Object.keys(next.ratings)]);
  let n = 0;
  for (const k of keys) if ((prev.ratings[k] ?? null) !== (next.ratings[k] ?? null)) n++;
  return n;
}

function delphiItem(p: Project, base: Omit<ImportItem, 'apply' | 'replaces' | 'changed' | 'answered' | 'total'>, round: 'r1' | 'r2', resp: DelphiResponse, source: DelphiResponse['source']): ImportItem {
  const prev = p.responses[round][resp.expertId];
  const ids = paramsOfRound(p, round).map((x) => x.id);
  const answered = ids.filter((id) => isAns(resp.ratings[id])).length;
  const warnings = [...base.warnings];
  if (answered < ids.length) warnings.push(`${ids.length - answered} پرسش بی‌پاسخ`);
  if (!resp.consent.given) warnings.push('رضایت آگاهانه ثبت نشده است');
  if (round === 'r2' && !resp.allocation) warnings.push('توزیع امتیاز ندارد (از وزن‌دهی کنار گذاشته می‌شود)');
  return {
    ...base,
    warnings,
    replaces: !!prev,
    changed: countChanged(prev, resp),
    answered,
    total: ids.length,
    apply: base.problems.length
      ? null
      : (d, today) => {
          d.responses[round][resp.expertId] = { ...resp, source } as Draft<DelphiResponse>;
          const e = d.experts.find((x) => x.id === resp.expertId);
          if (e) {
            e.status[round] = { state: 'responded', date: today };
            if (resp.consent.given && !e.consentDate) e.consentDate = (resp.consent.at ?? today).slice(0, 10);
          }
        },
  };
}

/** Prepares response files (.json) for import. */
export async function prepareFileImports(files: File[], p: Project, expected: ResponseKind): Promise<ImportItem[]> {
  const items: ImportItem[] = [];
  for (const f of files) {
    const { envelope, problems } = parseEnvelope(await f.text(), p.id);
    const base = {
      key: f.name + ':' + Math.random().toString(36).slice(2),
      fileName: f.name,
      kind: envelope?.kind ?? null,
      expertId: null as Id | null,
      expertCode: envelope?.expertCode ?? '',
      problems: [] as string[],
      warnings: [] as string[],
      defaultSelected: true,
    };
    if (!envelope) {
      base.problems.push(problems.includes('not-json') ? 'فایل JSON نیست' : 'فایل پاسخ این برنامه نیست');
      items.push({ ...base, replaces: false, changed: 0, answered: 0, total: 0, apply: null });
      continue;
    }
    if (problems.includes('wrong-project')) base.problems.push('مربوط به پروژه دیگری است');
    if (envelope.kind !== expected) base.problems.push(`فایل ${KIND_FA[envelope.kind] ?? envelope.kind} است، نه ${KIND_FA[expected]}`);
    if (problems.includes('bad-checksum')) {
      base.warnings.push('کنترل صحت (checksum) نادرست است: فایل آسیب دیده یا دستی ویرایش شده است');
      base.defaultSelected = false;
    }
    const e = p.experts.find((x) => x.id === envelope.expertId) ?? p.experts.find((x) => x.code === envelope.expertCode);
    if (!e) base.problems.push(`خبره ${envelope.expertCode} در فهرست نیست`);
    else {
      base.expertId = e.id;
      if (e.code !== envelope.expertCode) base.warnings.push(`کد خبره در فایل ${envelope.expertCode} است و اکنون ${e.code}`);
      if (e.excludeAllData) base.warnings.push('این خبره با استفاده از داده‌هایش مخالفت کرده است؛ داده در تحلیل‌ها شمرده نمی‌شود');
    }
    if (!e || base.problems.length) {
      items.push({ ...base, replaces: false, changed: 0, answered: 0, total: 0, apply: null });
      continue;
    }
    if (expected === 'pugh') {
      items.push(pughItem(p, base, e.id, envelope.payload as PughPayload));
      continue;
    }
    const pl = envelope.payload as DelphiPayload;
    const known = new Set(paramsOfRound(p, expected).map((x) => x.id));
    const unknown = Object.keys(pl.ratings ?? {}).filter((k) => !known.has(k));
    if (unknown.length) base.warnings.push(`${unknown.length} پارامتر ناشناخته در فایل (نادیده گرفته می‌شود)`);
    items.push(delphiItem(p, base, expected, toResponse(p, e.id, expected, pl, 'file'), 'file'));
  }
  return items;
}

function pughItem(p: Project, base: Omit<ImportItem, 'apply' | 'replaces' | 'changed' | 'answered' | 'total'>, expertId: Id, pl: PughPayload): ImportItem {
  const key = p.weighted.blinding[expertId];
  const warnings = [...base.warnings];
  const problems = [...base.problems];
  if (!key) problems.push('کلید کدهای تصادفی این خبره پیدا نشد (فایل امتیازدهی از این پروژه ساخته نشده است)');
  const byCode = new Map(Object.entries(key?.codes ?? {}).map(([cid, code]) => [code, cid]));
  const cols = new Set(p.weighted.columns.map((c) => c.paramId));
  const scores: Record<Id, Record<Id, number | null>> = {};
  let answered = 0;
  let total = 0;
  for (const [code, byParam] of Object.entries(pl.scores ?? {})) {
    const cid = byCode.get(code);
    if (!cid) {
      warnings.push(`کانسپت با کد ${code} ناشناخته است`);
      continue;
    }
    scores[cid] = {};
    for (const [pid, v] of Object.entries(byParam ?? {})) {
      if (!cols.has(pid)) continue;
      total++;
      const ok = typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 5;
      scores[cid][pid] = ok ? v : null;
      if (ok) answered++;
    }
  }
  if (answered < total) warnings.push(`${total - answered} خانه بی‌پاسخ`);
  if (!pl.consent?.given) warnings.push('رضایت آگاهانه ثبت نشده است');
  const prev = p.weighted.scores[expertId];
  let changed = 0;
  if (prev)
    for (const [cid, byP] of Object.entries(scores)) for (const [pid, v] of Object.entries(byP)) if ((prev[cid]?.[pid] ?? null) !== v) changed++;
  return {
    ...base,
    problems,
    warnings,
    replaces: !!prev,
    changed,
    answered,
    total,
    apply: problems.length
      ? null
      : (d, today) => {
          d.weighted.scores[expertId] = scores;
          const e = d.experts.find((x) => x.id === expertId);
          if (e) e.status.pugh = { state: 'responded', date: today };
        },
  };
}

// ---------------------------------------------------------------------------------------------
// Spreadsheets (answers collected with any form tool, or typed into Excel)
// ---------------------------------------------------------------------------------------------

const OPEN_PREFIX = 'پاسخ باز — ';
const GROUP_ALLOC = 'توزیع گروه — ';
const PARAM_ALLOC = 'توزیع — ';

/** Template: one row per expert, one column per parameter (plus open answers or allocation columns). */
export function downloadResponseTemplate(p: Project, round: 'r1' | 'r2', expertIds: Id[]): void {
  const params = paramsOfRound(p, round);
  const header: Row = ['کد خبره', 'رضایت', ...params.map((x) => x.code)];
  if (round === 'r1') header.push(...p.groups.map((g) => OPEN_PREFIX + g.name));
  if (round === 'r2') header.push(...p.groups.map((g) => GROUP_ALLOC + g.name), ...params.map((x) => PARAM_ALLOC + x.code));
  const rows: Row[] = [header];
  for (const id of expertIds) {
    const e = p.experts.find((x) => x.id === id)!;
    const r = p.responses[round][id];
    const row: Row = [e.code, r ? (r.consent.given ? 'بله' : 'خیر') : null, ...params.map((x) => (r?.ratings[x.id] === CJ ? 'CJ' : (r?.ratings[x.id] as number | null) ?? null))];
    if (round === 'r1') row.push(...p.groups.map((g) => r?.openTexts[g.id] ?? null));
    if (round === 'r2')
      row.push(...p.groups.map((g) => r?.allocation?.groupPoints[g.id] ?? null), ...params.map((x) => r?.allocation?.paramPoints[x.id] ?? null));
    rows.push(row);
  }
  const guide: Row[] = [
    ['راهنما'],
    [`هر ردیف یک خبره (با کد). ستون‌های کد پارامتر: امتیاز ${p.scale.min} تا ${p.scale.max}؛ برای «${p.scale.cannotJudgeLabel}» بنویسید CJ یا ق؛ خالی = بی‌پاسخ.`],
    ['ستون رضایت: بله / خیر.'],
    ...(round === 'r1' ? [['ستون‌های «پاسخ باز»: متن پیشنهاد پارامتر جدید یا توضیح برای هر گروه.'] as Row] : []),
    ...(round === 'r2' ? [['ستون‌های «توزیع گروه»: ۱۰۰ امتیاز میان گروه‌ها؛ ستون‌های «توزیع»: ۱۰۰ امتیاز میان پارامترهای هر گروه.'] as Row] : []),
    ...params.map((x) => [`${x.code}: ${x.name}`] as Row),
  ];
  writeWorkbook(
    [
      { name: round === 'r1' ? 'round1' : 'round2', rows, widths: [10, 8, ...params.map(() => 7)] },
      { name: 'guide', rows: guide, widths: [100] },
    ],
    `responses-${round === 'r1' ? 'round1' : 'round2'}-template.xlsx`,
  );
}

const parseCell = (v: unknown): RatingValue => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const s = String(v).trim();
  if (/^(cj|ق|؟|\?|x|×|na|n\/a)$/i.test(s)) return CJ;
  const n = Number(s.replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/[٫،,]/g, '.'));
  return Number.isFinite(n) ? n : null;
};
const parseNum = (v: unknown): number | null => {
  const r = parseCell(v);
  return typeof r === 'number' ? r : null;
};
const yes = (v: unknown) => /^(بله|آری|yes|y|1|true|✓)$/i.test(String(v ?? '').trim());

export async function prepareSheetImport(file: File, p: Project, round: 'r1' | 'r2'): Promise<{ items: ImportItem[]; problems: string[] }> {
  const rows = await readRows(file);
  if (!rows.length) return { items: [], problems: ['فایل خالی است'] };
  const head = rows[0].map((h) => String(h ?? '').trim());
  const norm = head.map(normHeader);
  const codeCol = norm.findIndex((h) => ['کدخبره', 'کد', 'code', 'expert', 'expertcode'].includes(h));
  if (codeCol < 0) return { items: [], problems: ['ستون «کد خبره» پیدا نشد'] };
  const consentCol = norm.findIndex((h) => ['رضایت', 'consent'].includes(h));
  const params = paramsOfRound(p, round);
  const col = (label: string) => head.findIndex((h) => normHeader(h) === normHeader(label));
  const pCols = params.map((x) => ({ id: x.id, c: col(x.code) }));
  const missing = params.filter((_, i) => pCols[i].c < 0).map((x) => x.code);
  const problems = missing.length ? [`ستون پارامترهای ${missing.join('، ')} پیدا نشد (بی‌پاسخ شمرده می‌شوند)`] : [];
  const items: ImportItem[] = [];
  rows.slice(1).forEach((r, i) => {
    const code = String(r[codeCol] ?? '').trim();
    if (!code) return;
    const e = p.experts.find((x) => x.code === code);
    const base = {
      key: `${i}:${code}`,
      fileName: `${file.name} — ردیف ${i + 2}`,
      kind: round,
      expertId: e?.id ?? null,
      expertCode: code,
      problems: e ? [] : [`خبره ${code} در فهرست نیست`],
      warnings: [] as string[],
      defaultSelected: true,
    };
    if (!e) {
      items.push({ ...base, replaces: false, changed: 0, answered: 0, total: 0, apply: null });
      return;
    }
    const pl: DelphiPayload = {
      consent: { given: consentCol >= 0 ? yes(r[consentCol]) : false, at: null },
      ratings: Object.fromEntries(pCols.map(({ id, c }) => [id, c >= 0 ? parseCell(r[c]) : null])),
      openTexts:
        round === 'r1'
          ? Object.fromEntries(p.groups.map((g) => [g.id, String(r[col(OPEN_PREFIX + g.name)] ?? '').trim()]).filter(([, t]) => t))
          : {},
      allocation:
        round === 'r2'
          ? {
              groupPoints: Object.fromEntries(p.groups.map((g) => [g.id, parseNum(r[col(GROUP_ALLOC + g.name)])])),
              paramPoints: Object.fromEntries(params.map((x) => [x.id, parseNum(r[col(PARAM_ALLOC + x.code)])])),
            }
          : null,
      submittedAt: new Date().toISOString(),
    };
    if (pl.allocation && !Object.values(pl.allocation.groupPoints).some((v) => v !== null)) pl.allocation = null;
    const bad = Object.values(pl.ratings).filter((v) => typeof v === 'number' && !(Number.isInteger(v) && v >= p.scale.min && v <= p.scale.max)).length;
    if (bad) base.warnings.push(`${bad} مقدار خارج از مقیاس (نامعتبر شمرده می‌شود)`);
    items.push(delphiItem(p, base, round, toResponse(p, e.id, round, pl, 'sheet'), 'sheet'));
  });
  return { items, problems };
}
