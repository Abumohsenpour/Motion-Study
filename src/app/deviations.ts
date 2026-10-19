/**
 * Deviations from the settings frozen when data collection started (DECISIONS C3): the proposal requires the
 * consensus criteria to be fixed in advance, so every later change is listed in the report.
 */
import type { Project } from '../core';

export function settingsDeviations(p: Project): string[] {
  const s = p.settingsSnapshot;
  if (!s) return [];
  const out: string[] = [];
  const c0 = s.consensus;
  const c1 = p.settings.consensus;
  if (c0.retainTopMin !== c1.retainTopMin) out.push(`حداقل درصد طبقه بالا برای حفظ: ${c0.retainTopMin} ← ${c1.retainTopMin}`);
  if (c0.retainBottomMax !== c1.retainBottomMax) out.push(`حداکثر درصد طبقه پایین برای حفظ: ${c0.retainBottomMax} ← ${c1.retainBottomMax}`);
  if (c0.removeBottomMin !== c1.removeBottomMin) out.push(`حداقل درصد طبقه پایین برای حذف: ${c0.removeBottomMin} ← ${c1.removeBottomMin}`);
  if (c0.removeTopMax !== c1.removeTopMax) out.push(`حداکثر درصد طبقه بالا برای حذف: ${c0.removeTopMax} ← ${c1.removeTopMax}`);
  if (s.candidatePct !== p.settings.candidatePct) out.push(`آستانه افزودن پارامتر جدید: ${s.candidatePct}٪ ← ${p.settings.candidatePct}٪`);
  if (s.scale.min !== p.scale.min || s.scale.max !== p.scale.max) out.push(`دامنه مقیاس: ${s.scale.min}–${s.scale.max} ← ${p.scale.min}–${p.scale.max}`);
  const bands = (x: Project['scale']) => x.bands.map((b) => `${b.from}–${b.to}`).join(' / ');
  if (bands(s.scale) !== bands(p.scale)) out.push(`مرز طبقه‌ها: ${bands(s.scale)} ← ${bands(p.scale)}`);
  if (s.scale.allowCannotJudge !== p.scale.allowCannotJudge) out.push(`گزینه «توانایی قضاوت ندارم»: ${s.scale.allowCannotJudge ? 'فعال' : 'غیرفعال'} ← ${p.scale.allowCannotJudge ? 'فعال' : 'غیرفعال'}`);
  return out;
}
