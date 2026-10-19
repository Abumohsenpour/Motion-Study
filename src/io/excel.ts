/**
 * Excel workbook (.xlsx) — the main output (build request § 5).
 *
 * The workbook holds the raw data and recomputes the results with live Excel formulas wherever practical, so a
 * reviewer can retrace every number: band counts (COUNTIFS), percentages, median and quartiles (MEDIAN,
 * QUARTILE.INC = type 7, the app's method), the consensus rule (IF on integer comparisons), relations ۱–۵ from the
 * allocation sheet, relations ۶–۸ (MEDIAN, AVERAGE, SUMPRODUCT), ranking (RANK) and the sensitivity scenarios.
 * Every formula cell also carries the value computed by the app, so the file reads correctly before Excel
 * recalculates. Experts appear by code only.
 */
import * as XLSX from 'xlsx';
import {
  CJ,
  candidateRows,
  codeOf,
  designBrief,
  openAnswers,
  paramsOfRound,
  projectWeights,
  respondents,
  round2Analysis,
  roundStats,
  screeningAnalysis,
  weightedAnalysis,
  type Expert,
  type Id,
  type Project,
  type ScreeningRun,
  cellSymbol,
  panelDescription,
  responseRates,
} from '../core';
import { settingsDeviations } from '../app/deviations';
import { EXCLUSION_FA, STATUS_FA } from '../report/weightsSections';
import { REASON_FA } from '../screens/screeningReasons';

type V = string | number | boolean | null | undefined;
interface FormulaCell {
  f: string;
  v?: V;
  z?: string;
}
interface ValueCell {
  v: V;
  z?: string;
}
type CellIn = V | FormulaCell | ValueCell;

const isObj = (c: CellIn): c is FormulaCell | ValueCell => typeof c === 'object' && c !== null;

export class Sheet {
  data: CellIn[][] = [];
  widths: number[] = [];
  constructor(public name: string) {}
  /** Appends a row; returns its 1-based row number. */
  row(...cells: CellIn[]): number {
    this.data.push(cells);
    return this.data.length;
  }
  blank() {
    this.data.push([]);
  }
  get next(): number {
    return this.data.length + 1;
  }
}

/** Column letter from a 0-based index. */
export const col = (c: number): string => XLSX.utils.encode_col(c);
export const a1 = (r: number, c: number, abs = false): string => (abs ? `$${col(c)}$${r}` : `${col(c)}${r}`);
export const range = (r1: number, c1: number, r2: number, c2: number): string => `$${col(c1)}$${r1}:$${col(c2)}$${r2}`;
export const sref = (sheet: string, ref: string): string => `'${sheet.replace(/'/g, "''")}'!${ref}`;
const num = (x: number | null | undefined): number | string => (x === null || x === undefined || !Number.isFinite(x) ? '' : x);
const F = (f: string, v: V, z?: string): FormulaCell => ({ f, v: v === undefined || v === null || (typeof v === 'number' && !Number.isFinite(v)) ? '' : v, z });
const Z = { w: '0.0000', pct: '0.0%', d2: '0.00', d3: '0.000' };

function toWorksheet(s: Sheet): XLSX.WorkSheet {
  const ws: XLSX.WorkSheet = {};
  let maxC = 0;
  s.data.forEach((row, r) =>
    row.forEach((c, ci) => {
      if (c === null || c === undefined || c === '') return;
      const addr = XLSX.utils.encode_cell({ r, c: ci });
      let cell: XLSX.CellObject;
      if (isObj(c)) {
        const v = c.v ?? '';
        cell = { t: typeof v === 'number' ? 'n' : typeof v === 'boolean' ? 'b' : 's', v } as XLSX.CellObject;
        // Functions newer than Excel 2007 must be stored with the _xlfn. prefix in the file (Excel shows the plain name).
        if ('f' in c) cell.f = c.f.replace(/\bQUARTILE\.INC\(/g, '_xlfn.QUARTILE.INC(');
        if (c.z) cell.z = c.z;
      } else cell = { t: typeof c === 'number' ? 'n' : typeof c === 'boolean' ? 'b' : 's', v: c } as XLSX.CellObject;
      ws[addr] = cell;
      maxC = Math.max(maxC, ci);
    }),
  );
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, s.data.length - 1), c: maxC } });
  if (s.widths.length) ws['!cols'] = s.widths.map((wch) => ({ wch }));
  return ws;
}

// ---------------------------------------------------------------------------------------------
// Sheet names (Persian, ≤ 31 characters)
// ---------------------------------------------------------------------------------------------

export const SHEETS = {
  readme: 'راهنما',
  experts: 'خبرگان',
  params: 'پارامترها',
  panel: 'توصیف پنل',
  r1raw: 'دور۱-پاسخ‌ها',
  r1res: 'دور۱-نتایج',
  open: 'پاسخ‌های باز',
  r2raw: 'دور۲-پاسخ‌ها',
  r2res: 'دور۲-اجماع',
  alloc: 'توزیع امتیاز',
  weights: 'وزن‌ها (روابط ۱-۵)',
  brief: 'تفهیم‌نامه طراحی',
  run1: 'غربال-اجرای۱',
  run2: 'غربال-اجرای۲',
  pughScores: 'پیو-امتیازها (روابط ۶-۷)',
  pugh: 'پیو-وزن‌دار (رابطه ۸)',
  sens: 'تحلیل حساسیت',
  log: 'دفتر تغییرات',
};

const README_ROWS: [string, string][] = [
  [SHEETS.experts, 'فهرست خبرگان فقط با کد (بدون نام): حوزه، دامنه سابقه کار، نوع فعالیت، وضعیت هر دور و مخالفت با استفاده از داده.'],
  [SHEETS.params, 'پارامترها: کد، نام، گروه معنایی، الزام طراحی، توضیح، محدوده عددی، منبع و منشأ (فهرست اولیه یا افزوده در دور دوم).'],
  [SHEETS.panel, 'توصیف تجمیعی پنل (فراوانی، درصد، میانه و چارک‌ها) و نرخ پاسخ و افت هر دور، کلی و به تفکیک حوزه.'],
  [SHEETS.r1raw, 'پاسخ‌های خام دور اول (پاسخ‌دهندگان، مرتب بر حسب حوزه). CJ = «توانایی قضاوت ندارم»؛ خانه خالی = بی‌پاسخ.'],
  [SHEETS.r1res, 'آمار دور اول با فرمول: n معتبر (COUNTIFS)، تعداد و درصد هر طبقه، میانه و چارک‌ها (QUARTILE.INC)، کل و به تفکیک حوزه.'],
  [SHEETS.open, 'پاسخ‌های باز دور اول (متن قابل‌انتشار)، کدگذاری، و پارامترهای نامزد با قاعده ۲۰٪.'],
  [SHEETS.r2raw, 'پاسخ‌های خام دور دوم.'],
  [SHEETS.r2res, 'آمار دور دوم و وضعیت اجماع با فرمول (مقایسه عدد صحیح count×۱۰۰ با آستانه×n).'],
  [SHEETS.alloc, 'امتیازهای خام توزیع سلسله‌مراتبی (گروه‌ها و پارامترها) در دور دوم.'],
  [SHEETS.weights, 'روابط ۱ تا ۵ با فرمول از برگه توزیع امتیاز: مجموع پارامترهای حفظ‌شده هر گروه، امتیاز قابل‌استفاده گروه، رابطه ۲، رابطه ۱، رابطه ۳ و Σ برای هر خبره؛ رابطه ۴ (AVERAGEIFS)، رابطه ۵ و دامنه بین چارکی.'],
  [SHEETS.brief, 'تفهیم‌نامه طراحی: پارامترهای حفظ‌شده، الزام طراحی، Wᵢ و IQR؛ و فهرست پارامترهای حذف‌شده و فاقد اجماع.'],
  [SHEETS.run1, 'غربال پیو، اجرای اول: ماتریس نماد اکثریت، شمارش +/−/S و امتیاز خالص با فرمول، قاعده مغلوب‌بودن، و آرای هر ارزیاب.'],
  [SHEETS.run2, 'غربال پیو، اجرای دوم (مرجع = کانسپت برتر اجرای اول) و جدول راه‌یابی به ماتریس وزن‌دار با دلیل.'],
  [SHEETS.pughScores, 'امتیازهای ۱ تا ۵ هر خبره (ستون‌ها به تفکیک حوزه)، رابطه ۶ (MEDIAN هر حوزه)، چارک‌ها، و رابطه ۷ (AVERAGE حوزه‌ها).'],
  [SHEETS.pugh, 'رابطه ۸ (SUMPRODUCT وزن‌ها × امتیاز تجمیعی) و رتبه (RANK).'],
  [SHEETS.sens, 'تحلیل حساسیت تک‌عاملی (±۲۰٪ هر وزن و نرمال‌سازی) با فرمول، و نقطه سربه‌سر هر پارامتر.'],
  [SHEETS.log, 'تغییر معیارها پس از شروع گردآوری داده و دفتر تغییرات.'],
];

// ---------------------------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------------------------

const domainName = (p: Project, id: Id) => p.domains.find((d) => d.id === id)?.name ?? '';
const expRange = (p: Project, y: number | null) => {
  if (y === null) return '';
  const e = p.settings.experienceEdges;
  const i = e.filter((x) => y >= x).length;
  return i === 0 ? `کمتر از ${e[0]}` : i === e.length ? `${e[e.length - 1]} و بیشتر` : `${e[i - 1]} تا ${e[i] - 1}`;
};

/** Experts of a round sorted by domain order (contiguous domain blocks make per-domain formulas simple). */
function byDomain(p: Project, experts: Expert[]): Expert[] {
  const order = new Map(p.domains.map((d, i) => [d.id, i]));
  const idx = new Map(p.experts.map((e, i) => [e.id, i]));
  return [...experts].sort((a, b) => (order.get(a.domainId) ?? 99) - (order.get(b.domainId) ?? 99) || idx.get(a.id)! - idx.get(b.id)!);
}

function rawRatings(p: Project, round: 'r1' | 'r2', name: string) {
  const s = new Sheet(name);
  const params = paramsOfRound(p, round);
  const experts = byDomain(p, respondents(p, round));
  s.row('کد خبره', 'حوزه', ...params.map((x) => x.code));
  const blocks: Record<Id, [number, number]> = {};
  for (const e of experts) {
    const r = p.responses[round][e.id];
    const rn = s.row(e.code, domainName(p, e.domainId), ...params.map((x) => {
      const v = r.ratings[x.id];
      return v === CJ ? 'CJ' : typeof v === 'number' ? v : null;
    }));
    const b = blocks[e.domainId];
    blocks[e.domainId] = b ? [b[0], rn] : [rn, rn];
  }
  s.widths = [10, 26, ...params.map(() => 7)];
  return { sheet: s, params, firstRow: 2, lastRow: experts.length + 1, blocks };
}

function statsSheet(p: Project, round: 'r1' | 'r2', raw: ReturnType<typeof rawRatings>, name: string) {
  const s = new Sheet(name);
  const stats = roundStats(p, round);
  const cons = round === 'r2' ? round2Analysis(p) : null;
  const bands = p.scale.bands;
  const t = p.settings.consensus;
  const header = ['کد', 'پارامتر', 'n معتبر', 'CJ', 'خالی', ...bands.map((b) => `تعداد ${b.label} (${b.from}-${b.to})`), ...bands.map((b) => `٪ ${b.label}`), 'میانه', 'Q1', 'Q3', 'IQR'];
  if (cons) header.push('وضعیت اجماع');
  const block = (title: string, r1: number, r2: number, statsOf: (i: number) => (typeof stats)[number]['overall'], withConsensus: boolean) => {
    s.row(title);
    s.row(...header.slice(0, withConsensus ? header.length : header.length - (cons ? 1 : 0)));
    raw.params.forEach((prm, i) => {
      const st = statsOf(i);
      const R = r2 >= r1 ? sref(raw.sheet.name, range(r1, 2 + i, r2, 2 + i)) : null;
      const rn = s.next;
      const nC = 2;
      const cjC = 3;
      const cntC = 5;
      const pctC = cntC + bands.length;
      const medC = pctC + bands.length;
      const cells: CellIn[] = [prm.code, prm.name];
      if (!R) {
        cells.push(0, 0, 0, ...bands.map(() => 0), ...bands.map(() => ''), '', '', '', '');
        if (withConsensus) cells.push(STATUS_FA.none);
        s.row(...cells);
        return;
      }
      cells.push(F(`COUNTIFS(${R},">=${p.scale.min}",${R},"<=${p.scale.max}")`, st.n));
      cells.push(F(`COUNTIF(${R},"CJ")`, st.nCannotJudge));
      cells.push(F(`ROWS(${R})-${a1(rn, nC)}-${a1(rn, cjC)}`, st.nMissing));
      bands.forEach((b, bi) => cells.push(F(`COUNTIFS(${R},">=${b.from}",${R},"<=${b.to}")`, st.counts[bi])));
      bands.forEach((_, bi) => cells.push(F(`IF(${a1(rn, nC)}=0,"",${a1(rn, cntC + bi)}/${a1(rn, nC)})`, st.n ? st.counts[bi] / st.n : '', Z.pct)));
      cells.push(F(`IF(${a1(rn, nC)}=0,"",MEDIAN(${R}))`, num(st.median), Z.d2));
      cells.push(F(`IF(${a1(rn, nC)}=0,"",QUARTILE.INC(${R},1))`, num(st.q1), Z.d2));
      cells.push(F(`IF(${a1(rn, nC)}=0,"",QUARTILE.INC(${R},3))`, num(st.q3), Z.d2));
      cells.push(F(`IF(${a1(rn, nC)}=0,"",${a1(rn, medC + 2)}-${a1(rn, medC + 1)})`, num(st.iqr), Z.d2));
      if (withConsensus && cons) {
        const n = a1(rn, nC);
        const bottom = a1(rn, cntC);
        const top = a1(rn, cntC + bands.length - 1);
        cells.push(
          F(
            `IF(${n}=0,"${STATUS_FA.none}",IF(AND(${top}*100>=${t.retainTopMin}*${n},${bottom}*100<=${t.retainBottomMax}*${n}),"${STATUS_FA.retain}",IF(AND(${bottom}*100>=${t.removeBottomMin}*${n},${top}*100<=${t.removeTopMax}*${n}),"${STATUS_FA.remove}","${STATUS_FA.none}")))`,
            STATUS_FA[cons[i].consensus.status],
          ),
        );
      }
      s.row(...cells);
    });
    s.blank();
  };
  block('کل پنل', raw.firstRow, raw.lastRow, (i) => stats[i].overall, !!cons);
  for (const d of p.domains) {
    const b = raw.blocks[d.id];
    block(`حوزه: ${d.name}`, b?.[0] ?? 1, b?.[1] ?? 0, (i) => stats[i].byDomain[d.id], false);
  }
  if (cons)
    s.row(
      `قاعده اجماع: حفظ = دست‌کم ${t.retainTopMin}٪ در طبقه بالا و حداکثر ${t.retainBottomMax}٪ در طبقه پایین؛ حذف = دست‌کم ${t.removeBottomMin}٪ در طبقه پایین و حداکثر ${t.removeTopMax}٪ در طبقه بالا؛ مقایسه با عدد صحیح (تعداد×۱۰۰ در برابر آستانه×n).`,
    );
  s.widths = [8, 34, 8, 6, 6, ...bands.map(() => 11), ...bands.map(() => 9), 8, 8, 8, 8, 12];
  return s;
}

function weightsSheets(p: Project) {
  const params = paramsOfRound(p, 'r2');
  const w = projectWeights(p);
  // allocation raw sheet
  const al = new Sheet(SHEETS.alloc);
  const experts = byDomain(
    p,
    respondents(p, 'r2').filter((e) => p.responses.r2[e.id]?.allocation),
  );
  al.row('کد خبره', 'حوزه', ...p.groups.map((g) => `گروه: ${g.name}`), ...params.map((x) => x.code));
  const allocRow = new Map<Id, number>();
  for (const e of experts) {
    const a = p.responses.r2[e.id].allocation!;
    const rn = al.row(e.code, domainName(p, e.domainId), ...p.groups.map((g) => num(a.groupPoints[g.id])), ...params.map((x) => num(a.paramPoints[x.id])));
    allocRow.set(e.id, rn);
  }
  al.widths = [10, 26, ...p.groups.map(() => 14), ...params.map(() => 7)];
  const gCol = (gi: number) => 2 + gi;
  const pCol = (pid: Id) => 2 + p.groups.length + params.findIndex((x) => x.id === pid);

  // weights sheet
  const s = new Sheet(SHEETS.weights);
  if (!w.retainedParams.length) {
    s.row('هیچ پارامتری به اجماع حفظ نرسیده است؛ وزنی محاسبه نمی‌شود.');
    return { alloc: al, weights: s, w, retained: [] as Id[], wRow: 0 };
  }
  const groups = w.retainedGroups;
  const retained = w.retainedParams;
  const groupOf = (pid: Id) => p.params.find((x) => x.id === pid)!.groupId;
  s.row('روابط ۱ تا ۵ — فقط برای پارامترهای حفظ‌شده. S = مجموع امتیاز خبره به پارامترهای حفظ‌شده گروه؛ U = امتیاز گروه اگر S>0 وگرنه ۰ (DECISIONS D-22)؛ D = مجموع U؛ رابطه ۲ = U/D؛ رابطه ۱ = امتیاز پارامتر/S؛ رابطه ۳ = رابطه ۲ × رابطه ۱.');
  const head: string[] = ['کد خبره', 'حوزه'];
  const cS: Record<Id, number> = {};
  const cU: Record<Id, number> = {};
  const cR2: Record<Id, number> = {};
  const cR1: Record<Id, number> = {};
  const cR3: Record<Id, number> = {};
  for (const g of groups) {
    cS[g] = head.length;
    head.push(`S ${p.groups.find((x) => x.id === g)!.name}`);
  }
  for (const g of groups) {
    cU[g] = head.length;
    head.push(`U ${p.groups.find((x) => x.id === g)!.name}`);
  }
  const cD = head.length;
  head.push('D');
  for (const g of groups) {
    cR2[g] = head.length;
    head.push(`رابطه۲ ${p.groups.find((x) => x.id === g)!.name}`);
  }
  for (const pid of retained) {
    cR1[pid] = head.length;
    head.push(`رابطه۱ ${p.params.find((x) => x.id === pid)!.code}`);
  }
  for (const pid of retained) {
    cR3[pid] = head.length;
    head.push(`رابطه۳ ${p.params.find((x) => x.id === pid)!.code}`);
  }
  const cSum = head.length;
  head.push('Σ رابطه۳');
  s.row(...head);
  const included = byDomain(
    p,
    w.perExpert.map((x) => p.experts.find((e) => e.id === x.expertId)!),
  );
  const firstRow = s.next;
  for (const e of included) {
    const ew = w.perExpert.find((x) => x.expertId === e.id)!;
    const ar = allocRow.get(e.id)!;
    const rn = s.next;
    const cell = (c: number) => sref(SHEETS.alloc, a1(ar, c));
    const row: CellIn[] = [e.code, domainName(p, e.domainId)];
    for (const g of groups) {
      const ids = retained.filter((pid) => groupOf(pid) === g);
      const val = ids.reduce((t, pid) => t + (Number(p.responses.r2[e.id].allocation!.paramPoints[pid]) || 0), 0);
      row[cS[g]] = F(`SUM(${ids.map((pid) => cell(pCol(pid))).join(',')})`, val);
    }
    for (const g of groups) {
      const gi = p.groups.findIndex((x) => x.id === g);
      const gp = Number(p.responses.r2[e.id].allocation!.groupPoints[g]) || 0;
      row[cU[g]] = F(`IF(${a1(rn, cS[g])}>0,N(${cell(gCol(gi))}),0)`, ew.droppedGroups.includes(g) ? 0 : Math.max(0, gp));
    }
    row[cD] = F(`SUM(${groups.map((g) => a1(rn, cU[g])).join(',')})`, groups.reduce((t, g) => t + (ew.droppedGroups.includes(g) ? 0 : Math.max(0, Number(p.responses.r2[e.id].allocation!.groupPoints[g]) || 0)), 0));
    for (const g of groups) row[cR2[g]] = F(`IF(${a1(rn, cD)}=0,"",${a1(rn, cU[g])}/${a1(rn, cD)})`, ew.groupWeight[g], Z.w);
    for (const pid of retained) row[cR1[pid]] = F(`IF(${a1(rn, cS[groupOf(pid)])}=0,0,N(${cell(pCol(pid))})/${a1(rn, cS[groupOf(pid)])})`, ew.withinWeight[pid], Z.w);
    for (const pid of retained) row[cR3[pid]] = F(`${a1(rn, cR2[groupOf(pid)])}*${a1(rn, cR1[pid])}`, ew.overall[pid], Z.w);
    row[cSum] = F(`SUM(${a1(rn, cR3[retained[0]] ?? cSum)}:${a1(rn, cR3[retained[retained.length - 1]] ?? cSum)})`, ew.sum, Z.w);
    s.row(...row);
  }
  const lastRow = s.next - 1;
  s.blank();
  // relations 4 and 5
  s.row('رابطه ۴ (میانگین وزن‌های کلی خبرگان هر حوزه) و رابطه ۵ (میانگین حوزه‌های دارای داده)');
  s.row('حوزه', '', ...retained.map((pid) => p.params.find((x) => x.id === pid)!.code), 'Σ');
  const domRows: number[] = [];
  for (const d of p.domains) {
    const rn = s.next;
    domRows.push(rn);
    const dw = w.domainWeights[d.id];
    s.row(
      d.name,
      dw ? '' : 'بدون توزیع‌کننده معتبر',
      ...retained.map((pid) =>
        F(`IFERROR(AVERAGEIFS(${range(firstRow, cR3[pid], lastRow, cR3[pid])},${range(firstRow, 1, lastRow, 1)},"${d.name.replace(/"/g, '""')}"),"")`, dw ? dw[pid] : '', Z.w),
      ),
      F(`SUM(${a1(rn, 2)}:${a1(rn, 1 + retained.length)})`, dw ? 1 : 0, Z.w),
    );
  }
  const wRow = s.next;
  s.row(
    'Wᵢ (رابطه ۵)',
    '',
    ...retained.map((pid, i) => F(`AVERAGE(${a1(domRows[0], 2 + i)}:${a1(domRows[domRows.length - 1], 2 + i)})`, w.final[pid], Z.w)),
    F(`SUM(${a1(wRow, 2)}:${a1(wRow, 1 + retained.length)})`, w.checks.finalSum, Z.w),
  );
  s.row('Wᵢ × ۱۰۰', '', ...retained.map((pid, i) => F(`${a1(wRow, 2 + i)}*100`, 100 * w.final[pid], Z.d2)));
  const q = (k: 1 | 3, label: string) =>
    s.row(label, '', ...retained.map((pid) => F(`QUARTILE.INC(${range(firstRow, cR3[pid], lastRow, cR3[pid])},${k})`, k === 1 ? w.agreement[pid].q1 : w.agreement[pid].q3, Z.w)));
  const q1r = q(1, 'Q1 وزن‌های فردی');
  const q3r = q(3, 'Q3 وزن‌های فردی');
  s.row('IQR', '', ...retained.map((pid, i) => F(`${a1(q3r, 2 + i)}-${a1(q1r, 2 + i)}`, w.agreement[pid].iqr, Z.w)));
  s.blank();
  if (w.excluded.length) {
    s.row('خبرگان کنار گذاشته‌شده از وزن‌دهی');
    for (const x of w.excluded) s.row(codeOf(p, x.expertId), EXCLUSION_FA[x.reason]);
  }
  s.widths = [16, 22, ...head.slice(2).map(() => 11)];
  return { alloc: al, weights: s, w, retained, wRow };
}

function runSheet(p: Project, run: 1 | 2, name: string) {
  const a = screeningAnalysis(p);
  const s = new Sheet(name);
  const res = run === 1 ? a.run1 : a.run2;
  if (!res) {
    s.row('این اجرا هنوز انجام نشده است.');
    return s;
  }
  const runData: ScreeningRun = run === 1 ? p.screening.run1 : a.run2UsesRun1Votes ? p.screening.run1 : p.screening.run2;
  const datum = res.datumId;
  const concepts = [datum, ...p.concepts.map((c) => c.id).filter((c) => c in res.totals)];
  const code = (id: Id) => p.concepts.find((c) => c.id === id)?.code ?? '';
  const sym = (v: string | null) => (v === '-' ? '−' : v ?? '');
  s.row(`غربال پیو — اجرای ${run === 1 ? 'اول' : 'دوم'}؛ مرجع: ${code(datum)}. نماد هر خانه = رأی اکثریت ارزیاب‌ها (تساوی = S).`);
  s.row('پارامتر', ...concepts.map((c) => (c === datum ? `${code(c)} (مرجع)` : code(c))));
  const first = s.next;
  for (const pid of a.paramIds)
    s.row(p.params.find((x) => x.id === pid)?.code ?? '', ...concepts.map((c) => (c === datum ? 'مرجع' : sym(cellSymbol(p, runData, c, pid)))));
  const last = s.next - 1;
  const cnt = (label: string, crit: string, key: 'plus' | 'minus' | 'same') =>
    s.row(label, ...concepts.map((c, i) => (c === datum ? '' : F(`COUNTIF(${range(first, 1 + i, last, 1 + i)},"${crit}")`, res.totals[c][key]))));
  const plusR = cnt('تعداد +', '+', 'plus');
  const minusR = cnt('تعداد −', '−', 'minus');
  cnt('تعداد S', 'S', 'same');
  s.row('امتیاز خالص', ...concepts.map((c, i) => (c === datum ? 0 : F(`${a1(plusR, 1 + i)}-${a1(minusR, 1 + i)}`, res.totals[c].net))));
  s.row(
    'مغلوب مرجع؟',
    ...concepts.map((c, i) => (c === datum ? '' : F(`IF(AND(${a1(plusR, 1 + i)}=0,${a1(minusR, 1 + i)}>=1),"مغلوب — حذف","")`, res.totals[c].dominated ? 'مغلوب — حذف' : ''))),
  );
  s.blank();
  if (run === 2) {
    s.row('راه‌یابی به ماتریس وزن‌دار');
    s.row('کانسپت', 'نام', 'امکان‌پذیر', 'نتیجه قاعده', 'تصمیم دستی', 'دلیل تصمیم دستی', 'راه‌یافته');
    for (const f of a.final) {
      const c = p.concepts.find((x) => x.id === f.conceptId)!;
      s.row(c.code, c.name, c.feasible ? 'بله' : 'خیر', REASON_FA[f.ruleReason], f.override ? (f.override.forward ? 'راه یابد' : 'راه نیابد') : '', f.override?.reason ?? '', f.forward ? 'بله' : 'خیر');
    }
    s.blank();
  }
  s.row('آرای هر ارزیاب');
  s.row('ارزیاب', 'کانسپت', 'پارامتر', 'رأی');
  const raters = p.screening.mode === 'single' ? p.screening.raters.slice(0, 1) : p.screening.raters;
  for (const r of raters)
    for (const c of concepts.filter((x) => x !== datum))
      for (const pid of a.paramIds) s.row(r.label, code(c), p.params.find((x) => x.id === pid)?.code ?? '', sym(runData.votes[r.id]?.[c]?.[pid] ?? null));
  s.widths = [16, ...concepts.map(() => 12)];
  return s;
}

function pughSheets(p: Project, partA: Record<Id, number>) {
  const a = weightedAnalysis(p, partA);
  const cols = p.weighted.columns;
  const single = p.weighted.mode === 'single';
  const domains = single ? [{ id: '__single', name: 'امتیازدهنده' }] : p.domains;
  const raters = a.raters;
  const ccode = (id: Id) => p.concepts.find((c) => c.id === id)?.code ?? '';
  const pcode = (id: Id) => p.params.find((x) => x.id === id)?.code ?? '';
  const sc = new Sheet(SHEETS.pughScores);
  sc.row('امتیاز هر خبره به هر کانسپت در هر پارامتر (۱ تا ۵)؛ ستون‌ها به تفکیک حوزه. رابطه ۶ = میانه حوزه؛ رابطه ۷ = میانگین حوزه‌ها.');
  const head: string[] = ['کانسپت', 'پارامتر'];
  const dCols: Record<Id, [number, number]> = {};
  for (const d of domains) {
    const rs = raters.filter((r) => r.domainId === d.id);
    if (!rs.length) continue;
    dCols[d.id] = [head.length, head.length + rs.length - 1];
    for (const r of rs) head.push(single ? 'امتیاز' : `${codeOf(p, r.expertId)} (${d.name})`);
  }
  const medCol: Record<Id, number> = {};
  for (const d of domains) {
    medCol[d.id] = head.length;
    head.push(`رابطه ۶: میانه ${d.name}`, `Q1 ${d.name}`, `Q3 ${d.name}`);
  }
  const aggCol = head.length;
  head.push('رابطه ۷: امتیاز تجمیعی');
  sc.row(...head);
  const aggRef: Record<string, string> = {};
  for (const cid of a.conceptIds) {
    for (const col of cols) {
      const rn = sc.next;
      const row: CellIn[] = [ccode(cid), pcode(col.paramId)];
      for (const d of domains) {
        const rs = raters.filter((r) => r.domainId === d.id);
        rs.forEach((r, i) => (row[(dCols[d.id]?.[0] ?? 0) + i] = num(p.weighted.scores[r.expertId]?.[cid]?.[col.paramId] ?? null)));
      }
      const cell = a.result.cells[cid][col.paramId];
      for (const d of domains) {
        const dc = dCols[d.id];
        const q = cell.byDomain[d.id];
        if (!dc) {
          row[medCol[d.id]] = '';
          continue;
        }
        const R = `${a1(rn, dc[0])}:${a1(rn, dc[1])}`;
        row[medCol[d.id]] = F(`IFERROR(MEDIAN(${R}),"")`, num(cell.domainScore[d.id]), Z.d2);
        row[medCol[d.id] + 1] = F(`IFERROR(QUARTILE.INC(${R},1),"")`, num(q.q1), Z.d2);
        row[medCol[d.id] + 2] = F(`IFERROR(QUARTILE.INC(${R},3),"")`, num(q.q3), Z.d2);
      }
      row[aggCol] = F(`IFERROR(AVERAGE(${domains.map((d) => a1(rn, medCol[d.id])).join(',')}),"")`, num(cell.aggregated), Z.d2);
      aggRef[`${cid}|${col.paramId}`] = sref(SHEETS.pughScores, a1(rn, aggCol, true));
      sc.row(...row);
    }
  }
  sc.widths = [10, 8, ...head.slice(2).map(() => 12)];

  const s = new Sheet(SHEETS.pugh);
  s.row('رابطه ۸: امتیاز وزنی = Σ (Wᵢ × امتیاز تجمیعی)؛ رتبه با RANK (رتبه‌بندی رقابتی). کانسپت با خانه خالی رتبه نمی‌گیرد.');
  s.row('', ...cols.map((c) => pcode(c.paramId)), 'امتیاز وزنی', 'رتبه');
  const wr = s.next;
  s.row('Wᵢ', ...cols.map((c) => ({ v: c.weight, z: Z.w })), F(`SUM(${a1(wr, 1)}:${a1(wr, cols.length)})`, a.weightSum, Z.w));
  const first = s.next;
  const last = first + a.conceptIds.length - 1;
  const rank = new Map(a.result.ranking.map((r) => [r.id, r.rank]));
  for (const cid of a.conceptIds) {
    const rn = s.next;
    const R = `${a1(rn, 1)}:${a1(rn, cols.length)}`;
    s.row(
      ccode(cid),
      ...cols.map((c) => F(aggRef[`${cid}|${c.paramId}`], num(a.result.cells[cid][c.paramId].aggregated), Z.d2)),
      F(`IF(COUNT(${R})<${cols.length},"",SUMPRODUCT(${range(wr, 1, wr, cols.length)},${R}))`, num(a.result.weighted[cid]), Z.d3),
      F(`IF(${a1(rn, cols.length + 1)}="","",RANK(${a1(rn, cols.length + 1)},${range(first, cols.length + 1, last, cols.length + 1)}))`, rank.get(cid) ?? ''),
    );
  }
  s.widths = [10, ...cols.map(() => 8), 12, 8];

  // sensitivity
  const se = new Sheet(SHEETS.sens);
  const sens = a.sensitivity;
  if (!sens || !cols.length) {
    se.row('تحلیل حساسیت به دست‌کم دو کانسپت با امتیاز کامل نیاز دارد.');
    return { scores: sc, pugh: s, sens: se };
  }
  const aggRowOf = new Map(a.conceptIds.map((cid, i) => [cid, first + i]));
  const aggRange = (cid: Id) => sref(SHEETS.pugh, range(aggRowOf.get(cid)!, 1, aggRowOf.get(cid)!, cols.length));
  se.row(
    `شرط اجرای تحلیل طبق پروپوزال: اختلاف دو کانسپت برتر کمتر از ${p.settings.sensitivity.pctOfRange}٪ دامنه مقیاس (${sens.trigger.threshold}). اختلاف = ${sens.trigger.gap.toFixed(4)} → ${sens.trigger.triggered ? 'برقرار است' : 'برقرار نیست (تحلیل تکمیلی)'}.`,
  );
  se.row('وزن پایه (نرمال‌شده)', ...cols.map((c) => pcode(c.paramId)));
  const baseR = se.row('', ...cols.map((_, i) => F(`${sref(SHEETS.pugh, a1(wr, 1 + i, true))}/SUM(${sref(SHEETS.pugh, range(wr, 1, wr, cols.length))})`, sens.base.length ? cols[i].weight / a.weightSum : '', Z.w)));
  se.blank();
  se.row('سناریو: پارامتر', 'تغییر', ...cols.map((c) => `W ${pcode(c.paramId)}`), ...a.result.ranking.map((r) => `امتیاز ${ccode(r.id)}`), 'رتبه‌بندی جدید', 'کانسپت اول تغییر کرد؟', 'رتبه‌بندی تغییر کرد؟');
  for (const scn of sens.scenarios) {
    const rn = se.next;
    const k = scn.paramIndex;
    const dCell = a1(rn, 1);
    const wCells = cols.map((_, j) =>
      F(`${a1(baseR, 1 + j, true)}*(1+${j === k ? dCell : 0})/(1+${a1(baseR, 1 + k, true)}*${dCell})`, scn.weights[j], Z.w),
    );
    const scoreCells = a.result.ranking.map((r) => F(`SUMPRODUCT(${a1(rn, 2)}:${a1(rn, 1 + cols.length)},${aggRange(r.id)})`, scn.ranking.find((x) => x.id === r.id)?.score ?? '', Z.d3));
    se.row(pcode(cols[k].paramId), { v: scn.delta, z: '0%' }, ...wCells, ...scoreCells, scn.ranking.map((r) => ccode(r.id)).join(' > '), scn.topChanged ? 'بله' : 'خیر', scn.rankingChanged ? 'بله' : 'خیر');
  }
  se.blank();
  se.row(`نقطه سربه‌سر: تغییر نسبی لازم در وزن هر پارامتر تا ${ccode(sens.pair[1])} با ${ccode(sens.pair[0])} برابر شود (δ* = −D₀ / (wₖ·dₖ)).`);
  const A = aggRange(sens.pair[0]);
  const B = aggRange(sens.pair[1]);
  const d0 = se.row('D₀', F(`SUMPRODUCT(${a1(baseR, 1, true)}:${a1(baseR, cols.length, true)},${A})-SUMPRODUCT(${a1(baseR, 1, true)}:${a1(baseR, cols.length, true)},${B})`, sens.base.length ? sens.trigger.gap : '', Z.w));
  se.row('پارامتر', 'wₖ', 'dₖ', 'δ*', 'ممکن؟');
  cols.forEach((c, k) => {
    const rn = se.next;
    const be = sens.breakEven[k];
    const aRow = aggRowOf.get(sens.pair[0])!;
    const bRow = aggRowOf.get(sens.pair[1])!;
    se.row(
      pcode(c.paramId),
      F(a1(baseR, 1 + k, true), c.weight / a.weightSum, Z.w),
      F(`${sref(SHEETS.pugh, a1(aRow, 1 + k))}-${sref(SHEETS.pugh, a1(bRow, 1 + k))}`, (a.result.cells[sens.pair[0]][c.paramId].aggregated ?? 0) - (a.result.cells[sens.pair[1]][c.paramId].aggregated ?? 0), Z.d3),
      F(`IF(OR(${a1(rn, 1)}=0,ABS(${a1(rn, 2)})<1E-9),"",-${a1(d0, 1, true)}/(${a1(rn, 1)}*${a1(rn, 2)}))`, be.delta ?? '', '0.0%'),
      be.delta === null ? 'این وزن ترتیب را تغییر نمی‌دهد' : be.possible ? 'ممکن' : 'ناممکن (کمتر از −۱۰۰٪)',
    );
  });
  se.widths = [16, 10, ...cols.map(() => 9), 10, 10, 10, 24, 12, 12];
  return { scores: sc, pugh: s, sens: se };
}

// ---------------------------------------------------------------------------------------------

export function buildWorkbookSheets(p: Project): Sheet[] {
  const sheets: Sheet[] = [];
  // README
  const rd = new Sheet(SHEETS.readme);
  rd.row(`پروژه: ${p.title}`);
  rd.row(`تاریخ تهیه: ${new Date().toISOString().slice(0, 10)}`);
  rd.row('این فایل خروجی ابزار پژوهش دلفی و پیو است. خبرگان فقط با کد آمده‌اند. خانه‌های دارای فرمول، نتایج را از داده‌های خام همین فایل دوباره محاسبه می‌کنند؛ مقدار محاسبه‌شده برنامه نیز در همان خانه ذخیره شده است.');
  rd.row('روش چارک: نوع ۷ (معادل QUARTILE.INC در Excel)؛ میانه تعداد زوج = میانگین دو مقدار وسط. پاسخ «توانایی قضاوت ندارم» (CJ) و پاسخ خالی معتبر نیستند و از مخرج‌ها حذف می‌شوند.');
  rd.row('روابط ۴ و ۵ و ۶ و ۷ میانگین را روی حوزه‌های دارای داده می‌گیرند (تعمیم «÷ ۳» طرح به هر تعداد حوزه).');
  rd.blank();
  rd.row('برگه', 'محتوا');
  for (const [n, d] of README_ROWS) rd.row(n, d);
  const dev = settingsDeviations(p);
  if (dev.length) {
    rd.blank();
    rd.row('تغییر معیارها پس از شروع گردآوری داده:');
    for (const d of dev) rd.row('', d);
  }
  rd.widths = [26, 120];
  sheets.push(rd);

  // experts (codes only)
  const ex = new Sheet(SHEETS.experts);
  ex.row('کد', 'حوزه', 'دامنه سابقه کار (سال)', 'نوع فعالیت', 'وضعیت دور اول', 'تاریخ', 'وضعیت دور دوم', 'تاریخ', 'وضعیت ماتریس وزن‌دار', 'تاریخ', 'فعال', 'مخالفت با استفاده از داده', 'معیار ورود');
  const st = { none: '—', invited: 'دعوت‌شده', consented: 'رضایت داده', responded: 'پاسخ داده', withdrew: 'انصراف' };
  for (const e of p.experts)
    ex.row(e.code, domainName(p, e.domainId), expRange(p, e.yearsExperience), e.activityType, st[e.status.r1.state], e.status.r1.date ?? '', st[e.status.r2.state], e.status.r2.date ?? '', st[e.status.pugh.state], e.status.pugh.date ?? '', e.active ? 'بله' : 'خیر', e.excludeAllData ? 'بله' : 'خیر', e.inclusionMet === null ? '' : e.inclusionMet ? 'احراز شد' : 'احراز نشد');
  ex.widths = [8, 26, 16, 12, 12, 11, 12, 11, 14, 11, 6, 12, 12];
  sheets.push(ex);

  const pr = new Sheet(SHEETS.params);
  pr.row('کد', 'نام پارامتر', 'گروه معنایی', 'الزام طراحی', 'توضیح', 'محدوده عددی', 'منبع', 'منشأ');
  for (const x of paramsOfRound(p, 'r2'))
    pr.row(x.code, x.name, p.groups.find((g) => g.id === x.groupId)?.name ?? '', x.requirement, x.explanation, x.range, { literature: 'متون', patent: 'پتنت', both: 'هر دو' }[x.source], x.origin === 'initial' ? 'فهرست اولیه' : 'افزوده در دور دوم');
  pr.widths = [8, 36, 14, 44, 44, 16, 8, 16];
  sheets.push(pr);

  // panel description
  const pd = new Sheet(SHEETS.panel);
  const desc = panelDescription(p);
  const rates = responseRates(p);
  pd.row('توصیف پنل (پاسخ‌دهندگان دور اول) — فقط تجمیعی');
  pd.row('حوزه', 'تعداد', 'درصد', 'میانه سابقه', 'Q1', 'Q3', ...[`<${desc.edges[0]}`, ...desc.edges.map((e, i, arr) => (i < arr.length - 1 ? `${e}-${arr[i + 1] - 1}` : `≥${e}`))]);
  for (const d of p.domains) {
    const x = desc.byDomain[d.id];
    pd.row(d.name, x.n, { v: desc.overall.n ? x.n / desc.overall.n : '', z: Z.pct }, num(x.experience.median), num(x.experience.q1), num(x.experience.q3), ...x.experienceBins);
  }
  pd.row('کل', desc.overall.n, { v: 1, z: Z.pct }, num(desc.overall.experience.median), num(desc.overall.experience.q1), num(desc.overall.experience.q3), ...desc.overall.experienceBins);
  pd.blank();
  pd.row('نوع فعالیت', 'تعداد', 'درصد');
  for (const a of desc.overall.activity) pd.row(a.value, a.count, { v: desc.overall.n ? a.count / desc.overall.n : '', z: Z.pct });
  pd.blank();
  pd.row('نرخ پاسخ', 'دعوت دور ۱', 'پاسخ دور ۱', 'نرخ دور ۱', 'دعوت دور ۲', 'پاسخ دور ۲', 'نرخ دور ۲', 'افت ۱→۲');
  const rateRow = (label: string, x: (typeof rates)['overall']) =>
    pd.row(label, x.r1.invited, x.r1.respondents, { v: num(x.r1.rate), z: Z.pct }, x.r2.invited, x.r2.respondents, { v: num(x.r2.rate), z: Z.pct }, { v: num(x.attrition), z: Z.pct });
  for (const d of p.domains) rateRow(d.name, rates.byDomain[d.id]);
  rateRow('کل', rates.overall);
  pd.widths = [26, 10, 10, 10, 10, 10, 10, 10, 10, 10, 10];
  sheets.push(pd);

  // rounds
  const raw1 = rawRatings(p, 'r1', SHEETS.r1raw);
  sheets.push(raw1.sheet, statsSheet(p, 'r1', raw1, SHEETS.r1res));

  // open answers + candidates
  const oa = new Sheet(SHEETS.open);
  oa.row('خبره', 'گروه معنایی', 'متن قابل‌انتشار', 'نامزدها', 'پارامترهای موجود', 'فقط توضیح', 'یادداشت');
  const candLabel = new Map(p.candidates.map((c) => [c.id, c.label]));
  for (const a of openAnswers(p))
    oa.row(codeOf(p, a.expertId), p.groups.find((g) => g.id === a.groupId)?.name ?? '', a.coding?.displayText ?? a.text, (a.coding?.candidateIds ?? []).map((c) => candLabel.get(c)).join('، '), (a.coding?.paramIds ?? []).map((id) => p.params.find((x) => x.id === id)?.code).join('، '), a.coding?.commentOnly ? 'بله' : '', a.coding?.note ?? '');
  oa.blank();
  oa.row(`پارامترهای نامزد — قاعده: دست‌کم ${p.settings.candidatePct}٪ پاسخ‌دهندگان دور اول (${respondents(p, 'r1').length} نفر)`);
  oa.row('نامزد', 'ادغام در', 'خبرگان (کد)', 'تعداد خبرگان متمایز', 'حداقل لازم', 'نتیجه قاعده', 'تصمیم دستی', 'دلیل', 'تصمیم نهایی', 'پارامتر ساخته‌شده');
  for (const c of candidateRows(p)) {
    const rn = oa.next;
    oa.row(
      c.candidate.label,
      c.merged ? candLabel.get(c.canonicalId) ?? '' : '',
      c.merged ? '' : c.supporters.map((id) => codeOf(p, id)).sort().join('، '),
      c.merged ? '' : c.supporters.length,
      c.minNeeded,
      c.merged ? '' : F(`IF(${a1(rn, 3)}>=${a1(rn, 4)},"به آستانه رسید","نرسید")`, c.meetsThreshold ? 'به آستانه رسید' : 'نرسید'),
      c.overridden ? (c.add ? 'افزوده شود' : 'افزوده نشود') : '',
      c.overridden ? c.candidate.overrideReason : '',
      c.merged ? 'ادغام‌شده' : c.add ? 'افزوده شد' : 'افزوده نشد',
      p.params.find((x) => x.id === c.candidate.paramId)?.code ?? '',
    );
  }
  oa.widths = [8, 14, 60, 30, 16, 8, 24, 14, 12, 14];
  sheets.push(oa);

  const raw2 = rawRatings(p, 'r2', SHEETS.r2raw);
  sheets.push(raw2.sheet, statsSheet(p, 'r2', raw2, SHEETS.r2res));

  // weights
  const ws = weightsSheets(p);
  sheets.push(ws.alloc, ws.weights);

  // design brief
  const br = new Sheet(SHEETS.brief);
  const brief = designBrief(p);
  br.row('رتبه', 'کد', 'پارامتر', 'گروه معنایی', 'الزام طراحی', 'Wᵢ', 'Wᵢ × ۱۰۰', 'Q1 وزن', 'Q3 وزن', 'IQR وزن');
  brief.retained.forEach((r, i) => {
    const k = ws.retained.indexOf(r.param.id);
    br.row(i + 1, r.param.code, r.param.name, p.groups.find((g) => g.id === r.param.groupId)?.name ?? '', r.param.requirement, F(sref(SHEETS.weights, a1(ws.wRow, 2 + k, true)), r.weight, Z.w), { v: 100 * r.weight, z: Z.d2 }, { v: num(r.q1), z: Z.w }, { v: num(r.q3), z: Z.w }, { v: num(r.iqr), z: Z.w });
  });
  br.blank();
  for (const [label, list] of [
    ['پارامترهای حذف‌شده (اجماع بر حذف)', brief.removed],
    ['پارامترهای فاقد اجماع', brief.noConsensus],
  ] as const) {
    br.row(label);
    br.row('کد', 'پارامتر', 'الزام طراحی', 'n', ...p.scale.bands.map((b) => `٪ ${b.label}`));
    for (const r of list) br.row(r.param.code, r.param.name, r.param.requirement, r.overall.n, ...r.overall.percents.map((x) => ({ v: x === null ? '' : x / 100, z: Z.pct })));
    br.blank();
  }
  br.widths = [6, 8, 34, 14, 44, 10, 10, 10, 10, 10];
  sheets.push(br);

  sheets.push(runSheet(p, 1, SHEETS.run1), runSheet(p, 2, SHEETS.run2));
  const pg = pughSheets(p, ws.w.final);
  sheets.push(pg.scores, pg.pugh, pg.sens);

  const lg = new Sheet(SHEETS.log);
  if (p.settingsSnapshot) lg.row(`تنظیمات در ${p.settingsSnapshot.at.slice(0, 10)} (ورود نخستین پاسخ دور اول) ثبت شد.`);
  for (const d of dev) lg.row('تغییر معیار', d);
  lg.blank();
  lg.row('زمان', 'تغییر', 'جزئیات', 'دلیل');
  for (const e of p.changeLog) lg.row(e.at.replace('T', ' ').slice(0, 16), e.action, e.detail, e.reason);
  lg.widths = [18, 36, 70, 40];
  sheets.push(lg);
  return sheets;
}

export function workbookBytes(p: Project): Uint8Array {
  const wb = XLSX.utils.book_new();
  for (const s of buildWorkbookSheets(p)) XLSX.utils.book_append_sheet(wb, toWorksheet(s), s.name.slice(0, 31));
  wb.Workbook = { ...(wb.Workbook ?? {}), Views: [{ RTL: true }] };
  return new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer);
}

/** Every sheet as CSV (UTF-8 with BOM so Excel opens Persian text correctly), values only. */
export function sheetsAsCsv(p: Project): Record<string, string> {
  const out: Record<string, string> = {};
  const keyOf = new Map(Object.entries(SHEETS).map(([k, v]) => [v, k]));
  buildWorkbookSheets(p).forEach((s, i) => {
    const csv = XLSX.utils.sheet_to_csv(toWorksheet(s), { blankrows: true });
    out[`${String(i + 1).padStart(2, '0')}_${keyOf.get(s.name) ?? 'sheet'}.csv`] = '﻿' + csv;
  });
  return out;
}
