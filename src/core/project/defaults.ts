/** A new, empty project with the proposal's defaults (every value editable). */
import { DEFAULT_THRESHOLDS } from '../delphi/consensus';
import { newId } from '../ids';
import { defaultRatingScale } from '../scale';
import type { Domain, Expert, Project, RoundKey, RoundSchedule, Settings } from '../types';

/** Okabe–Ito colour-blind-safe palette (DECISIONS D-59). The first three are the default domain colours. */
export const PALETTE = ['#0072B2', '#E69F00', '#009E73', '#CC79A7', '#56B4E9', '#D55E00', '#F0E442', '#000000'];

export const DEFAULT_VALUE_LABELS = ['نامطلوب', 'به‌سختی قابل‌قبول', 'کافی', 'خوب', 'بسیار خوب (نزدیک به حالت ایدئال)'];

export const DEFAULT_CONSENT_TEXT = [
  'از شما برای مشارکت در پژوهش «طراحی اگزواسکلتون غیرفعال ارگونومیک پشتیبان پیش‌بند سربی برای جراحی درون‌عروقی مبتنی بر مدل الماس دوگانه» دعوت شده است.',
  'مشارکت شامل دو دور پرسش‌نامه دلفی و یک مرحله ارزیابی کانسپت‌ها است و هیچ هزینه‌ای برای شما ندارد.',
  'هویت شما از سایر اعضای پنل پنهان می‌ماند و تنها با یک کد شناسایی می‌شوید. فایل تطبیق کد و هویت جدا از داده‌ها نگهداری می‌شود. نتایج تنها به‌صورت تجمیعی گزارش می‌شوند و بازخورد دور دوم نیز تجمیعی است؛ امتیاز قبلی هر فرد تنها به خود او نمایش داده می‌شود.',
  'مشارکت کاملاً داوطلبانه است و می‌توانید در هر مرحله و بدون ذکر دلیل انصراف دهید. پاسخ‌های دورهای تکمیل‌شده پیش از انصراف، تنها در صورت عدم مخالفت شما در تحلیل همان دورها باقی می‌ماند.',
  'با انتخاب «موافقم»، رضایت آگاهانه خود را اعلام می‌کنید و متعهد می‌شوید در صورت امکان در همه دورها شرکت کنید. خلاصه نتایج پس از پایان مطالعه برای شما ارسال خواهد شد.',
].join('\n\n');

export function defaultDomains(): Domain[] {
  return [
    {
      id: newId('d_'),
      name: 'جراحی درون‌عروقی',
      shortLabel: 'ج',
      color: PALETTE[0],
      inclusionCriteria:
        'دست‌کم ۵ سال تجربه در مداخلات درون‌عروقی تحت هدایت فلوروسکوپی همراه با استفاده معمول از پیش‌بند سربی',
      minYears: 5,
    },
    {
      id: newId('d_'),
      name: 'مهندسی (بیومکانیک/رباتیک/پزشکی)',
      shortLabel: 'م',
      color: PALETTE[1],
      inclusionCriteria:
        'سابقه پژوهشی یا صنعتی اثبات‌شده (مانند مقاله، پتنت یا پروژه تکمیل‌شده) در طراحی، شبیه‌سازی یا نمونه‌سازی اگزواسکلتون‌ها',
      minYears: null,
    },
    {
      id: newId('d_'),
      name: 'ارگونومی و عوامل انسانی',
      shortLabel: 'ا',
      color: PALETTE[2],
      inclusionCriteria:
        'تجربه عملی در ارزیابی ریسک‌فاکتورهای اختلالات اسکلتی-عضلانی و تحلیل پوسچر و حرکت در محیط‌های کاری، به‌ویژه محیط‌های درمانی',
      minYears: null,
    },
  ];
}

const emptySchedule = (): RoundSchedule => ({ opens: null, deadline: null, reminders: [], extendedTo: null });

export function defaultSettings(): Settings {
  return {
    consensus: { ...DEFAULT_THRESHOLDS },
    candidatePct: 20,
    panel: { target: 15, targetPerDomain: 5, acceptableMin: 12, acceptableMax: 18, minTotal: 9, minPerDomain: 3 },
    schedule: { r1: emptySchedule(), r2: emptySchedule(), pugh: emptySchedule() },
    sensitivity: { pctOfRange: 10, step: 0.2, alwaysRun: true },
    valueLabels: [...DEFAULT_VALUE_LABELS],
    experienceEdges: [5, 10, 15, 20],
    consentText: DEFAULT_CONSENT_TEXT,
    maxForward: 4,
    minForward: 2,
  };
}

export function newExpert(code: string, domainId: string): Expert {
  const none = { state: 'none' as const, date: null };
  const status = { r1: { ...none }, r2: { ...none }, pugh: { ...none } } satisfies Record<RoundKey, unknown>;
  return {
    id: newId('e_'),
    code,
    domainId,
    yearsExperience: null,
    activityType: '',
    consentDate: null,
    active: true,
    status,
    excludeAllData: false,
    inclusionMet: null,
  };
}

/** Next free expert code: E01, E02, … (3 digits after 99). Deleted codes are not reused (DECISIONS D-06). */
export function nextExpertCode(existing: readonly string[], highestEverUsed = 0): string {
  const nums = existing.map((c) => Number(/^E(\d+)$/.exec(c)?.[1] ?? 0));
  const n = Math.max(highestEverUsed, 0, ...nums) + 1;
  return 'E' + String(n).padStart(n > 99 ? 3 : 2, '0');
}

export function createProject(title = 'پروژه جدید'): Project {
  const now = new Date().toISOString();
  return {
    schema: 'delphi-pugh/project',
    version: 1,
    id: newId('p_'),
    title,
    createdAt: now,
    updatedAt: now,
    settings: defaultSettings(),
    scale: defaultRatingScale(),
    domains: defaultDomains(),
    experts: [],
    groups: ['سینماتیک', 'دینامیک', 'ارگونومی', 'تنظیم‌پذیری', 'ایمنی'].map((name) => ({ id: newId('g_'), name })),
    params: [],
    responses: { r1: {}, r2: {} },
    r2Invited: null,
    codings: {},
    candidates: [],
    concepts: [],
    screening: {
      mode: 'team',
      raters: ['پژوهشگر', 'استاد راهنما', 'استاد مشاور'].map((label) => ({ id: newId('r_'), label })),
      paramIds: null,
      run1: { datumId: null, votes: {}, bestChoice: null },
      run2: { datumId: null, votes: {}, bestChoice: null },
      overrides: {},
      cutoffChoice: null,
    },
    weighted: {
      mode: 'panel',
      columns: [],
      conceptIds: null,
      raterIds: null,
      scores: {},
      blinding: {},
      sentWeights: null,
    },
    captions: {},
    settingsSnapshot: null,
    changeLog: [],
  };
}
