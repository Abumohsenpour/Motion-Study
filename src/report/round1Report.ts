/** Round-1 report for the research team (proposal: «خروجی این مرحله، گزارش بازخورد کنترل‌شده دور دوم است»). */
import { respondents, type Project } from '../core';
import type { Fmt } from '../ui/format';
import { ReportBuilder } from './html';
import { openAnswersSection, panelSection, roundStatsSection } from './delphiSections';

export function round1ReportHtml(p: Project, fmt: Fmt): string {
  const r = new ReportBuilder(fmt, p.captions);
  r.h1('گزارش دور اول دلفی برای تیم پژوهش');
  r.p(`${p.title} — تاریخ تهیه: ${fmt.date(new Date().toISOString())} — پاسخ‌دهندگان دور اول: ${fmt.int(respondents(p, 'r1').length)}`, 'meta');
  r.note('در این گزارش خبرگان تنها با کد معرفی می‌شوند. میانه و دامنه بین چارکی توصیفی‌اند و مبنای تصمیم نیستند؛ تصمیم درباره پارامترها فقط با معیار اجماع روی امتیازهای دور دوم گرفته می‌شود.');
  panelSection(r, p);
  r.h2('امتیازهای دور اول');
  roundStatsSection(r, p, 'r1');
  openAnswersSection(r, p);
  return r.document(`گزارش دور اول — ${p.title}`);
}
