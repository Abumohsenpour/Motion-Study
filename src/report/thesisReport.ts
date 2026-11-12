/**
 * Thesis-ready report: printable RTL HTML with every table and figure, numbered Persian captions (editable),
 * the domain-coloured round charts and the consensus summary. Saves to PDF through the browser's print dialog.
 */
import { projectWeights, respondents, type Project } from '../core';
import { settingsDeviations } from '../app/deviations';
import type { Fmt } from '../ui/format';
import { ReportBuilder, type CaptionInfo } from './html';
import { openAnswersSection, panelSection, roundStatsSection } from './delphiSections';
import { briefSection, consensusSection, weightsSection } from './weightsSections';
import { screeningSection, weightedSection } from './partBSections';
import { chartCatalog } from '../charts/catalog';

export function thesisReport(p: Project, fmt: Fmt): { html: string; captions: CaptionInfo[] } {
  const r = new ReportBuilder(fmt, p.captions);
  r.h1(`گزارش نتایج: ${p.title}`);
  r.p(`تاریخ تهیه: ${fmt.date(new Date().toISOString())} — پاسخ‌دهندگان دور اول: ${fmt.int(respondents(p, 'r1').length)}، دور دوم: ${fmt.int(respondents(p, 'r2').length)}`, 'meta');
  r.note('خبرگان در این گزارش تنها با کد معرفی شده‌اند و ویژگی‌های پنل به‌صورت تجمیعی و در قالب دامنه گزارش شده است. چارک‌ها به روش نوع ۷ (معادل QUARTILE.INC در Excel) محاسبه شده‌اند.');
  const dev = settingsDeviations(p, 'fa');
  if (dev.length) {
    r.note('معیارهای زیر پس از شروع گردآوری داده (ورود نخستین پاسخ دور اول) تغییر کرده‌اند؛ طرح پژوهش تعیین پیشاپیش معیار اجماع را الزامی می‌داند:', 'warn');
    r.list(dev.map(fmt.digits));
  }
  panelSection(r, p);
  r.h2('دور اول دلفی');
  roundStatsSection(r, p, 'r1');
  openAnswersSection(r, p);
  consensusSection(r, p);
  // the two summary figures are the same ones offered on the outputs screen (Persian version)
  const charts = new Map(chartCatalog(p, fmt, 'fa').map((c) => [c.key, c]));
  const summary = (key: string, caption: string) => {
    const c = charts.get(key);
    // the caption below the figure replaces the title drawn inside the chart file
    if (c) r.figure(`fig-${key}`, caption, c.svg);
  };
  summary('consensus', 'سهم پاسخ‌های طبقه بالا برای هر پارامتر در دور اول و دوم و وضعیت اجماع');
  r.h3('توصیف امتیازهای دور دوم به تفکیک حوزه');
  roundStatsSection(r, p, 'r2');
  let partA: Record<string, number> | undefined;
  try {
    partA = projectWeights(p).final;
    weightsSection(r, p);
    briefSection(r, p);
    summary('weights', 'وزن نهایی پارامترهای مورد اجماع و دامنه بین چارکی وزن‌های فردی');
  } catch {
    r.p('وزن‌ها هنوز قابل محاسبه نیستند.');
  }
  screeningSection(r, p);
  weightedSection(r, p, partA);
  return { html: r.document(`گزارش — ${p.title}`), captions: r.captionsUsed };
}
