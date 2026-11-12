/**
 * The ten workflow steps in the sidebar and their status badges (not started / in progress / complete)
 * with warnings. Status is derived from the project on every render.
 */
import { t } from '../i18n';
import {
  candidateRows,
  inclusionWarnings,
  openAnswers,
  panelCheck,
  projectWeights,
  r1Invitees,
  r2Invitees,
  respondents,
  round2Analysis,
  screeningAnalysis,
  validateScale,
  validateThresholds,
  weightedAnalysis,
  type Project,
} from '../core';
import { settingsDeviations } from './deviations';

export type StepId =
  | 'project'
  | 'experts'
  | 'params'
  | 'round1'
  | 'analysis1'
  | 'round2'
  | 'weights'
  | 'screening'
  | 'weighted'
  | 'exports';

export type StepStatus = 'not-started' | 'in-progress' | 'complete';

export interface StepInfo {
  id: StepId;
  title: string;
  part: 'setup' | 'A' | 'B' | 'out';
}

export const STEPS: StepInfo[] = [
  { id: 'project', title: 'پروژه و تنظیمات', part: 'setup' },
  { id: 'experts', title: 'خبرگان و حوزه‌ها', part: 'setup' },
  { id: 'params', title: 'گروه‌های معنایی و پارامترها', part: 'setup' },
  { id: 'round1', title: 'دور اول', part: 'A' },
  { id: 'analysis1', title: 'تحلیل دور اول', part: 'A' },
  { id: 'round2', title: 'دور دوم', part: 'A' },
  { id: 'weights', title: 'اجماع و وزن‌ها', part: 'A' },
  { id: 'screening', title: 'غربال پیو', part: 'B' },
  { id: 'weighted', title: 'ماتریس پیو وزن‌دار', part: 'B' },
  { id: 'exports', title: 'خروجی‌ها', part: 'out' },
];

export interface StepState {
  status: StepStatus;
  warnings: string[];
}

function safe<T>(f: () => T, fallback: T): T {
  try {
    return f();
  } catch {
    return fallback;
  }
}

export function stepState(p: Project, id: StepId): StepState {
  const w: string[] = [];
  switch (id) {
    case 'project': {
      if (validateScale(p.scale).length) w.push(t('طبقه‌بندی مقیاس امتیازدهی معتبر نیست.'));
      if (validateThresholds(p.settings.consensus).length) w.push(t('آستانه‌های اجماع با هم تعارض دارند یا خارج از ۰ تا ۱۰۰ هستند.'));
      const dev = settingsDeviations(p);
      if (dev.length) w.push(t('{n} تغییر در معیارها پس از شروع گردآوری داده (در گزارش اعلام می‌شود).', { n: dev.length }));
      return { status: w.length && validateScale(p.scale).length ? 'in-progress' : 'complete', warnings: w };
    }
    case 'experts': {
      if (p.experts.length === 0) return { status: 'not-started', warnings: [] };
      const active = p.experts.filter((e) => e.active && !e.excludeAllData);
      const per = p.domains.map((d) => active.filter((e) => e.domainId === d.id).length);
      if (active.length < p.settings.panel.minTotal) w.push(t('کمتر از {n} خبره فعال در فهرست.', { n: p.settings.panel.minTotal }));
      p.domains.forEach((d, i) => per[i] < p.settings.panel.minPerDomain && w.push(t('حوزه «{n}» کمتر از {m} خبره دارد.', { n: d.name, m: p.settings.panel.minPerDomain })));
      const inc = inclusionWarnings(p);
      if (inc.length) w.push(t('{n} هشدار معیار ورود.', { n: inc.length }));
      const ok = active.length >= p.settings.panel.minTotal && per.every((n) => n >= p.settings.panel.minPerDomain);
      return { status: ok ? 'complete' : 'in-progress', warnings: w };
    }
    case 'params': {
      if (p.params.length === 0) return { status: 'not-started', warnings: [] };
      const codes = p.params.map((x) => x.code.trim());
      if (codes.some((c, i) => c && codes.indexOf(c) !== i)) w.push(t('کد پارامتر تکراری وجود دارد.'));
      if (p.params.some((x) => !x.code.trim() || !x.name.trim())) w.push(t('پارامتر بدون کد یا نام وجود دارد.'));
      if (p.params.some((x) => !x.requirement.trim())) w.push(t('برخی پارامترها «الزام طراحی» ندارند.'));
      const empty = p.groups.filter((g) => !p.params.some((x) => x.groupId === g.id));
      if (empty.length) w.push(t('گروه بدون پارامتر: {n}', { n: empty.map((g) => g.name).join('، ') }));
      return { status: w.length ? 'in-progress' : 'complete', warnings: w };
    }
    case 'round1': {
      const inv = r1Invitees(p);
      const resp = respondents(p, 'r1');
      if (inv.length === 0 && resp.length === 0) return { status: 'not-started', warnings: [] };
      const pending = inv.filter((id) => !resp.some((e) => e.id === id) && p.experts.find((e) => e.id === id)?.status.r1.state !== 'withdrew');
      if (pending.length) w.push(t('{n} خبره هنوز پاسخ نداده‌اند.', { n: pending.length }));
      const noConsent = resp.filter((e) => !p.responses.r1[e.id]?.consent.given);
      if (noConsent.length) w.push(t('رضایت {n} پاسخ‌دهنده ثبت نشده است.', { n: noConsent.length }));
      return { status: resp.length > 0 && pending.length === 0 ? 'complete' : 'in-progress', warnings: w };
    }
    case 'analysis1': {
      if (respondents(p, 'r1').length === 0) return { status: 'not-started', warnings: [] };
      const ans = openAnswers(p);
      const uncoded = ans.filter((a) => !a.coding || (!a.coding.commentOnly && a.coding.candidateIds.length === 0 && a.coding.paramIds.length === 0));
      if (uncoded.length) w.push(t('{n} پاسخ باز هنوز کدگذاری نشده است.', { n: uncoded.length }));
      const toAdd = safe(() => candidateRows(p), []).filter((r) => r.add && !r.candidate.paramId);
      if (toAdd.length) w.push(t('{n} پارامتر نامزد تأییدشده هنوز به فهرست دور دوم افزوده نشده است.', { n: toAdd.length }));
      return { status: w.length ? 'in-progress' : 'complete', warnings: w };
    }
    case 'round2': {
      const inv = r2Invitees(p);
      const resp = respondents(p, 'r2');
      if (resp.length === 0) return { status: 'not-started', warnings: [] };
      const pending = inv.filter((id) => !resp.some((e) => e.id === id));
      if (pending.length) w.push(t('{n} دعوت‌شده هنوز پاسخ نداده‌اند.', { n: pending.length }));
      return { status: pending.length === 0 ? 'complete' : 'in-progress', warnings: w };
    }
    case 'weights': {
      if (respondents(p, 'r2').length === 0) return { status: 'not-started', warnings: [] };
      const pc = panelCheck(p);
      if (!pc.ok) w.push(t('حداقل نهایی پنل (کل یا حوزه‌ها) برقرار نیست.'));
      const wr = safe(() => projectWeights(p), null);
      if (wr?.excluded.length) w.push(t('{n} خبره از وزن‌دهی کنار گذاشته شدند.', { n: wr.excluded.length }));
      if (wr?.domainsMissing.length) w.push(t('حوزه‌ای بدون توزیع‌کننده معتبر وجود دارد.'));
      const retained = safe(() => round2Analysis(p), []).filter((r) => r.consensus.status === 'retain').length;
      if (retained === 0) w.push(t('هیچ پارامتری به اجماع حفظ نرسیده است.'));
      return { status: wr?.checks.finalSumOk ? 'complete' : 'in-progress', warnings: w };
    }
    case 'screening': {
      if (p.concepts.length === 0) return { status: 'not-started', warnings: [] };
      const a = safe(() => screeningAnalysis(p), null);
      if (!a?.run1) return { status: 'in-progress', warnings: [t('کانسپت مرجع اجرای اول انتخاب نشده است.')] };
      for (const ic of a.incompleteCells) w.push(t('اجرای {n}: {m} خانه خالی.', { n: ic.run, m: ic.count }));
      if (a.run2DatumMismatch) w.push(t('آرای اجرای دوم با مرجع دیگری ثبت شده‌اند.'));
      if (a.bestTied.length > 1 && !p.screening.run1.bestChoice) w.push(t('تساوی در کانسپت برتر اجرای اول.'));
      if (a.forward?.tieAtCutoff.length && !p.screening.cutoffChoice) w.push(t('تساوی در مرز چهار کانسپت.'));
      return { status: a.forwarded.length >= 2 && w.length === 0 ? 'complete' : 'in-progress', warnings: w };
    }
    case 'weighted': {
      if (p.weighted.columns.length === 0) return { status: 'not-started', warnings: [] };
      const a = safe(() => weightedAnalysis(p, safe(() => projectWeights(p).final, undefined)), null);
      if (!a) return { status: 'in-progress', warnings: [] };
      if (!a.weightsSumToOne) w.push(t('مجموع وزن‌ها برابر ۱ نیست.'));
      if (a.partAChanged) w.push(t('وزن‌های بخش الف پس از ارسال تغییر کرده‌اند.'));
      if (a.result.incomplete.length) w.push(t('{n} کانسپت امتیاز کامل ندارد.', { n: a.result.incomplete.length }));
      return { status: a.result.ranking.length >= 2 && a.result.incomplete.length === 0 ? 'complete' : 'in-progress', warnings: w };
    }
    case 'exports':
      return { status: 'not-started', warnings: [] };
  }
}
