/**
 * Thank-you summary for the experts after the study (ethics ۹–۴: «خلاصه نتایج پس از پایان مطالعه برای آنان ارسال
 * می‌شود»). Aggregate results only; the expert is addressed by code, never by name.
 */
import { designBrief, respondents, screeningAnalysis, weightedAnalysis, type Id, type Project } from '../core';
import type { Fmt } from '../ui/format';
import { ReportBuilder, escapeHtml } from './html';

export function thankYouHtml(p: Project, fmt: Fmt, expertId: Id | null): string {
  const r = new ReportBuilder(fmt, {});
  const e = expertId ? p.experts.find((x) => x.id === expertId) : null;
  r.h1('سپاس از مشارکت شما');
  r.p(`${e ? `خبره گرامی (کد ${e.code})،` : 'خبره گرامی،'} از وقتی که برای پژوهش «${p.title}» گذاشتید صمیمانه سپاسگزاریم. خلاصه نتایج تجمیعی در ادامه آمده است؛ هیچ پاسخ فردی در آن نیست.`);
  const r1 = respondents(p, 'r1').length;
  const r2 = respondents(p, 'r2').length;
  r.p(`در دور اول ${fmt.int(r1)} و در دور دوم ${fmt.int(r2)} خبره از ${fmt.int(p.domains.length)} حوزه تخصصی (${p.domains.map((d) => d.name).join('، ')}) مشارکت کردند.`);
  try {
    const b = designBrief(p);
    r.p(`از ${fmt.int(b.retained.length + b.removed.length + b.noConsensus.length)} پارامتر، ${fmt.int(b.retained.length)} پارامتر به اجماع حفظ، ${fmt.int(b.removed.length)} پارامتر به اجماع حذف رسید و ${fmt.int(b.noConsensus.length)} پارامتر فاقد اجماع ماند.`);
    r.table(
      'thanks-top',
      'مهم‌ترین پارامترهای طراحی از دیدگاه پنل (بر اساس وزن نهایی)',
      ['رتبه', 'پارامتر', 'الزام طراحی', 'وزن (٪)'],
      b.retained.slice(0, 10).map((x, i) => [fmt.int(i + 1), x.param.name, { html: `<div style="text-align:right">${escapeHtml(x.param.requirement)}</div>` }, fmt.num(100 * x.weight, 1)]),
    );
  } catch {
    /* weights not available */
  }
  try {
    const a = weightedAnalysis(p);
    const top = a.result.ranking[0];
    if (top) {
      const c = p.concepts.find((x) => x.id === top.id)!;
      r.h2('کانسپت منتخب');
      r.p(`از میان ${fmt.int(p.concepts.length)} کانسپت اولیه، ${fmt.int(screeningAnalysis(p).forwarded.length)} کانسپت پس از غربال به ارزیابی شما رسید و کانسپت «${c.name}» بالاترین امتیاز وزنی (${fmt.num(top.score, 2)} از ۵) را گرفت.`);
      if (c.description) r.p(c.description);
    }
  } catch {
    /* no Part B yet */
  }
  r.p('نتایج کامل در پایان‌نامه گزارش خواهد شد. با کسب اجازه از شما، مشارکتتان در بخش سپاسگزاری پایان‌نامه قدردانی می‌شود.');
  return r.document('سپاس از مشارکت');
}
