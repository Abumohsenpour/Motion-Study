/**
 * Deviations from the settings frozen when data collection started (DECISIONS C3): the proposal requires the
 * consensus criteria to be fixed in advance, so every later change is listed in the report.
 */
import type { Project } from '../core';
import { currentLang, tr, type Lang } from '../i18n';

/** `lang` defaults to the interface language; the Persian report and workbook pass 'fa'. */
export function settingsDeviations(p: Project, lang: Lang = currentLang()): string[] {
  const T = (fa: string, v: Record<string, string | number>) => tr(lang, fa, v);
  const onOff = (b: boolean) => tr(lang, b ? 'فعال' : 'غیرفعال');
  const s = p.settingsSnapshot;
  if (!s) return [];
  const out: string[] = [];
  const c0 = s.consensus;
  const c1 = p.settings.consensus;
  if (c0.retainTopMin !== c1.retainTopMin) out.push(T('حداقل درصد طبقه بالا برای حفظ: {a} ← {b}', { a: c0.retainTopMin, b: c1.retainTopMin }));
  if (c0.retainBottomMax !== c1.retainBottomMax) out.push(T('حداکثر درصد طبقه پایین برای حفظ: {a} ← {b}', { a: c0.retainBottomMax, b: c1.retainBottomMax }));
  if (c0.removeBottomMin !== c1.removeBottomMin) out.push(T('حداقل درصد طبقه پایین برای حذف: {a} ← {b}', { a: c0.removeBottomMin, b: c1.removeBottomMin }));
  if (c0.removeTopMax !== c1.removeTopMax) out.push(T('حداکثر درصد طبقه بالا برای حذف: {a} ← {b}', { a: c0.removeTopMax, b: c1.removeTopMax }));
  if (s.candidatePct !== p.settings.candidatePct) out.push(T('آستانه افزودن پارامتر جدید: {a}٪ ← {b}٪', { a: s.candidatePct, b: p.settings.candidatePct }));
  if (s.scale.min !== p.scale.min || s.scale.max !== p.scale.max) out.push(T('دامنه مقیاس: {a} ← {b}', { a: `${s.scale.min}–${s.scale.max}`, b: `${p.scale.min}–${p.scale.max}` }));
  const bands = (x: Project['scale']) => x.bands.map((b) => `${b.from}–${b.to}`).join(' / ');
  if (bands(s.scale) !== bands(p.scale)) out.push(T('مرز طبقه‌ها: {a} ← {b}', { a: bands(s.scale), b: bands(p.scale) }));
  if (s.scale.allowCannotJudge !== p.scale.allowCannotJudge) out.push(T('گزینه «توانایی قضاوت ندارم»: {a} ← {b}', { a: onOff(s.scale.allowCannotJudge), b: onOff(p.scale.allowCannotJudge) }));
  return out;
}
