/**
 * Full demo project with FICTIONAL data: 15 experts (5 per domain), 5 semantic groups, 25 parameters
 * (+1 added in round 2 from open answers), 5 concepts. Deterministic (seeded), so the same numbers appear every
 * time. It exercises the whole workflow: a "cannot judge" answer, an expert who withdrew after round 1, an expert
 * who skipped the allocation, totals that are not 100, open answers merged into a candidate, both screening runs
 * and the weighted matrix with its sensitivity analysis.
 */
import {
  CJ,
  createProject,
  newExpert,
  newId,
  projectWeights,
  type Allocation,
  type DelphiResponse,
  type ExpertIdentity,
  type Id,
  type Parameter,
  type Project,
  type PughSymbol,
  type RatingValue,
} from '../core';
import { makeBlindingKey } from '../questionnaire/build';
import { buildWorkedExample } from './workedExample';

export { buildWorkedExample };

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Profile = 'core' | 'strong' | 'split' | 'weak';

/** [group, name, requirement, explanation, range, source, profile] */
const PARAMS: [number, string, string, string, string, Parameter['source'], Profile][] = [
  [0, 'دامنه حرکتی خم‌شدن تنه به جلو', 'عدم محدودکردن خم‌شدن تنه تا حد لازم در مداخله', 'دامنه خم‌شدن تنه که دستگاه نباید آن را محدود کند', '۰ تا ۴۰ درجه', 'both', 'strong'],
  [0, 'چرخش محوری تنه', 'امکان چرخش تنه به سمت مانیتور و میز ابزار', 'چرخش تنه حول محور طولی بدون مقاومت قابل‌توجه', '۰ تا ۳۰ درجه', 'literature', 'strong'],
  [0, 'آزادی حرکت شانه و بازو', 'عدم تداخل با حرکات دست و کنترل کاتتر', 'اجزای دستگاه نباید فضای حرکت اندام فوقانی را اشغال کنند', '', 'literature', 'core'],
  [0, 'هم‌راستایی محور مفصل ران', 'کاهش ناهم‌راستایی محور دستگاه با مفصل ران', 'ناهم‌راستایی می‌تواند نیروهای ناخواسته ایجاد کند', '', 'patent', 'split'],
  [0, 'امکان راه‌رفتن و جابه‌جایی در اتاق', 'عدم محدودیت در گام‌برداری و چرخش', 'جراح بین میز، مانیتور و تجهیزات جابه‌جا می‌شود', '', 'literature', 'strong'],
  [1, 'انتقال بار استاتیک پیش‌بند سربی', 'حفظ ایمنی و جلوگیری از کاهش عملکرد جراح', 'انتقال وزن پیش‌بند از شانه‌ها و ستون فقرات', '۳ تا ۸ کیلوگرم', 'both', 'core'],
  [1, 'مسیر انتقال بار به لگن', 'هدایت بار از کمربند شانه به کمربند لگنی', 'مسیر سازه‌ای انتقال نیرو تا لگن', '', 'both', 'core'],
  [1, 'جرم کل اگزواسکلتون', 'افزودن کمترین جرم ممکن به کاربر', 'جرم دستگاه خود باری اضافه است', 'کمتر از ۳ کیلوگرم', 'literature', 'strong'],
  [1, 'جبران‌سازی غیرفعال با عنصر الاستیک', 'عملکرد بدون باتری یا موتور', 'فنر یا تیر الاستیک برای ذخیره و آزادسازی انرژی', '', 'patent', 'split'],
  [1, 'توزیع فشار در نقاط تماس', 'جلوگیری از فشار موضعی بیش از آستانه ناراحتی', 'سطح تماس کافی در شانه، کمر و لگن', '', 'literature', 'strong'],
  [2, 'راحتی حرارتی و تهویه', 'جلوگیری از افزایش تعریق زیر پیش‌بند', 'لایه‌های اضافه دمای زیر پیش‌بند را بالا می‌برند', '', 'literature', 'strong'],
  [2, 'سهولت پوشیدن و درآوردن', 'پوشیدن و درآوردن بدون کمک دیگران', 'زمان و تعداد مراحل پوشیدن و درآوردن', 'کمتر از ۲ دقیقه', 'literature', 'core'],
  [2, 'عدم ایجاد حواس‌پرتی', 'کاهش بار شناختی حین عمل', 'دستگاه نباید توجه جراح را از مانیتور منحرف کند', '', 'literature', 'strong'],
  [2, 'پشتیبانی در ایستادن طولانی', 'حمایت در ایستادن ۲ تا ۶ ساعته', 'خستگی ناشی از وضعیت ایستای طولانی', '۲ تا ۶ ساعت', 'literature', 'strong'],
  [2, 'حجم و برجستگی پروفایل', 'عدم افزایش فضای اشغالی کنار میز عمل', 'برجستگی دستگاه از سطح پیش‌بند', '', 'patent', 'weak'],
  [3, 'تنظیم طول تنه', 'پوشش صدک ۵ زنان تا ۹۵ مردان', 'طول پشتی متناسب با قد کاربر', '', 'both', 'strong'],
  [3, 'تنظیم عرض لگن', 'پوشش دامنه آنتروپومتریک لگن', 'کمربند لگنی قابل‌تنظیم', '', 'patent', 'strong'],
  [3, 'سازگاری با انواع پیش‌بند', 'سازگاری با پیش‌بند یک‌تکه و دوتکه', 'اتصال به مدل‌ها و اندازه‌های رایج پیش‌بند', '', 'both', 'core'],
  [3, 'تنظیم پیش‌بار عنصر الاستیک', 'تنظیم نیروی حمایتی متناسب با وزن پیش‌بند', 'پیش‌بار فنر برای پیش‌بندهای سبک و سنگین', '', 'patent', 'split'],
  [3, 'تنظیم سریع بدون ابزار', 'تنظیم توسط خود کاربر در کمتر از یک دقیقه', 'سازوکار تنظیم با یک دست', 'کمتر از ۱ دقیقه', 'patent', 'strong'],
  [4, 'حفظ میدان استریل', 'عدم تماس با میدان استریل و قابلیت پوشش با گان', 'دستگاه زیر گان جراحی قرار می‌گیرد', '', 'literature', 'core'],
  [4, 'آزادسازی سریع اضطراری', 'جداسازی دستگاه در شرایط اضطراری', 'قفل آزادسازی سریع', 'کمتر از ۱۰ ثانیه', 'patent', 'strong'],
  [4, 'عدم تداخل با حفاظت پرتویی', 'عدم ایجاد شکاف یا جابه‌جایی در پوشش پیش‌بند', 'هم‌پوشانی کامل پیش‌بند حفظ شود', '', 'both', 'core'],
  [4, 'قابلیت ضدعفونی سطوح', 'سازگاری مواد با ضدعفونی‌کننده‌های بیمارستانی', 'سطوح قابل تمیزکردن', '', 'literature', 'strong'],
  [4, 'پایداری و جلوگیری از سقوط', 'عدم جابه‌جایی ناپایدار مرکز ثقل', 'دستگاه نباید تعادل ایستادن را بر هم بزند', '', 'literature', 'strong'],
];

const GROUPS = ['سینماتیک', 'دینامیک', 'ارگونومی', 'تنظیم‌پذیری', 'ایمنی'];

/**
 * A rating for a profile: first a band is drawn (round 2 is more concentrated than round 1, as expected after
 * controlled feedback), then a value inside the band. `domainShift` nudges the top-band probability.
 */
const BAND_P: Record<Profile, [number, number][]> = {
  // [P(low), P(mid)] for round 1 and round 2; P(top) is the rest
  core: [
    [0, 0.15],
    [0, 0.05],
  ],
  strong: [
    [0.05, 0.25],
    [0.02, 0.12],
  ],
  split: [
    [0.1, 0.45],
    [0.05, 0.42],
  ],
  weak: [
    [0.6, 0.3],
    [0.9, 0.09],
  ],
};
function rating(r: () => number, profile: Profile, round: 1 | 2, domainShift: number): number {
  const [pl, pm] = BAND_P[profile][round - 1];
  const adj = 0.08 * domainShift;
  const low = Math.max(0, pl - adj / 2);
  const mid = Math.max(0, pm - adj / 2);
  const u = r();
  const band = u < low ? 0 : u < low + mid ? 1 : 2;
  const v = r();
  const inBand = v < 0.3 ? 0 : v < 0.7 ? 1 : 2;
  return band * 3 + inBand + 1;
}

export function buildDemoProject(): { project: Project; identities: Record<Id, ExpertIdentity> } {
  const r = rng(20261019);
  const p = createProject('پروژه نمونه (داده ساختگی)');
  // fixed ids and dates so the demo is identical every time it is built
  p.createdAt = p.updatedAt = '2026-10-19T08:00:00.000Z';
  p.domains = p.domains.map((d, i) => ({ ...d, id: ['dom-surgery', 'dom-engineering', 'dom-ergonomics'][i] }));
  p.screening.raters = p.screening.raters.map((x, i) => ({ ...x, id: `rater${i + 1}` }));
  const domains = p.domains.map((d) => d.id);
  p.groups = GROUPS.map((name, i) => ({ id: `g${i + 1}`, name }));
  p.params = PARAMS.map(([g, name, requirement, explanation, range, source], i) => ({
    id: `prm${i + 1}`,
    code: `P${String(i + 1).padStart(2, '0')}`,
    name,
    groupId: `g${g + 1}`,
    requirement,
    explanation,
    range,
    source,
    origin: 'initial',
  }));
  const years = [12, 9, 17, 6, 21, 8, 14, 11, 5, 19, 10, 7, 16, 13, 25];
  const activity = ['بالینی', 'بالینی', 'دانشگاهی', 'بالینی', 'دانشگاهی', 'صنعتی', 'دانشگاهی', 'پژوهشی', 'صنعتی', 'دانشگاهی', 'دانشگاهی', 'پژوهشی', 'بالینی', 'دانشگاهی', 'پژوهشی'];
  p.experts = Array.from({ length: 15 }, (_, i) => ({
    ...newExpert(`E${String(i + 1).padStart(2, '0')}`, domains[Math.floor(i / 5)]),
    id: `ex${i + 1}`,
    yearsExperience: years[i],
    activityType: activity[i],
    consentDate: '2026-11-02',
    inclusionMet: true,
  }));
  p.expertCodeCounter = 15;
  // E04 (surgery) has 6 years (≥ 5); E09 (engineering) has 5 years — engineering has no minimum, so no warning.
  p.settings.schedule.r1 = { opens: '2026-11-02', deadline: '2026-11-16', reminders: ['2026-11-12'], extendedTo: null };
  p.settings.schedule.r2 = { opens: '2026-11-30', deadline: '2026-12-14', reminders: ['2026-12-10'], extendedTo: '2026-12-17' };
  p.settings.schedule.pugh = { opens: '2027-01-11', deadline: '2027-01-25', reminders: [], extendedTo: null };

  // domain shifts: surgeons value comfort/sterility more, engineers kinematics/dynamics, ergonomists posture
  const shift = (domainIdx: number, group: number) =>
    [
      [0.2, 0.1, 0.5, -0.3, 0.6],
      [0.4, 0.5, -0.2, 0.3, -0.1],
      [0.1, 0.2, 0.6, 0.2, 0.0],
    ][domainIdx][group];

  const mk = (expertId: Id, round: 'r1' | 'r2', ratings: Record<Id, RatingValue>, at: string, allocation: Allocation | null = null, openTexts: Record<Id, string> = {}): DelphiResponse => ({
    expertId,
    round,
    ratings,
    openTexts,
    allocation,
    consent: { given: true, at },
    source: 'file',
    receivedAt: at,
  });

  // ---- round 1: all 15 respond
  const openR1: Record<number, Record<Id, string>> = {
    0: { g3: 'تهویه زیر پیش‌بند در عمل‌های طولانی بسیار مهم است.' },
    3: { g5: 'دستگاه باید با محافظ تیروئید و عینک سربی هم سازگار باشد.' },
    6: { g5: 'سازگاری با محافظ گردن (تیروئید) را اضافه کنید.' },
    8: { g2: 'شاید پایش نیروی وارد بر شانه مفید باشد.' },
    11: { g5: 'هم‌خوانی با عینک و محافظ تیروئید سربی بررسی شود.' },
    13: { g1: 'دامنه حرکتی گردن هم در نظر گرفته شود.' },
  };
  for (let i = 0; i < 15; i++) {
    const di = Math.floor(i / 5);
    const ratings: Record<Id, RatingValue> = {};
    PARAMS.forEach(([g, , , , , , prof], k) => (ratings[`prm${k + 1}`] = rating(r, prof, 1, shift(di, g))));
    if (i === 9) ratings.prm9 = CJ; // an engineer answers «توانایی قضاوت ندارم» for one parameter
    p.responses.r1[`ex${i + 1}`] = mk(`ex${i + 1}`, 'r1', ratings, '2026-11-1' + (i % 5), null, openR1[i] ?? {});
    p.experts[i].status.r1 = { state: 'responded', date: '2026-11-1' + (i % 5) };
  }

  // ---- open-answer coding: "compatibility with thyroid shield / lead glasses" raised by 3 experts (≥ 20 % of 15)
  p.candidates = [
    { id: 'cand1', label: 'سازگاری با محافظ تیروئید و عینک سربی', mergedInto: null, override: null, overrideReason: '', paramId: 'prm26' },
    { id: 'cand2', label: 'سازگاری با محافظ گردن', mergedInto: 'cand1', override: null, overrideReason: '', paramId: null },
    { id: 'cand3', label: 'پایش نیروی وارد بر شانه', mergedInto: null, override: null, overrideReason: '', paramId: null },
    { id: 'cand4', label: 'دامنه حرکتی گردن', mergedInto: null, override: null, overrideReason: '', paramId: null },
  ];
  const code = (k: string, cands: Id[], paramIds: Id[] = [], commentOnly = false) => ({ key: k, candidateIds: cands, paramIds, commentOnly, displayText: null, note: '' });
  p.codings = {
    'ex1|g3': code('ex1|g3', [], ['prm11']),
    'ex4|g5': code('ex4|g5', ['cand1']),
    'ex7|g5': code('ex7|g5', ['cand2']),
    'ex9|g2': code('ex9|g2', ['cand3']),
    'ex12|g5': code('ex12|g5', ['cand1']),
    'ex14|g1': code('ex14|g1', ['cand4']),
  };
  p.params.push({
    id: 'prm26',
    code: 'P26',
    name: 'سازگاری با محافظ تیروئید و عینک سربی',
    groupId: 'g5',
    requirement: 'عدم تداخل با سایر تجهیزات حفاظت پرتویی',
    explanation: 'پیشنهادشده در پاسخ‌های باز دور اول (۳ خبره)',
    range: '',
    source: 'literature',
    origin: 'round2',
  });

  // ---- round 2: E07 (engineering) withdrew after round 1 (no objection: round-1 answers stay)
  p.experts[6].status.r2 = { state: 'withdrew', date: '2026-12-01' };
  const profiles: Profile[] = [...PARAMS.map((x) => x[6]), 'strong'];
  const groupOf = [...PARAMS.map((x) => x[0]), 4];
  for (let i = 0; i < 15; i++) {
    if (i === 6) continue;
    const di = Math.floor(i / 5);
    const id = `ex${i + 1}`;
    const ratings: Record<Id, RatingValue> = {};
    profiles.forEach((prof, k) => (ratings[`prm${k + 1}`] = rating(r, prof, 2, shift(di, groupOf[k]))));
    // hierarchical allocation: groups by preference, then parameters by importance
    let allocation: Allocation | null = null;
    if (i !== 3) {
      // E04 skipped the allocation (excluded from the weights)
      const gRaw = [0, 1, 2, 3, 4].map((g) => Math.max(5, 20 + 12 * shift(di, g) + 8 * (r() - 0.5)));
      const gSum = gRaw.reduce((s, x) => s + x, 0);
      const total = i === 11 ? 90 : 100; // E12's group total is 90 (renormalised by relation ۲)
      const gPts = gRaw.map((x) => Math.round((total * x) / gSum));
      const groupPoints = Object.fromEntries(gPts.map((v, g) => [`g${g + 1}`, v]));
      const paramPoints: Record<Id, number> = {};
      for (let g = 0; g < 5; g++) {
        const ids = profiles.map((_, k) => k).filter((k) => groupOf[k] === g);
        const raw = ids.map((k) => ({ k, v: Math.max(2, (profiles[k] === 'core' ? 34 : profiles[k] === 'strong' ? 22 : profiles[k] === 'split' ? 12 : 5) + 6 * (r() - 0.5)) }));
        const s = raw.reduce((a, x) => a + x.v, 0);
        let left = 100;
        raw.forEach((x, j) => {
          const v = j === raw.length - 1 ? left : Math.round((100 * x.v) / s);
          paramPoints[`prm${x.k + 1}`] = v;
          left -= v;
        });
      }
      allocation = { groupPoints, paramPoints };
    }
    p.responses.r2[id] = mk(id, 'r2', ratings, '2026-12-0' + (2 + (i % 7)), allocation);
    p.experts[i].status.r2 = { state: 'responded', date: '2026-12-0' + (2 + (i % 7)) };
  }

  // ---- Part B: concepts
  const sketch = (variant: number) => {
    const parts = [
      '<path d="M60 20v100M40 40h40M60 120l-15 40M60 120l15 40" stroke="#444" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="60" cy="12" r="9" fill="none" stroke="#444" stroke-width="4"/>',
    ];
    const extra = [
      '<path d="M42 38l-6 60M78 38l6 60" stroke="#0072B2" stroke-width="5"/>',
      '<path d="M60 30v80M45 110h30" stroke="#0072B2" stroke-width="6"/><path d="M48 30h24" stroke="#0072B2" stroke-width="5"/>',
      '<path d="M30 40h60v20H30z" stroke="#0072B2" stroke-width="4" fill="none"/><path d="M60 60v100" stroke="#0072B2" stroke-width="5"/>',
      '<path d="M44 34c-10 30-10 50 0 76h32c10-26 10-46 0-76" stroke="#0072B2" stroke-width="5" fill="none"/><path d="M52 60h16M52 80h16" stroke="#E69F00" stroke-width="4"/>',
      '<path d="M40 40l40 70M80 40l-40 70" stroke="#0072B2" stroke-width="4"/><path d="M40 110h40" stroke="#0072B2" stroke-width="6"/>',
    ][variant];
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 170" width="240" height="340"><rect width="120" height="170" fill="#fff"/>${parts[0]}${extra}</svg>`;
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  };
  const concepts: [string, string, boolean][] = [
    ['بند شانه‌ای ساده با پشتیبان عمودی', 'دو بند پهن روی شانه‌ها وزن پیش‌بند را می‌گیرند و با دو تسمه عمودی به کمربند لگنی منتقل می‌کنند. ساده‌ترین راه‌حل، بدون عنصر الاستیک؛ پوشیدن آسان ولی آزادی حرکت تنه محدود است.', true],
    ['تیر فیبر کربنی پشتی و کمربند لگنی', 'یک تیر انعطاف‌پذیر فیبر کربنی در امتداد ستون فقرات، بار پیش‌بند را از قاب شانه به کمربند لگنی منتقل می‌کند و با خم‌شدن تنه انرژی ذخیره می‌کند. سبک و کم‌حجم؛ تنظیم طول تنه با ریل کشویی.', true],
    ['قاب ستونی با تکیه‌گاه زمینی', 'قاب سبکی که بار را از شانه‌ها از طریق ساق به زمین منتقل می‌کند. باربرداری کامل از ستون فقرات ولی محدودیت شدید در راه‌رفتن و خطر برخورد با تجهیزات؛ از نظر فنی در فضای اتاق آنژیوگرافی امکان‌پذیر ارزیابی نشد.', false],
    ['قاب پشتی با فنر جبران گرانش', 'قاب پشتی دو‌تکه با مفصل هم‌راستا با ران و فنرهای پیچشی جبران گرانش؛ بار پیش‌بند از شانه‌ها به لگن منتقل و نیروی حمایتی با پیش‌بار فنر متناسب با وزن پیش‌بند تنظیم می‌شود. آزادسازی سریع با یک دست.', true],
    ['کمربند لگنی با بندهای الاستیک ضربدری', 'بندهای الاستیک ضربدری در پشت، بخشی از وزن پیش‌بند را به کمربند لگنی منتقل می‌کنند. بسیار سبک و ارزان؛ انتقال بار جزئی و وابسته به کشش بندها.', true],
  ];
  p.concepts = concepts.map(([name, description, feasible], i) => ({ id: `con${i + 1}`, code: `C${i + 1}`, name, sketch: sketch(i), description, feasible }));

  // ---- Part B: screening on the retained parameters (team of 3); C1 = simplest = datum of run 1
  const rIds = p.screening.raters.map((x) => x.id);
  p.screening.run1.datumId = 'con1';
  // concept "quality" per parameter group, used to draw plausible votes vs a datum
  // groups: kinematics, dynamics, ergonomics, adjustability, safety. C2 and C5 beat C4 on ergonomics, so they
  // survive run 2 with a distinct advantage; C1 is dominated by C4; C3 is dominated by C1 already in run 1.
  const q: Record<string, number[]> = {
    con1: [1, 1, 2, 1, 2],
    con2: [3, 3, 3, 1, 2],
    con3: [0, 1, 1, 1, 1],
    con4: [3, 3, 2, 3, 3],
    con5: [2, 1, 3, 2, 2],
  };
  const vote = (a: string, b: string, g: number, seed: number): PughSymbol => {
    const d = q[a][g] - q[b][g] + (seed - 0.5) * 1.2;
    return d > 0.6 ? '+' : d < -0.6 ? '-' : 'S';
  };
  const allIds = p.params.map((x) => x.id);
  const groupIdx = (pid: string) => Number(p.params.find((x) => x.id === pid)!.groupId.slice(1)) - 1;
  const fillVotes = (datum: string, compared: string[]) =>
    Object.fromEntries(rIds.map((rid) => [rid, Object.fromEntries(compared.map((c) => [c, Object.fromEntries(allIds.map((pid) => [pid, vote(c, datum, groupIdx(pid), r())]))]))]));
  p.screening.run1.votes = fillVotes('con1', ['con2', 'con3', 'con4', 'con5']);
  p.screening.run2.datumId = 'con4';
  p.screening.run2.votes = fillVotes('con4', ['con1', 'con2', 'con3', 'con5']);

  // ---- weighted matrix: raters = round-2 respondents; scores by concept quality with noise
  const forwarded = ['con4', 'con2', 'con5'];
  const respondentsR2 = Object.keys(p.responses.r2);
  for (const e of respondentsR2) {
    p.weighted.blinding[e] = makeBlindingKey(forwarded, Math.floor(r() * 2 ** 31));
    p.weighted.scores[e] = Object.fromEntries(
      forwarded.map((c) => [
        c,
        Object.fromEntries(allIds.map((pid) => [pid, Math.max(1, Math.min(5, Math.round(2.0 + q[c][groupIdx(pid)] * 0.8 + (r() - 0.5) * 1.6)))])),
      ]),
    );
    p.experts.find((x) => x.id === e)!.status.pugh = { state: 'responded', date: '2027-01-2' + Math.floor(r() * 5) };
  }

  // "send weights to Part B": the retained parameters with their Wᵢ become the weighted-matrix columns
  const w = projectWeights(p);
  p.weighted.columns = w.retainedParams.map((id) => ({ paramId: id, weight: w.final[id] }));
  p.weighted.sentWeights = { at: '2027-01-05T10:00:00.000Z', weights: Object.fromEntries(w.retainedParams.map((id) => [id, w.final[id]])) };

  p.settingsSnapshot = { at: '2026-11-10T09:00:00.000Z', scale: structuredClone(p.scale), consensus: { ...p.settings.consensus }, candidatePct: p.settings.candidatePct };
  const identities: Record<Id, ExpertIdentity> = Object.fromEntries(
    p.experts.map((e, i) => [e.id, { name: `خبره نمونه ${i + 1}`, contact: `expert${i + 1}@example.org`, notes: 'داده ساختگی برای نمایش' }]),
  );
  p.id = newId('demo_');
  return { project: p, identities };
}
