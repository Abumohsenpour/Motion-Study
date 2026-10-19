/**
 * Spreadsheet import and templates (SheetJS). Excel (.xlsx) and CSV are both accepted; CSV is read as UTF-8 text
 * so Persian characters survive.
 */
import * as XLSX from 'xlsx';
import type { ParamSource } from '../core';
import { downloadBlob } from './download';

export type Row = (string | number | null)[];

/** First sheet of a workbook as rows of cell values (strings trimmed). */
export async function readRows(file: File): Promise<Row[]> {
  const isCsv = /\.(csv|txt)$/i.test(file.name) || file.type === 'text/csv';
  const wb = isCsv
    ? XLSX.read((await file.text()).replace(/^﻿/, ''), { type: 'string', raw: true })
    : XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<Row>(ws, { header: 1, blankrows: false, defval: null, raw: true });
  return rows.map((r) => r.map((c) => (typeof c === 'string' ? c.trim() : c)));
}

/** Normalises a header for matching: lower case, no spaces/ZWNJ, Arabic ي/ك → Persian ی/ک. */
export const normHeader = (s: unknown): string =>
  String(s ?? '')
    .toLowerCase()
    .replace(/[\s‌_\-–—()]/g, '')
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک');

/** Finds the column index of each wanted field from a header row. */
export function mapHeaders<K extends string>(header: Row, aliases: Record<K, string[]>): Record<K, number> {
  const norm = header.map(normHeader);
  const out = {} as Record<K, number>;
  for (const [k, names] of Object.entries(aliases) as [K, string[]][]) out[k] = norm.findIndex((h) => names.map(normHeader).includes(h));
  return out;
}

export function writeWorkbook(sheets: { name: string; rows: Row[]; widths?: number[] }[], filename: string): void {
  const wb = XLSX.utils.book_new();
  for (const s of sheets) {
    const ws = XLSX.utils.aoa_to_sheet(s.rows);
    if (s.widths) ws['!cols'] = s.widths.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31));
  }
  wb.Workbook = { Views: [{ RTL: true }] };
  const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
  downloadBlob(new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), filename);
}

// ---------------------------------------------------------------------------------------------
// Parameters (Phase 1 output table)
// ---------------------------------------------------------------------------------------------

export const PARAM_COLUMNS = ['کد', 'نام پارامتر', 'گروه معنایی', 'الزام طراحی', 'توضیح مختصر', 'محدوده عددی', 'منبع'];

const PARAM_ALIASES = {
  code: ['کد', 'code', 'کدپارامتر'],
  name: ['نام پارامتر', 'نام', 'پارامتر', 'name', 'parameter'],
  group: ['گروه معنایی', 'گروه', 'group', 'semanticgroup'],
  requirement: ['الزام طراحی', 'الزام', 'requirement', 'designrequirement'],
  explanation: ['توضیح مختصر', 'توضیح', 'تعریف', 'explanation', 'definition'],
  range: ['محدوده عددی', 'محدوده', 'محدوده عددی گزارش‌شده', 'range'],
  source: ['منبع', 'source'],
};

export interface ParsedParam {
  row: number;
  code: string;
  name: string;
  group: string;
  requirement: string;
  explanation: string;
  range: string;
  source: ParamSource;
  problems: string[];
}

export function parseSource(v: unknown): ParamSource | null {
  const s = normHeader(v);
  if (!s) return null;
  if (['هردو', 'both', 'متونوپتنت', 'متون+پتنت'].includes(s)) return 'both';
  if (['متون', 'متن', 'literature', 'مقاله', 'ادبیات'].includes(s)) return 'literature';
  if (['پتنت', 'patent', 'اختراع'].includes(s)) return 'patent';
  return null;
}

export function parseParamRows(rows: Row[]): { params: ParsedParam[]; missingColumns: string[] } {
  if (rows.length === 0) return { params: [], missingColumns: PARAM_COLUMNS };
  const idx = mapHeaders(rows[0], PARAM_ALIASES);
  const missingColumns = (['code', 'name', 'group'] as const).filter((k) => idx[k] < 0).map((k) => ({ code: 'کد', name: 'نام پارامتر', group: 'گروه معنایی' })[k]);
  if (missingColumns.length) return { params: [], missingColumns };
  const cell = (r: Row, k: keyof typeof PARAM_ALIASES) => (idx[k] >= 0 ? String(r[idx[k]] ?? '').trim() : '');
  const params = rows.slice(1).map((r, i) => {
    const problems: string[] = [];
    const code = cell(r, 'code');
    const name = cell(r, 'name');
    const group = cell(r, 'group');
    const srcRaw = cell(r, 'source');
    const source = parseSource(srcRaw);
    if (!code) problems.push('کد خالی است');
    if (!name) problems.push('نام خالی است');
    if (!group) problems.push('گروه معنایی خالی است');
    if (srcRaw && !source) problems.push(`منبع «${srcRaw}» شناخته نشد (متون / پتنت / هر دو)`);
    return {
      row: i + 2,
      code,
      name,
      group,
      requirement: cell(r, 'requirement'),
      explanation: cell(r, 'explanation'),
      range: cell(r, 'range'),
      source: source ?? 'literature',
      problems,
    };
  });
  const seen = new Map<string, number>();
  for (const p of params) {
    if (!p.code) continue;
    if (seen.has(p.code)) p.problems.push(`کد تکراری (ردیف ${seen.get(p.code)})`);
    else seen.set(p.code, p.row);
  }
  return { params: params.filter((p) => p.code || p.name || p.group), missingColumns: [] };
}

export function downloadParamTemplate(): void {
  writeWorkbook(
    [
      {
        name: 'پارامترها',
        rows: [
          PARAM_COLUMNS,
          ['P01', 'انتقال بار استاتیک پیش‌بند سربی', 'دینامیک', 'حفظ ایمنی و جلوگیری از کاهش عملکرد جراح', 'انتقال وزن پیش‌بند از شانه‌ها و ستون فقرات به لگن', '۳ تا ۸ کیلوگرم', 'هر دو'],
          ['P02', 'دامنه حرکتی تنه', 'سینماتیک', 'عدم محدودیت حرکات لازم حین مداخله', 'دامنه خم‌شدن و چرخش تنه که دستگاه نباید محدود کند', '', 'متون'],
        ],
        widths: [8, 34, 14, 40, 44, 16, 10],
      },
      {
        name: 'راهنما',
        rows: [
          ['ستون', 'توضیح'],
          ['کد', 'کد یکتای پارامتر (مثلاً P01). الزامی.'],
          ['نام پارامتر', 'الزامی.'],
          ['گروه معنایی', 'مثلاً سینماتیک، دینامیک، ارگونومی، تنظیم‌پذیری، ایمنی. گروه‌های تازه هنگام ورود ساخته می‌شوند. الزامی.'],
          ['الزام طراحی', 'الزام قابل‌ارزیابی متناظر با پارامتر.'],
          ['توضیح مختصر', 'توضیحی که در پرسش‌نامه کنار پارامتر نمایش داده می‌شود.'],
          ['محدوده عددی', 'اختیاری؛ محدوده عددی گزارش‌شده در منابع.'],
          ['منبع', 'متون / پتنت / هر دو'],
        ],
        widths: [16, 90],
      },
    ],
    'parameters-template.xlsx',
  );
}
