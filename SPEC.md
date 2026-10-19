# SPEC: Delphi + Pugh research app

**Status:** draft for approval (milestone 1). No UI code will be written until this file and `DECISIONS.md` are approved.

**Source of truth:** the approved thesis proposal *«طراحی اگزواسکلتون غیرفعال ارگونومیک پشتیبان پیش‌بند سربی برای جراحی درون‌عروقی مبتنی بر مدل الماس دوگانه»* (Arsalan Aboomohsenpour, version dated Thursday 1 October 2026). Every Persian quotation below is copied verbatim from that file. Each quote is tagged with its section in the proposal. Where this spec and the proposal disagree, the proposal wins. Conflicts between the build request and the proposal are listed in `DECISIONS.md` § 1.

**How to read this file.** Each rule has an ID (A1…, B1…), the proposal's wording, a short English restatement, and the TypeScript that will implement it in `src/core/`. The code here is the reference implementation: milestone 2 moves it into `src/core/` unchanged except for comments and file layout. Section 6 lists the hand-calculated datasets that become the unit tests. I checked their arithmetic with a scratch run of this exact code.

---

## 0. Scope

| In scope | Out of scope |
|---|---|
| Phase 2, **Define** (فاز دوم: تعریف): two-round modified Delphi, consensus, hierarchical point-allocation weights, design brief | Phase 1, **Discover** (literature and patent review). Only its output table is imported, as the parameter list. |
| Phase 3, **Develop** (فاز سوم: توسعه): concept records, two-run Pugh screening, weighted Pugh matrix, sensitivity analysis | Functional decomposition and the morphological chart (concepts are entered as finished records) |
| Panel description, response rates, exports, per-expert questionnaire files | Phase 4, **Deliver** (SolidWorks modelling, motion, collision, stress, parameter-compliance table) |

The proposal (section «و») says the calculations are done in Microsoft Excel. The app does them in `src/core/`, and the Excel export writes live formulas so that every number can be re-derived in Excel (see `DECISIONS.md` C4).

---

## 1. Conventions used by every rule

**1.1 Valid response.** A rating is *valid* when it is an integer inside the configured scale. A "cannot judge" answer (`'CJ'`) and a blank (`null`) are **not valid**. Both are left out of every denominator and are counted and reported separately. The proposal defines percentages over «پاسخ‌های معتبر» (valid responses). See A7.

**1.2 Bands.** The scale is split into an ordered list of contiguous bands. `bands[0]` is the **bottom** band and `bands[bands.length-1]` is the **top** band. The consensus rule only uses these two. Default: 1–3 / 4–6 / 7–9.

**1.3 One quantile method everywhere.** All medians, quartiles and IQRs (rating descriptives, the weight agreement index, relation ۶, per-domain agreement in Part B) use **Hyndman–Fan type 7**. That is the same as Excel `QUARTILE.INC` / `PERCENTILE.INC` and R's default `quantile(type = 7)`. For an even n, the type-7 median is the mean of the two middle values, exactly as the proposal states for relation ۶. IQR = Q3 − Q1. Reports show «میانه (Q1–Q3)» together with the IQR value.

```ts
// src/core/stats.ts
/** Quantile, Hyndman–Fan type 7 (= Excel QUARTILE.INC/PERCENTILE.INC, R default). Returns null for n = 0. */
export function quantile7(values: readonly number[], p: number): number | null {
  if (values.length === 0) return null;
  const x = [...values].sort((a, b) => a - b);
  const h = (x.length - 1) * p;               // 0-based position
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, x.length - 1);
  return x[lo] + (h - lo) * (x[hi] - x[lo]);  // linear interpolation between neighbours
}

export interface Quartiles { n: number; q1: number | null; median: number | null; q3: number | null; iqr: number | null }

export function quartiles(values: readonly number[]): Quartiles {
  const q1 = quantile7(values, 0.25), median = quantile7(values, 0.5), q3 = quantile7(values, 0.75);
  return { n: values.length, q1, median, q3, iqr: q1 === null || q3 === null ? null : q3 - q1 };
}

export const median = (v: readonly number[]) => quantile7(v, 0.5);
export const mean = (v: readonly number[]) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
```

**1.4 Percentage thresholds use integer arithmetic.** A threshold such as "≥ 70 %" is never tested on a computed percentage. It is tested on whole numbers: `count·100 ≥ 70·n`. The user can type thresholds with up to two decimals (e.g. 66.67), so the test is scaled by another 100: `count·10000 ≥ round(pct·100)·n`. That keeps it exact for any threshold with ≤ 2 decimals. Displayed percentages are rounded only for display. A rounded value never feeds a decision.

```ts
// src/core/thresholds.ts
const basisPoints = (pct: number) => Math.round(pct * 100);              // 70 → 7000, 66.67 → 6667
/** count/n ≥ pct %, exactly. False when n = 0. */
export const atLeastPct = (count: number, n: number, pct: number) => n > 0 && count * 10000 >= basisPoints(pct) * n;
/** count/n ≤ pct %, exactly. False when n = 0. */
export const atMostPct  = (count: number, n: number, pct: number) => n > 0 && count * 10000 <= basisPoints(pct) * n;
/** Live helper: smallest count that satisfies "≥ pct %" for this n. */
export const minCountAtLeast = (n: number, pct: number) => Math.ceil((basisPoints(pct) * n) / 10000);
/** Live helper: largest count that satisfies "≤ pct %" for this n. */
export const maxCountAtMost  = (n: number, pct: number) => Math.floor((basisPoints(pct) * n) / 10000);
```

The live helper on the settings screen reads, for example: «با n = ۱۵ دست‌کم ۱۱ پاسخ در طبقه بالا و حداکثر ۲ پاسخ در طبقه پایین لازم است». Precomputed values for the default 70 % / 15 %:

| n | 9 | 10 | 12 | 13 | 15 | 18 |
|---|---|---|---|---|---|---|
| min count in top band (≥ 70 %) | 7 | 7 | 9 | 10 | 11 | 13 |
| max count in bottom band (≤ 15 %) | 1 | 1 | 1 | 1 | 2 | 2 |

**1.5 Sum checks.** "Sums to 1" checks (relation ۳ per expert, ΣWᵢ, weighted-matrix weights) pass when `|Σ − 1| ≤ 1e-9`. Ties between computed scores (ranking, sensitivity) use the same 1e-9 tolerance.

**1.6 Any number of domains.** Domains form a list, and K = the number of domains that have data. Relations ۵ and ۷, which the proposal writes as "÷ ۳" over the three named domains, are implemented as the mean over the K domains. For the proposal's three domains the result is identical.

---

## 2. Data model (`src/core/types.ts`, summary)

```ts
type Id = string;
type ISODate = string;

interface Domain { id: Id; name: string; shortLabel: string; color: string }          // shortLabel e.g. «ج», «م», «ا»
type RoundKey = 'r1' | 'r2' | 'pugh';
type RoundState = 'none' | 'invited' | 'consented' | 'responded' | 'withdrew';
interface Expert {
  id: Id; code: string;                  // E01, E02, … (the only identifier that ever leaves the researcher view)
  domainId: Id; yearsExperience: number | null; activityType: string;
  consentDate: ISODate | null; active: boolean;
  status: Record<RoundKey, { state: RoundState; date: ISODate | null }>;
  excludeAllData: boolean;               // withdrew AND objected to use of earlier answers (ethics, § 5)
}
/** Kept in a separate store and exported only as a separate "key file" (DECISIONS C1). */
interface ExpertIdentity { expertId: Id; name: string; contact: string; notes: string }

interface SemanticGroup { id: Id; name: string }
interface Parameter {
  id: Id; code: string; name: string; groupId: Id;
  requirement: string;                   // «الزام طراحی»
  explanation: string; range: string;    // range optional, free text (e.g. «۳ تا ۸ کیلوگرم»)
  source: 'literature' | 'patent' | 'both';
  origin: 'initial' | 'round2';
}

const CJ = 'CJ' as const;
type RatingValue = number | typeof CJ | null;                   // null = no answer
interface Band { id: Id; label: string; from: number; to: number } // inclusive
interface RatingScale { min: number; max: number; bands: Band[]; allowCannotJudge: boolean; cannotJudgeLabel: string }

interface Allocation { groupPoints: Record<Id, number | null>; paramPoints: Record<Id, number | null> }
interface DelphiResponse {
  expertId: Id; round: 'r1' | 'r2';
  ratings: Record<Id, RatingValue>;      // paramId → rating
  openTexts: Record<Id, string>;         // groupId → free text (round 1)
  allocation: Allocation | null;         // round 2 only
  consent: { given: boolean; at: ISODate | null };
  source: 'file' | 'manual' | 'sheet'; receivedAt: ISODate;
}

type PughSymbol = '+' | '-' | 'S';
interface Concept { id: Id; code: string; name: string; sketch: string | null; description: string; feasible: boolean }
```

Rounds, screening runs, weighted-matrix columns, blinding keys and the change log are stored in the same way. The full set of types lands in milestone 2.

---

## 3. Part A: Define phase (two-round modified Delphi)

### A1. Panel size and minimums

> بر پایه شواهد فوق، اندازه هدف پنل ۱۵ نفر (۵ نفر از هر حوزه)، دامنه قابل‌پذیرش ۱۲ تا ۱۸ نفر و حداقل نهایی پس از افت ۹ نفر با دست‌کم ۳ نفر از هر حوزه تعیین می‌شود. این انتخاب یک تصمیم روش‌شناختی مبتنی بر شواهد است، نه تنها عدد درست ممکن، و بر استدلال‌های زیر تکیه دارد:
>
> — ۸–۴ ج) ۶

> الف) توصیف پنل و نرخ پاسخ: ویژگی‌های خبرگان (حوزه تخصصی، سابقه کار و نوع فعالیت) با فراوانی، درصد و میانه (دامنه بین چارکی)، و نرخ پاسخ و افت هر دور، به‌صورت کلی و به تفکیک حوزه گزارش می‌شود؛ رعایت حداقل نهایی پنل (۹ نفر، با دست‌کم ۳ نفر از هر حوزه) پیش از تحلیل دور دوم بررسی می‌شود.
>
> — و) ۲ الف

Settings (all editable): target 15, target per domain 5, acceptable range 12–18, minimum 9 in total and 3 per domain. The check runs on the experts who **responded in round 2**, before round-2 analysis is shown. It warns but does not block, because the proposal only says the minimum is "checked" and does not say what happens if it fails.

```ts
// src/core/delphi/panel.ts
export interface PanelRule { minTotal: number; minPerDomain: number }
export function panelMinimumCheck(respondentDomainIds: readonly Id[], domains: readonly { id: Id }[], rule: PanelRule) {
  const perDomain = Object.fromEntries(domains.map((d) => [d.id, respondentDomainIds.filter((x) => x === d.id).length]));
  const totalOk = respondentDomainIds.length >= rule.minTotal;
  const domainOk = Object.fromEntries(domains.map((d) => [d.id, perDomain[d.id] >= rule.minPerDomain]));
  return { total: respondentDomainIds.length, perDomain, totalOk, domainOk, ok: totalOk && Object.values(domainOk).every(Boolean) };
}
```

### A2. Rounds and stopping rule

> دلفی در دو دور ازپیش‌تعیین‌شده اجرا می‌شود که از رایج‌ترین طرح‌ها است (48, 50)؛ تعیین پیشاپیش تعداد دورها و معیار اجماع، از الزامات گزارش‌دهی معتبر دلفی است (57)؛ بنابراین فرایند پس از دور دوم متوقف می‌شود و پارامترهایی که تا پایان دور دوم به اجماع نرسند، به‌عنوان «فاقد اجماع» گزارش می‌شوند و وارد مرحله وزن‌دهی نهایی نمی‌شوند. مهلت پاسخ هر دور دو تا سه هفته با ارسال یادآور است و در صورت نیاز تمدید می‌شود (50). پرسش‌نامه به‌صورت الکترونیکی تهیه می‌شود؛ هر پارامتر همراه با الزام طراحی متناظر، توضیح مختصر و در صورت نیاز محدوده عددی گزارش شده پارامتر ارائه می‌شود و وضوح گویه‌ها پیش از ارسال توسط استادان راهنما و مشاور بازبینی می‌شود.
>
> — ۸–۴ د) فاز دوم: طرح دورها و قاعده توقف

Exactly two rounds, with no round 3. After round 2, every parameter without consensus is final «فاقد اجماع». Each round has editable dates (opening, deadline 2–3 weeks later by default, reminder dates, extension). Each questionnaire item shows the parameter, its «الزام طراحی», its short explanation and, if present, its numeric range.

### A3. Rating scale and bands

> اهمیت هر پارامتر برای موفقیت یک اگزواسکلتون غیرفعال پشتیبان پیش‌بند سربی برای جراحان درون‌عروقی، روی مقیاس ۹ درجه‌ای سنجیده می‌شود که در سه‌طبقه تفسیر می‌شود: ۱ تا ۳ «کم‌اهمیت»، ۴ تا ۶ «مهم اما نه حیاتی» و ۷ تا ۹ «حیاتی». این مقیاس در روش مناسبت RAND/UCLA (65) و چارچوب GRADE برای رتبه‌بندی اهمیت پیامدها (66) به‌کاررفته و در راهنمای COMET به‌عنوان مقیاس توصیه‌شده برای دلفی‌های اولویت‌بندی محور معرفی شده است (67). ساختار سه‌طبقه‌ای آن امکان تعریف صریح و ازپیش‌تعیین‌شده اجماع را فراهم می‌کند.
>
> — ۸–۴ د) فاز دوم: مقیاس امتیازدهی

> میزان اهمیت هر پارامتر نامزد برای موفقیت اگزواسکلتون، با تفسیر سه‌طبقه‌ای (۱ تا ۳ کم‌اهمیت، ۴ تا ۶ مهم اما نه حیاتی، ۷ تا ۹ حیاتی)
>
> — جدول ۷–۴، متغیر ۱

```ts
// src/core/scale.ts
export const isValidRating = (v: RatingValue, s: RatingScale): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= s.min && v <= s.max;

export const bandIndex = (v: number, s: RatingScale) => s.bands.findIndex((b) => v >= b.from && v <= b.to);

/** Bands must be ordered, contiguous, non-overlapping and cover [min, max] exactly; ≥ 2 bands. Returns problems (empty = OK). */
export function validateScale(s: RatingScale): string[] {
  const errors: string[] = [];
  if (!(Number.isInteger(s.min) && Number.isInteger(s.max) && s.min < s.max)) errors.push('range');
  if (s.bands.length < 2) errors.push('need-two-bands');
  let next = s.min;
  for (const b of s.bands) { if (b.from !== next || b.to < b.from) errors.push(`band:${b.id}`); next = b.to + 1; }
  if (next !== s.max + 1) errors.push('coverage');
  return errors;
}
```

### A4. Round 1: rating, open questions, descriptive statistics

> خبرگان به هر پارامتر روی مقیاس ۹ درجه‌ای امتیاز می‌دهند؛ در انتهای هر گروه معنایی نیز یک پرسش باز برای پیشنهاد پارامترهای جدید یا توضیح درج می‌شود. برای هر پارامتر، میانه، دامنه بین چارکی128 و درصد پاسخ‌ها در هر یک از سه‌طبقه محاسبه می‌شود. پارامترهای پیشنهادی جدید که دست‌کم ۲۰% پاسخ‌دهندگان آن‌ها را مطرح کرده باشند، پس از تجمیع موارد هم‌معنا توسط تیم پژوهش، به فهرست دور دوم افزوده می‌شوند.
>
> — ۸–۴ د) فاز دوم: دور اول

> ب) تحلیل دور اول: برای هر پارامتر، میانه، دامنه بین چارکی و درصد پاسخ‌ها در سه‌طبقه (۱ تا ۳، ۴ تا ۶ و ۷ تا ۹) به‌صورت کلی و به تفکیک حوزه محاسبه می‌شود. پاسخ‌های باز با تحلیل محتوا دسته‌بندی و موارد هم‌معنا تجمیع می‌شوند و پارامترهای جدیدی که دست‌کم ۲۰% پاسخ‌دهندگان مطرح کرده‌اند، به فهرست دور دوم افزوده می‌شوند. خروجی این مرحله، گزارش بازخورد کنترل‌شده دور دوم است.
>
> — و) ۲ ب

For each parameter, **overall and per domain**: n valid, n "cannot judge", n blank, count and % in each band, median, Q1, Q3, IQR. The analysis screen draws one small stacked bar per domain in that domain's colour, labelled with the domain's short label.

```ts
// src/core/delphi/bands.ts
export interface BandStats extends Quartiles { nCannotJudge: number; nMissing: number; counts: number[]; percents: (number | null)[] }

export function bandStats(values: readonly RatingValue[], s: RatingScale): BandStats {
  const valid: number[] = []; let nCannotJudge = 0, nMissing = 0;
  for (const v of values) {
    if (v === CJ) nCannotJudge++;
    else if (isValidRating(v, s)) valid.push(v);
    else nMissing++;                                   // blank (or out of range after a scale edit)
  }
  const counts = s.bands.map(() => 0);
  for (const v of valid) counts[bandIndex(v, s)]++;
  const n = valid.length;
  return { ...quartiles(valid), nCannotJudge, nMissing, counts, percents: counts.map((c) => (n ? (100 * c) / n : null)) };
}

/** Same statistics split by the rater's domain. */
export function bandStatsByDomain(ratings: readonly { domainId: Id; value: RatingValue }[], domains: readonly { id: Id }[], s: RatingScale) {
  return Object.fromEntries(domains.map((d) => [d.id, bandStats(ratings.filter((r) => r.domainId === d.id).map((r) => r.value), s)]));
}
```

### A5. Adding new parameters from round-1 open answers (20 % rule)

Quoted in A4 (two places: «پارامترهای پیشنهادی جدید که دست‌کم ۲۰% پاسخ‌دهندگان آن‌ها را مطرح کرده باشند، پس از تجمیع موارد هم‌معنا توسط تیم پژوهش، به فهرست دور دوم افزوده می‌شوند»).

The researcher tags each open answer with one or more *candidate parameters* and can merge synonymous candidates. Support for a candidate is the number of **distinct experts** behind it after merging. The denominator is the **number of round-1 respondents**, not the number of people who wrote open text. Candidates at or above the threshold are flagged and, by default, added to round 2 (`DECISIONS.md` D-14).

```ts
// src/core/delphi/candidates.ts
export interface Coding { expertId: Id; candidateId: Id }
/** Follows merge links (candidate → the candidate it was merged into) to the surviving candidate. */
export function canonical(id: Id, mergedInto: Readonly<Record<Id, Id | null>>): Id {
  const seen = new Set<Id>();
  while (mergedInto[id] && !seen.has(id)) { seen.add(id); id = mergedInto[id]!; }
  return id;
}
export function candidateSupport(codings: readonly Coding[], mergedInto: Readonly<Record<Id, Id | null>>): Map<Id, Set<Id>> {
  const m = new Map<Id, Set<Id>>();
  for (const c of codings) {
    const k = canonical(c.candidateId, mergedInto);
    if (!m.has(k)) m.set(k, new Set());
    m.get(k)!.add(c.expertId);                        // distinct experts only
  }
  return m;
}
export const meetsCandidateThreshold = (distinctExperts: number, round1Respondents: number, pct = 20) =>
  atLeastPct(distinctExperts, round1Respondents, pct);
```

### A6. Round 2: re-rating, personalised controlled feedback, point allocation

> بازامتیازدهی: همه پارامترهای دور اول به همراه پارامترهای جدید (در صورت اضافه‌شدن) دوباره روی همان مقیاس امتیازدهی می‌شوند؛ انتقال همه گویه‌ها به دور دوم از حذف زودهنگام پارامترها جلوگیری و به‌دقت انتخاب پارامتر‌های طراحی کمک می‌کند (67). در کنار هر پارامتر، توزیع امتیازهای پنل در سه‌طبقه به تفکیک هر حوزه تخصصی و امتیاز خود فرد در دور اول نمایش داده می‌شود تا هر عضو با مشاهده موقعیت نظر خود نسبت به گروه، در صورت تمایل امتیازش را بازبینی کند (67).
>
> — ۸–۴ د) فاز دوم: دور دوم

> توزیع امتیاز برای وزن‌دهی: هر خبره ابتدا ۱۰۰ امتیاز را میان گروه‌های معنایی و سپس، در هر گروه، ۱۰۰ امتیاز را میان پارامترهای همان گروه توزیع می‌کند (روش توزیع امتیاز129). جزئیات و مبنای این روش در ادامه آمده است.

> ناشناس ماندن و محرمانگی: هویت اعضای پنل از یکدیگر پنهان می‌ماند و هر خبره با یک کد شناسایی می‌شود. بازخورد دور دوم به‌صورت تجمیعی ارائه می‌شود و امتیاز قبلی هر فرد تنها به خود او نمایش داده می‌شود. فایل کلید تطبیق کد و هویت، جدا از داده‌ها نگهداری می‌شود. ازآنجاکه شمار خبرگان واجد شرایط در هر حوزه محدود است و شناسایی افراد از روی مشخصاتشان امکان‌پذیر است، ویژگی‌های پنل تنها به‌صورت تجمیعی و در قالب دامنه گزارش می‌شوند، نام مؤسسه محل خدمت خبرگان ذکر نمی‌شود و نقل‌قول از پاسخ‌های باز، بدون جزئیات هویت‌بخش ارائه می‌گردد.
>
> — ۹–۴ ملاحظات اخلاقی

Each expert's round-2 file contains, next to every parameter: (a) the round-1 band distribution for **each domain** (percent of valid answers plus n, in the domain's colour and short label), and (b) **that expert's own** round-1 answer, highlighted. No other individual's score is ever included in that file. Parameters added in round 2 are marked «جدید» and show «این پارامتر در دور اول وجود نداشت».

```ts
// src/core/delphi/feedback.ts
export interface FeedbackItem {
  paramId: Id; isNew: boolean;
  byDomain: Record<Id, { n: number; percents: (number | null)[] }> | null;   // null for new parameters
  own: RatingValue | 'not-asked';
}
export function buildFeedback(expertId: Id, round2Params: readonly Parameter[], r1: readonly DelphiResponse[],
                              experts: readonly Expert[], domains: readonly Domain[], s: RatingScale): FeedbackItem[] {
  const domainOf = new Map(experts.map((e) => [e.id, e.domainId]));
  const usable = r1.filter((r) => !experts.find((e) => e.id === r.expertId)?.excludeAllData);
  const own = r1.find((r) => r.expertId === expertId);
  return round2Params.map((p) => {
    if (p.origin === 'round2') return { paramId: p.id, isNew: true, byDomain: null, own: 'not-asked' };
    const rows = usable.map((r) => ({ domainId: domainOf.get(r.expertId)!, value: r.ratings[p.id] ?? null }));
    const st = bandStatsByDomain(rows, domains, s);
    return { paramId: p.id, isNew: false, own: own?.ratings[p.id] ?? null,
             byDomain: Object.fromEntries(Object.entries(st).map(([d, b]) => [d, { n: b.n, percents: b.percents }])) };
  });
}
```

Point allocation in the file: first 100 points across the semantic groups, then 100 points across the parameters of each group, with a live running total at each level. A total that is not 100 shows a warning but never blocks saving (see A8, quote «و) ۲ د»).

### A7. Consensus criteria (round 2 only)

> معیار اجماع بر اساس تعاریف COMET/GRADE تعیین می‌شود (66, 67) و روی امتیازهای دور دوم اعمال می‌شود:
>
> اجماع بر حفظ پارامتر: دست‌کم ۷۰% پاسخ‌های معتبر در طبقه ۷ تا ۹ و حداکثر ۱۵% در طبقه ۱ تا ۳ باشد.
>
> اجماع بر حذف پارامتر: دست‌کم ۷۰% پاسخ‌های معتبر در طبقه ۱ تا ۳ و حداکثر ۱۵% در طبقه ۷ تا ۹ باشد.
>
> فاقد اجماع: پارامترهایی که هیچ‌یک از دو معیار فوق را برآورده نکنند؛ این پارامترها در پایان دور دوم وارد وزن‌دهی نمی‌شوند و به‌طور جداگانه گزارش می‌شوند.
>
> درصد توافق رایج‌ترین روش تعریف اجماع در مطالعات دلفی است (57). میانه و دامنه بین چارکی برای توصیف پراکندگی گزارش می‌شوند، اما مبنای تصمیم نیستند.
>
> — ۸–۴ د) فاز دوم: معیار اجماع

> حفظ، حذف یا فاقد اجماع؛ اجماع بر حذف: دست‌کم %70 پاسخ‌ها در طبقه ۱ تا ۳ و حداکثر ۱۵% در طبقه ۷ تا ۹؛ اجماع بر حفظ: دست‌کم 70% پاسخ‌ها در طبقه ۷ تا ۹ و حداکثر ۱۵% در طبقه ۱ تا ۳
>
> — جدول ۷–۴، متغیر ۳

> ج) تحلیل دور دوم و تعیین اجماع: معیار اجماع ازپیش‌تعیین‌شده (حفظ، حذف یا فاقد اجماع) روی امتیازهای دور دوم اعمال می‌شود و تنها مبنای تصمیم درباره پارامترهاست؛ پارامترهای فاقد اجماع وارد وزن‌دهی نمی‌شوند و در فهرستی جداگانه گزارش می‌گردند.
>
> — و) ۲ ج

The rule is applied only to round-2 valid ratings. Median and IQR are shown next to it as description and are never read by the rule.

```ts
// src/core/delphi/consensus.ts
export interface ConsensusThresholds {
  retainTopMin: number;      // 70  : ≥ 70 % of valid answers in the top band …
  retainBottomMax: number;   // 15  : … and ≤ 15 % in the bottom band → retain («حفظ»)
  removeBottomMin: number;   // 70  : ≥ 70 % in the bottom band …
  removeTopMax: number;      // 15  : … and ≤ 15 % in the top band → remove («حذف»)
}
export type ConsensusStatus = 'retain' | 'remove' | 'none';

export function consensusStatus(st: { n: number; counts: readonly number[] }, t: ConsensusThresholds) {
  const bottom = st.counts[0], top = st.counts[st.counts.length - 1];
  const retainMet = atLeastPct(top, st.n, t.retainTopMin) && atMostPct(bottom, st.n, t.retainBottomMax);
  const removeMet = atLeastPct(bottom, st.n, t.removeBottomMin) && atMostPct(top, st.n, t.removeTopMax);
  // Both can only be true if the thresholds are edited to ≤ 50 %; that is reported as a settings conflict (DECISIONS D-11).
  const status: ConsensusStatus = retainMet && !removeMet ? 'retain' : removeMet && !retainMet ? 'remove' : 'none';
  return { status, retainMet, removeMet, conflict: retainMet && removeMet, noValidAnswers: st.n === 0 };
}
```

### A8. Weights: hierarchical point allocation, relations ۱–۵

> امتیاز مقیاس ۹ درجه‌ای برای تعیین «اهمیت» و اجماع به کار می‌رود، اما مبنای مناسبی برای وزن نسبی نیست. پارامترهایی که به اجماع حفظ می‌رسند، به‌حکم تعریف، امتیازهایی متمرکز در طبقه ۷ تا ۹ دارند و نرمال‌سازی میانه یا میانگین این امتیازها، وزن‌هایی تقریباً یکسان و فاقد تفکیک تولید می‌کند. ازاین‌رو، وزن نسبی با روش توزیع امتیاز تعیین می‌شود که در آن خبره ناچار به مبادله اهمیت میان پارامترهاست و وزن‌ها به طور مستقیم روی مقیاس نسبی به دست می‌آیند.
>
> توزیع امتیاز به‌صورت سلسله‌مراتبی انجام می‌شود؛ ابتدا میان گروه‌های معنایی و سپس میان پارامترهای هر گروه. این ساختار تعداد گزینه‌ها را در هر داوری محدود نگه می‌دارد (68). در وزن‌دهی سلسله‌مراتبی، وزن هر عنصر در هر سطح نسبت به عنصر بالادست آن تعیین می‌شود. وزن کلی هر عنصر از حاصل‌ضرب وزن‌های مسیر آن در سلسله‌مراتب به دست می‌آید (69-71).
>
> وزن‌ها پس از تعیین پارامترهای مورد اجماع و تنها برای همین مجموعه، در سه‌گام محاسبه می‌شوند.
>
> — ۸–۴ د) فاز دوم: محاسبه وزن نهایی پارامترها

**Step 1.**

> برای هر خبره، امتیازهای او در هر سطح دوباره تا مجموع ۱ نرمال می‌شوند:
>
> وزن درون‌گروهی پارامتر = امتیاز خبره به آن پارامتر ÷ مجموع امتیازهای همان خبره به پارامترهای حفظ‌شده همان گروه (رابطه ۱)
>
> وزن گروه = امتیاز خبره به آن گروه ÷ مجموع امتیازهای همان خبره به گروه‌هایی که دست‌کم یک پارامتر حفظ‌شده دارند (رابطه ۲)
>
> مخرج هر دو رابطه تنها شامل عناصر حفظ‌شده است. بدین ترتیب سهم پارامترها یا گروه‌های فاقد اجماع حذف نمی‌شود، بلکه به نسبت نظر همان خبره میان عناصر باقی‌مانده بازتوزیع می‌شود.

**Step 2.**

> وزن کلی پارامتر نزد خبره = وزن گروه × وزن درون‌گروهی پارامتر (رابطه ۳)
>
> ازآنجاکه هر دو سطح به ۱ نرمال شده‌اند، مجموع وزن‌های کلی همه پارامترها نزد هر خبره برابر ۱ است.

**Step 3.**

> وزن‌های فردی با میانگین حسابی تجمیع می‌شوند. این روش برای تجمیع اولویت‌های فردی در تصمیم‌گیری گروهی پذیرفته شده است (70). برای جلوگیری از غلبه یک حوزه در صورت افت نامتوازن اعضا، و در راستای اصل نمایندگی متوازن حوزه‌ها در طراحی پنل، میانگین در دو مرحله گرفته می‌شود:
>
> وزن پارامتر در هر حوزه = میانگین وزن‌های کلی آن پارامتر نزد خبرگان همان حوزه (رابطه ۴)
>
> وزن نهایی پارامتر (Wᵢ) = (وزن در حوزه جراحی + وزن در حوزه مهندسی + وزن در حوزه ارگونومی) ÷ ۳ (رابطه ۵)
>
> در صورت برابری تعداد اعضای سه حوزه، حاصل رابطه (۵) با میانگین ساده همه خبرگان یکسان است. مجموع وزن‌های نهایی نیز برابر ۱ است. برای هر پارامتر، وزن نهایی Wᵢ همراه با دامنه بین چارکی وزن‌های کلی فردی (به‌عنوان شاخص توافق بر وزن) گزارش می‌شود.

**Checks and exclusions.**

> د) محاسبه و گزارش وزن‌ها: وزن‌ها با روابط ۱ تا ۵ و تنها برای پارامترهای مورد اجماع، محاسبه می‌شوند. پیش از اعمال روی داده‌های واقعی، صحت فرمول‌ها با یک مجموعه‌داده آزمایشی با نتیجه‌ی معلوم راستی‌آزمایی می‌شود. فرم الکترونیکی مجموع امتیازهای هر سطح را کنترل می‌کند و ازآنجاکه روابط ۱ و ۲ امتیازها را دوباره نرمال می‌کنند، انحراف جزئی از مجموع ۱۰۰ بر وزن‌ها اثری ندارد. داده‌های خبرگانی که توزیع امتیاز را تکمیل نکرده‌اند کنار گذاشته می‌شوند و برابری مجموع وزن‌های کلی هر خبره و مجموع وزن‌های نهایی با ۱ به‌عنوان کنترل محاسباتی بررسی می‌شود.
>
> — و) ۲ د

> سهم نسبی هر پارامتر مورد اجماع، حاصل توزیع سلسله‌مراتبی ۱۰۰ امتیاز میان گروه‌های معنایی و پارامترها و میانگین‌گیری دومرحله‌ای میان سه حوزه تخصصی
>
> — جدول ۷–۴، متغیر ۴ (on the unit «۰ تا ۱00», see DECISIONS C6)

Who is included: experts who responded to round 2, are not excluded under § 5 (withdrew and objected), and **completed** the allocation. "Completed" means that the group level has at least one entry, and that every group with at least one retained parameter **and** a positive group score has at least one entry at parameter level. A blank next to an entered value counts as 0. Every excluded expert is listed with the reason. Points that are not 100 are accepted unchanged: relations ۱–۲ renormalise them.

```ts
// src/core/delphi/weights.ts
export interface WeightsInput {
  groups: readonly { id: Id }[];
  params: readonly { id: Id; groupId: Id }[];
  retained: ReadonlySet<Id>;                       // parameters with status 'retain'
  experts: readonly { id: Id; domainId: Id }[];    // round-2 respondents not excluded by § 5
  domains: readonly { id: Id }[];
  allocations: readonly ({ expertId: Id } & Allocation)[];
}
export type ExclusionReason = 'no-allocation' | 'group-level-blank' | 'within-group-blank' | 'zero-retained-group-points';
export interface ExpertWeights {
  expertId: Id; domainId: Id;
  groupWeight: Record<Id, number>;   // relation ۲ (groups with ≥ 1 retained parameter)
  withinWeight: Record<Id, number>;  // relation ۱ (retained parameters)
  overall: Record<Id, number>;       // relation ۳
  sum: number;                       // check: = 1
  droppedGroups: Id[];               // groups whose retained parameters got 0 points from this expert (DECISIONS D-22)
}

const pts = (v: number | null | undefined) => (typeof v === 'number' && v > 0 ? v : 0);
const anyEntered = (vals: readonly (number | null | undefined)[]) => vals.some((v) => typeof v === 'number' && Number.isFinite(v));

export function computeWeights(inp: WeightsInput) {
  // Retained parameters, grouped. Groups without any retained parameter disappear here (relation ۲ denominator).
  const retainedByGroup = new Map<Id, Id[]>();
  for (const g of inp.groups) {
    const r = inp.params.filter((p) => p.groupId === g.id && inp.retained.has(p.id)).map((p) => p.id);
    if (r.length) retainedByGroup.set(g.id, r);
  }
  const perExpert: ExpertWeights[] = [];
  const excluded: { expertId: Id; reason: ExclusionReason; groupId?: Id }[] = [];

  for (const ex of inp.experts) {
    const a = inp.allocations.find((x) => x.expertId === ex.id);
    if (!a) { excluded.push({ expertId: ex.id, reason: 'no-allocation' }); continue; }
    if (!anyEntered(inp.groups.map((g) => a.groupPoints[g.id]))) { excluded.push({ expertId: ex.id, reason: 'group-level-blank' }); continue; }

    // Relation ۱: within-group weight = points for the parameter ÷ points for the retained parameters of the same group
    const withinWeight: Record<Id, number> = {};
    const dropped: Id[] = [];
    let blankGroup: Id | null = null;
    for (const [g, rp] of retainedByGroup) {
      const gp = pts(a.groupPoints[g]);
      if (gp > 0 && !anyEntered(inp.params.filter((p) => p.groupId === g).map((p) => a.paramPoints[p.id]))) { blankGroup = g; break; }
      const denom = rp.reduce((s, p) => s + pts(a.paramPoints[p]), 0);
      if (denom === 0) { if (gp > 0) dropped.push(g); rp.forEach((p) => (withinWeight[p] = 0)); continue; }
      for (const p of rp) withinWeight[p] = pts(a.paramPoints[p]) / denom;
    }
    if (blankGroup) { excluded.push({ expertId: ex.id, reason: 'within-group-blank', groupId: blankGroup }); continue; }

    // Relation ۲: group weight = points for the group ÷ points for groups with ≥ 1 retained parameter
    const usable = [...retainedByGroup.keys()].filter((g) => !dropped.includes(g));
    const denomG = usable.reduce((s, g) => s + pts(a.groupPoints[g]), 0);
    if (denomG === 0) { excluded.push({ expertId: ex.id, reason: 'zero-retained-group-points' }); continue; }
    const groupWeight: Record<Id, number> = {};
    for (const g of retainedByGroup.keys()) groupWeight[g] = usable.includes(g) ? pts(a.groupPoints[g]) / denomG : 0;

    // Relation ۳: overall weight = group weight × within-group weight
    const overall: Record<Id, number> = {};
    for (const [g, rp] of retainedByGroup) for (const p of rp) overall[p] = groupWeight[g] * withinWeight[p];

    perExpert.push({ expertId: ex.id, domainId: ex.domainId, groupWeight, withinWeight, overall,
                     sum: Object.values(overall).reduce((s, x) => s + x, 0), droppedGroups: dropped });
  }

  const retainedIds = [...retainedByGroup.values()].flat();
  // Relation ۴: domain weight = mean of the overall weights of that domain's included experts (null if none)
  const domainWeights: Record<Id, Record<Id, number> | null> = {};
  for (const d of inp.domains) {
    const ew = perExpert.filter((e) => e.domainId === d.id);
    domainWeights[d.id] = ew.length ? Object.fromEntries(retainedIds.map((p) => [p, mean(ew.map((e) => e.overall[p]))!])) : null;
  }
  // Relation ۵: Wᵢ = mean of the domain weights over the K domains that have ≥ 1 included expert (DECISIONS D-26)
  const domainsUsed = inp.domains.map((d) => d.id).filter((d) => domainWeights[d]);
  const final: Record<Id, number> = Object.fromEntries(
    retainedIds.map((p) => [p, domainsUsed.length ? mean(domainsUsed.map((d) => domainWeights[d]![p]))! : NaN]));
  // Agreement index: quartiles/IQR of the individual overall weights (all included experts pooled)
  const agreement = Object.fromEntries(retainedIds.map((p) => [p, quartiles(perExpert.map((e) => e.overall[p]))]));

  const finalSum = Object.values(final).reduce((s, x) => s + x, 0);
  return {
    retainedGroups: [...retainedByGroup.keys()], perExpert, excluded, domainWeights,
    domainsUsed, domainsMissing: inp.domains.map((d) => d.id).filter((d) => !domainWeights[d]),
    final, agreement,
    checks: {
      expertSumsOk: perExpert.every((e) => Math.abs(e.sum - 1) <= 1e-9),
      finalSum, finalSumOk: Math.abs(finalSum - 1) <= 1e-9,
    },
  };
}
```

### A9. Panel description and response rates

Quoted in A1 (و) ۲ الف) and § 5 (ethics: reporting only in aggregate and as ranges).

Domain, years of experience and activity type are reported as frequency and %. Years of experience is also reported as median (Q1–Q3), overall and per domain, and as frequencies in editable ranges (default <5, 5–9, 10–14, 15–19, ≥20). Minimum, maximum and individual values are never shown. Response rate per round = respondents ÷ invited. Attrition from round 1 to round 2 = 1 − (round-1 respondents who also responded in round 2) ÷ round-1 respondents. All of these are shown overall and per domain (DECISIONS D-63).

```ts
// src/core/delphi/descriptives.ts
export const responseRate = (respondents: number, invited: number) => (invited > 0 ? respondents / invited : null);
export function attrition(r1Respondents: readonly Id[], r2Respondents: readonly Id[]) {
  const stayed = r1Respondents.filter((id) => r2Respondents.includes(id)).length;
  return r1Respondents.length ? 1 - stayed / r1Respondents.length : null;
}
export function binCounts(values: readonly number[], edges: readonly number[]) {   // edges [5,10,15,20] → <5, 5–9, 10–14, 15–19, ≥20
  const counts = new Array(edges.length + 1).fill(0);
  for (const v of values) counts[edges.filter((e) => v >= e).length]++;
  return counts;
}
```

### A10. Design brief (تفهیم‌نامه طراحی)

> خروجی فاز تعریف: مجموعه پارامترهای مورد اجماع، هر یک با الزام طراحی متناظر و وزن نهایی Wᵢ که به‌عنوان پارامتر‌ها و وزن‌های ماتریس‌های تصمیم در فاز توسعه به کار می‌روند؛ فهرست پارامترهای فاقد اجماع نیز به طور شفاف گزارش می‌شود. مجموع این خروجی‌ها تفهیم نامه طراحی (Design Brief) اگزواسکلتون را تشکیل می‌دهد که به شکاف سوم مطرح‌شده در بیان مسئله پاسخ می‌دهد.
>
> — ۸–۴ د) فاز دوم: خروجی فاز تعریف

Table: code, parameter, semantic group, «الزام طراحی», Wᵢ (shown both as a decimal summing to 1 and as a percentage), and the weight IQR (Q1–Q3). Removed and no-consensus parameters are listed in two separate tables. "Send weights to Part B" copies the retained parameters and their Wᵢ into the weighted Pugh matrix columns. The copied values can be edited by hand afterwards (DECISIONS D-51).

---

## 4. Part B: Develop phase (concept selection)

### B1. Concepts

> گام اول - ایده‌پردازی و ترسیم کانسپت‌ها: ابتدا کارکرد محوری اگزواسکلتون، یعنی دریافت بار پیش‌بند و انتقال آن از نواحی آسیب‌پذیر بدن، با تجزیه عملکردی130 به زیرکارکردها (مانند دریافت بار، مسیر انتقال بار، اتصال به بدن و حفظ آزادی حرکت) تقسیم می‌شود. سپس در یک جدول ریخت‌شناسی131، برای هر زیرکارکرد گزینه‌های راه‌حل از سه منبع گردآوری می‌شود: بانک اصول راه‌حل حاصل از مرور متون، پتنت‌ها و اسکچ‌های فردی (60). ترکیب گزینه‌های سازگار، کانسپت‌ها را تشکیل می‌دهد و ترکیب‌های ناسازگار کنار گذاشته می‌شوند؛ بنابراین تعداد کانسپت‌ها از پیش تعیین نمی‌شود و تابع ترکیب‌های امکان‌پذیر است. هر کانسپت با یک کد و ترسیم دستی/دیجیتال همراه با توصیف فنی کوتاه (حدود ۱۰۰ کلمه؛ شامل توضیحات عملکردی پارامترها در هر کانسپت) مستند می‌شود.
>
> — ۸–۴ د) فاز سوم: گام اول

Concept fields: code, name, optional sketch image, description (about 100 words; the app shows a word count), and a "technically feasible" flag.

### B2. Screening matrix, symbols, majority vote, net score

> گام دوم - غربال اولیه کانسپت‌ها (پیو، غیروزنی): برای کاهش تعداد کانسپت‌ها پیش از ارزیابی وزنی، از ماتریس غربال پیو با یک طرح مرجع 132 استفاده می‌شود (72). در این ماتریس، هر کانسپت بر اساس تک‌تک پارامتر‌های مورد اجماع و بدون اعمال وزن، با یک طرح مرجع مقایسه و با نمادهای «+» (بهتر)، «-» (بدتر) یا «S» (مشابه) ارزیابی می‌شود. ارزیابی توسط تیم پژوهش (پژوهشگر، استاد راهنما و استاد/استادان مشاور) انجام می‌شود. نماد هر خانه با رأی اکثریت تعیین و در صورت تساوی آرا، «S» ثبت می‌شود. امتیاز خالص هر کانسپت برابر با تعداد «+» منهای تعداد «-» است.
>
> — ۸–۴ د) فاز سوم: گام دوم

> تعداد «+» منهای تعداد «-» هر کانسپت در مقایسه با کانسپت مرجع در ماتریس غربال پیو؛ مبنای انتخاب کانسپت‌ها برای مرحله امتیازدهی وزن‌دار
>
> — جدول ۷–۴، متغیر ۸

Rows are parameters (by default the retained ones; editable). Columns are concepts, and the datum column is marked «مرجع». The app takes 1–4 raters (researcher, supervisor, advisors), or one rater in single-rater mode. A cell's symbol is the **plurality** vote, and a tie for the most votes gives `S`. A cell nobody has filled stays empty, is not counted, and triggers a warning (DECISIONS D-32).

```ts
// src/core/pugh/screening.ts
export function majoritySymbol(votes: readonly (PughSymbol | null | undefined)[]): PughSymbol | null {
  const c: Record<PughSymbol, number> = { '+': 0, '-': 0, S: 0 };
  let any = false;
  for (const v of votes) if (v) { c[v]++; any = true; }
  if (!any) return null;                                  // nobody voted
  const max = Math.max(c['+'], c['-'], c.S);
  const winners = (Object.keys(c) as PughSymbol[]).filter((k) => c[k] === max);
  return winners.length === 1 ? winners[0] : 'S';         // «در صورت تساوی آرا، S ثبت می‌شود»
}

export function screeningTotals(column: readonly (PughSymbol | null)[]) {
  const plus = column.filter((v) => v === '+').length;
  const minus = column.filter((v) => v === '-').length;
  const same = column.filter((v) => v === 'S').length;
  const empty = column.filter((v) => v === null).length;
  return { plus, minus, same, empty, net: plus - minus,          // net score = #(+) − #(−)
           dominated: plus === 0 && minus >= 1,                    // B3
           hasPlus: plus >= 1 };
}
```

### B3. Dominance rule

> مبنای حذف در هر دو اجرا، مغلوب بودن است. کانسپتی که نسبت به طرح مرجع در هیچ پارامتری «+» نداشته باشد و دست‌کم در یک پارامتر «-» داشته باشد، مغلوب طرح مرجع است و حذف می‌شود. چنین کانسپتی در ارزیابی وزنی با هیچ بردار وزنی نمی‌تواند امتیازی بالاتر از طرح مرجع کسب کند؛ بنابراین حذف آن پیش از وزن‌دهی، بر نتیجه‌ی انتخاب نهایی اثری ندارد.
>
> — ۸–۴ د) فاز سوم: گام دوم

Implemented as `dominated = plus === 0 && minus >= 1` in `screeningTotals`. Each elimination records its reason automatically, e.g. «مغلوب مرجع C1 در اجرای ۱: بدون "+"، ۲ مورد "−"».

### B4. Run 1, run 2 and forwarding to the weighted matrix

> اجرای اول: طرح مرجع، کانسپتی است که ساده‌ترین راه‌حل است. کانسپت‌های مغلوب آن حذف می‌شوند و کانسپت دارای بالاترین امتیاز خالص، به‌عنوان کانسپت برتر شناسایی می‌شود.
>
> اجرای دوم: کانسپت برتر اجرای اول، طرح مرجع قرار می‌گیرد و سایر کانسپت‌های باقی‌مانده، از جمله مرجع اجرای اول، با آن مقایسه می‌شوند. کانسپت‌های مغلوب آن حذف می‌شوند. کانسپت‌هایی که دست‌کم در یک پارامتر نسبت به کانسپت برتر «+» دارند، به دلیل داشتن مزیتی متمایز حفظ می‌شوند.
>
> کانسپت برتر و کانسپت‌های حفظ‌شده در اجرای دوم، به‌شرط امکان‌پذیری فنی، به گام بعد راه می‌یابند. اگر تعداد آن‌ها بیش از چهار باشد، کانسپت‌هایی که در اجرای دوم امتیاز خالص بالاتری دارند انتخاب می‌شوند. اگر کانسپت برتر همه‌ی کانسپت‌ها را مغلوب کند، کانسپتی که در اجرای دوم بالاترین امتیاز خالص را دارد نیز به گام بعد می‌رود تا ارزیابی وزنی دست‌کم میان دو گزینه انجام شود. این غربال، کانسپت‌هایی را که شانس انتخاب ندارند پیش از ارزیابی خبرگان کنار می‌گذارد. بدین ترتیب ماتریس وزنی شلوغ نمی‌شود و خستگی خبرگان در گام بعد کاهش می‌یابد.
>
> — ۸–۴ د) فاز سوم: گام دوم

> الف) غربال پیو: در هر اجرا، تعداد نمادهای «+»، «-» و «S» هر کانسپت شمارش و امتیاز خالص آن محاسبه می‌شود؛ سپس قاعده مغلوب بودن برای حذف اعمال می‌گردد. ماتریس هر دو اجرا، همراه با کانسپت‌های حذف‌شده و دلیل حذف هر یک، گزارش می‌شود.
>
> — و) ۳ الف

The app walks through the two runs. Run 1 uses the datum the user marks as the simplest concept. Run 2 uses the best concept from run 1 as the datum and compares the run-1 survivors plus the run-1 datum against it. Forwarding then follows the rules quoted above. Points the proposal leaves open are handled as described in DECISIONS D-34 to D-41: ties, an all-`S` concept, a tie at the 4-concept cutoff, and the "fewer than two" case. Any forwarding decision can be overridden by hand with a mandatory reason, which is logged.

```ts
// src/core/pugh/screening.ts (continued)
export interface RunInput { datumId: Id; compared: readonly Id[]; paramIds: readonly Id[]; cell: (conceptId: Id, paramId: Id) => PughSymbol | null }
export interface RunResult { datumId: Id; totals: Record<Id, ReturnType<typeof screeningTotals>>; eliminated: Id[]; survivors: Id[] }

export function evaluateRun(r: RunInput): RunResult {
  const totals: RunResult['totals'] = {};
  for (const c of r.compared) totals[c] = screeningTotals(r.paramIds.map((p) => r.cell(c, p)));
  return { datumId: r.datumId, totals,
           eliminated: r.compared.filter((c) => totals[c].dominated),
           survivors: r.compared.filter((c) => !totals[c].dominated) };
}

/** Run 1 "best" = highest net score among the survivors and the datum (whose net is 0). Returns every tied concept, in display order. */
export function bestOfRun(run: RunResult, displayOrder: readonly Id[]): Id[] {
  const cand = [run.datumId, ...run.survivors];
  const net = (c: Id) => (c === run.datumId ? 0 : run.totals[c].net);
  const max = Math.max(...cand.map(net));
  return displayOrder.filter((c) => cand.includes(c) && net(c) === max);
}

export type ForwardReason = 'best' | 'kept-has-plus' | 'safety-rule' | 'dominated' | 'equivalent-no-plus' | 'cap-exceeded' | 'infeasible';

export function forwardConcepts(run2: RunResult, feasible: (c: Id) => boolean, displayOrder: readonly Id[], maxForward = 4, minForward = 2) {
  const reason: Record<Id, ForwardReason> = {};
  const best = run2.datumId;
  const compared = Object.keys(run2.totals);
  const byNet = (a: Id, b: Id) => run2.totals[b].net - run2.totals[a].net || displayOrder.indexOf(a) - displayOrder.indexOf(b);
  for (const c of compared)
    reason[c] = run2.totals[c].dominated ? 'dominated' : run2.totals[c].hasPlus ? 'kept-has-plus' : 'equivalent-no-plus';

  const forwarded: Id[] = [];
  if (feasible(best)) { forwarded.push(best); reason[best] = 'best'; } else reason[best] = 'infeasible';

  // Kept = ≥ 1 "+" against the best; only feasible ones go forward («به‌شرط امکان‌پذیری فنی»)
  const kept = compared.filter((c) => reason[c] === 'kept-has-plus');
  for (const c of kept) if (!feasible(c)) reason[c] = 'infeasible';
  const keptFeasible = kept.filter(feasible).sort(byNet);

  // More than four: keep the higher run-2 net scores (the best always occupies one of the four places)
  const slots = maxForward - forwarded.length;
  let tieAtCutoff: Id[] = [];
  if (keptFeasible.length > slots) {
    const cut = run2.totals[keptFeasible[slots - 1]].net;
    if (run2.totals[keptFeasible[slots]].net === cut) tieAtCutoff = keptFeasible.filter((c) => run2.totals[c].net === cut);
    for (const c of keptFeasible.slice(slots)) reason[c] = 'cap-exceeded';
  }
  forwarded.push(...keptFeasible.slice(0, slots));

  // Safety rule: if the best dominates all others, also forward the highest run-2 net score so that ≥ 2 concepts are compared.
  // Generalised to "fewer than two would be forwarded for any reason" (DECISIONS D-38).
  const bestDominatesAll = compared.length > 0 && compared.every((c) => run2.totals[c].dominated);
  if (forwarded.length < minForward) {
    const pool = compared.filter((c) => !forwarded.includes(c) && feasible(c) && reason[c] !== 'cap-exceeded').sort(byNet);
    for (const c of pool.slice(0, minForward - forwarded.length)) { forwarded.push(c); reason[c] = 'safety-rule'; }
  }
  return { forwarded, reason, tieAtCutoff, bestDominatesAll };
}
```

### B5. Weighted Pugh matrix: layout, scale, raters, bias control

> گام سوم - انتخاب نهایی با ماتریس پیو وزن‌دار: در این گام، اعضای پنل که دور دوم دلفی را تکمیل کرده‌اند، کانسپت‌های راه‌یافته از گام دوم را با ماتریس پیو وزن‌دار133 ارزیابی می‌کنند (60). ستون‌های ماتریس، پارامتر‌های مورد اجماع فاز تعریف همراه با وزن نهایی آن‌ها (Wᵢ) هستند و سطرهای آن، کانسپت‌های راه‌یافته (شکل-7).
>
> — ۸–۴ د) فاز سوم: گام سوم

> امتیازدهی: خبره برای هر کانسپت و هر پارامتر تعیین می‌کند که کانسپت تا چه حد آن پارامتر را برآورده می‌سازد. این داوری روی مقیاس ارزش ۵ سطحی به‌کاررفته در روش ارزیابی وزنی طراحی مهندسی انجام می‌شود(60):
>
> ۱. نامطلوب — ۲. به‌سختی قابل‌قبول — ۳. کافی — ۴. خوب — ۵. بسیار خوب (نزدیک به حالت ایدئال)
>
> این امتیازدهی مطلق است و کانسپت‌ها با طرح مرجع مقایسه نمی‌شوند. در نتیجه ارزیابی خبرگان به طرح مرجعی که تیم پژوهش در گام غربال انتخاب کرده وابسته نیست و همه‌ی کانسپت‌ها در شرایط یکسان سنجیده می‌شوند.

> کنترل سوگیری: کانسپت‌ها با کدهای تصادفی، به ترتیب تصادفی برای هر خبره و با سبک ترسیم و سطح جزئیات یکسان ارائه می‌شوند. نتایج غربال گام دوم، از جمله اینکه کدام کانسپت برتر بوده، به خبرگان اعلام نمی‌شود. پژوهشگر که کانسپت‌ها را تولید کرده است، تنها نقش تسهیل‌گر را دارد و در امتیازدهی این گام مشارکت نمی‌کند.

The layout follows the proposal's figure ۷ (شکل-۷ پیکربندی ماتریس تصمیم‌گیری): parameter columns with their Wᵢ, concept rows, and a final «مجموع وزنی» column. Weights can be edited per column. The app shows whether they sum to 1 and offers a «نرمال‌سازی» button. Raters are the experts who responded in round 2, each tagged with their domain. The researcher is never a rater. Each expert receives an offline scoring file in which the concepts carry **random codes in a random order chosen for that expert**, and no screening result appears. The code-to-concept key stays inside the app (DECISIONS D-43).

### B6. Relations ۶, ۷ and ۸

> محاسبه‌ی امتیاز نهایی: امتیازهای خبرگان در سه مرحله به امتیاز نهایی هر کانسپت تبدیل می‌شوند.
>
> مرحله‌ی ۱: امتیاز هر حوزه
>
> برای یک کانسپت معین در یک پارامتر معین، امتیازهای خبرگان هر حوزه‌ی تخصصی (جراحی، مهندسی و ارگونومی) جداگانه در نظر گرفته می‌شود و میانه‌ی آن‌ها محاسبه می‌شود:
>
> امتیاز حوزه = میانه‌ی امتیازهای خبرگان آن حوزه به آن کانسپت در آن پارامتر (رابطه ۶)
>
> برای محاسبه‌ی میانه، امتیازها از کم به زیاد مرتب می‌شوند. اگر تعداد خبرگان حوزه فرد باشد، میانه مقدار وسط است. اگر زوج باشد، میانه میانگین دو مقدار وسط است. میانه به دو دلیل انتخاب شده است؛ مقیاس امتیازدهی ترتیبی است، و در گروه‌های کوچک (۳ تا ۵ نفر در هر حوزه) میانه برخلاف میانگین از یک امتیاز پرت اثر نمی‌پذیرد.
>
> مرحله‌ی ۲: امتیاز تجمیعی کانسپت در هر پارامتر
>
> امتیاز تجمیعی نشان می‌دهد که به داوری کل پنل، کانسپت تا چه حد آن پارامتر را برآورده می‌سازد. این امتیاز میانگین امتیاز سه حوزه است:
>
> امتیاز تجمیعی کانسپت در پارامتر = (امتیاز حوزه‌ی جراحی + امتیاز حوزه‌ی مهندسی + امتیاز حوزه‌ی ارگونومی) ÷ ۳ (رابطه ۷)
>
> این دو مرحله همان منطق تجمیع وزن‌ها در فاز تعریف (روابط ۴ و ۵) را دنبال می‌کنند. هر حوزه، مستقل از تعداد اعضای باقی‌مانده‌اش، سهم برابری در امتیاز تجمیعی دارد.
>
> مرحله‌ی ۳: امتیاز وزنی کانسپت
>
> امتیاز وزنی کانسپت = مجموعِ (وزن نهایی هر پارامتر × امتیاز تجمیعی کانسپت در آن پارامتر) به روی همه‌ی پارامتر‌ها (رابطه ۸)
>
> — ۸–۴ د) فاز سوم: گام سوم

> میزان برآورده‌شدن هر پارامتر توسط هر کانسپت از نظر خبرگان (میانه امتیاز هر حوزه و میانگین سه حوزه)
>
> مجموع حاصل‌ضرب وزن نهایی هر پارامتر در امتیاز تجمیعی کانسپت در همان پارامتر؛ مبنای رتبه‌بندی و انتخاب کانسپت برتر
>
> — جدول ۷–۴، متغیرهای ۹ و ۱۰

```ts
// src/core/pugh/weighted.ts
/** Relation ۶: domain score = median (type 7; even n → mean of the two middle values). */
export const domainScore = (scores: readonly number[]) => median(scores);
/** Relation ۷: aggregated score = mean of the domain scores of the domains that have data (K = 3 → "÷ ۳"). */
export const aggregatedScore = (domainScores: readonly (number | null)[]) => mean(domainScores.filter((x): x is number => x !== null));
/** Relation ۸: weighted score = Σ (Wᵢ × aggregated score). */
export const weightedScore = (w: readonly number[], agg: readonly number[]) => w.reduce((s, wi, i) => s + wi * agg[i], 0);

export interface WeightedInput {
  conceptIds: readonly Id[];
  columns: readonly { paramId: Id; weight: number }[];
  domains: readonly { id: Id }[];
  raters: readonly { expertId: Id; domainId: Id }[];
  score: (expertId: Id, conceptId: Id, paramId: Id) => number | null;   // 1–5 or blank
}
export function weightedPugh(inp: WeightedInput) {
  const cells: Record<Id, Record<Id, { byDomain: Record<Id, Quartiles>; domainScore: Record<Id, number | null>; aggregated: number | null }>> = {};
  const weighted: Record<Id, number | null> = {};
  for (const c of inp.conceptIds) {
    cells[c] = {};
    for (const col of inp.columns) {
      const byDomain: Record<Id, Quartiles> = {}, ds: Record<Id, number | null> = {};
      for (const d of inp.domains) {
        const v = inp.raters.filter((r) => r.domainId === d.id)
          .map((r) => inp.score(r.expertId, c, col.paramId)).filter((x): x is number => x !== null);
        byDomain[d.id] = quartiles(v);              // reported: median and IQR per concept × parameter × domain
        ds[d.id] = domainScore(v);                  // relation ۶ (null when the domain has no score here)
      }
      cells[c][col.paramId] = { byDomain, domainScore: ds, aggregated: aggregatedScore(Object.values(ds)) }; // relation ۷
    }
    const agg = inp.columns.map((col) => cells[c][col.paramId].aggregated);
    weighted[c] = agg.every((x) => x !== null) ? weightedScore(inp.columns.map((col) => col.weight), agg as number[]) : null; // relation ۸
  }
  return { cells, weighted, ranking: rankDescending(inp.conceptIds.map((id) => ({ id, score: weighted[id] }))) };
}

/** Competition ranking (1, 1, 3) with 1e-9 tie tolerance. Concepts with an incomplete row (null) are not ranked. */
export function rankDescending(items: readonly { id: Id; score: number | null }[], tol = 1e-9) {
  const scored = items.filter((x): x is { id: Id; score: number } => x.score !== null).sort((a, b) => b.score - a.score);
  return scored.map((x) => ({ ...x, rank: 1 + scored.filter((y) => y.score > x.score + tol).length }));
}
```

### B7. Report of the weighted evaluation

> گزارش: نتایج در جدولی گزارش می‌شوند شامل: امتیاز هر حوزه و امتیاز تجمیعی هر کانسپت در هر الزام، امتیاز وزنی و رتبه‌ی نهایی کانسپت‌ها، و در صورت انجام، نتایج تحلیل حساسیت.
>
> ب) ارزیابی وزن‌دار: امتیاز نهایی کانسپت‌ها با روابط ۶ تا ۸ محاسبه می‌شود و کانسپت‌ها بر حسب امتیاز وزنی رتبه‌بندی می‌شوند و در صورت اختلاف کمتر از ۱۰% دامنه‌ی مقیاس میان دو کانسپت برتر، تحلیل حساسیت تک عاملی روی وزن‌ها انجام و گزارش می‌شود. برای نشان‌دادن میزان توافق خبرگان، میانه و دامنه بین چارکی امتیازهای هر کانسپت در هر پارامتر به تفکیک حوزه نیز گزارش می‌شود.
>
> — و) ۳ ب

### B8. Sensitivity analysis (proposal) and break-even (build request)

> تحلیل حساسیت: چنانچه اختلاف امتیاز وزنی دو کانسپت برتر کمتر از ۱۰% دامنه‌ی مقیاس باشد (یعنی کمتر از ۰٫۴ در دامنه‌ی ۱ تا ۵)، تحلیل حساسیت تک عاملی روی وزن‌ها انجام می‌شود (73). روند تحلیل چنین است:
>
> وزن هر الزام به‌صورت جداگانه یک بار ۲۰% افزایش و یک بار ۲۰% کاهش داده می‌شود.
>
> در هر سناریو، وزن‌ها دوباره تا مجموع ۱ نرمال می‌شوند.
>
> امتیاز وزنی کانسپت‌ها با رابطه‌ی (۸) دوباره محاسبه می‌شود.
>
> — ۸–۴ د) فاز سوم: تحلیل حساسیت

The trigger is configurable (default 10 % of the scale range, i.e. 0.4 on 1–5, with a strict "<"). Because the build request asks for it, there is an **"always run" option, on by default**. Either way the report states whether the proposal's trigger was met (DECISIONS C2). Each scenario renormalises the weights so they sum to 1, recomputes relation ۸, and reports the new scores, the new ranking, whether the **top** concept changed and whether the **full ranking** changed. The build request also asks for a **break-even** figure: for each parameter, the smallest percentage change in its weight alone, with renormalisation, that makes the second-placed concept tie with the first. This is not in the proposal and is labelled "supplementary" in reports.

Break-even derivation. Let `A` be the first-placed concept and `B` the second, `d_i = agg_A,i − agg_B,i`, and `D₀ = Σ w_i d_i > 0`. Scale weight `k` by `(1 + δ)` and renormalise. The gap becomes `(D₀ + w_k δ d_k) / (Σw + w_k δ)`. It reaches zero at `δ* = −D₀ / (w_k d_k)`. That is possible only when `w_k > 0`, `d_k ≠ 0`, and `δ* ≥ −100 %`, since a weight cannot become negative. The denominator `Σw` cancels, so the same formula holds whether or not the weights sum to 1.

```ts
// src/core/pugh/sensitivity.ts
export const normalise = (w: readonly number[]) => { const s = w.reduce((a, b) => a + b, 0); return w.map((x) => x / s); };

export function sensitivityTrigger(top1: number, top2: number, scale: { min: number; max: number }, pctOfRange = 10) {
  const gap = top1 - top2, threshold = (pctOfRange / 100) * (scale.max - scale.min);   // 0.4 on 1–5
  return { gap, threshold, triggered: gap < threshold - 1e-9 };                          // strictly "کمتر از"
}

/** One-at-a-time ±δ on each weight, renormalised; base = normalised weights. */
export function oneAtATime(weights: readonly number[], agg: Readonly<Record<Id, readonly number[]>>, deltas = [0.2, -0.2]) {
  const base = normalise(weights);
  const order = (w: readonly number[]) => rankDescending(Object.keys(agg).map((id) => ({ id, score: weightedScore(w, agg[id]) })));
  const baseRank = order(base);
  return base.flatMap((_, k) => deltas.map((delta) => {
    const w = normalise(base.map((x, i) => (i === k ? x * (1 + delta) : x)));
    const rank = order(w);
    return { paramIndex: k, delta, weights: w, ranking: rank,
             topChanged: rank[0].id !== baseRank[0].id || rank.filter((r) => r.rank === 1).length > 1,
             rankingChanged: rank.some((r, i) => r.id !== baseRank[i].id || r.rank !== baseRank[i].rank) };
  }));
}

/** Smallest relative change δ in weight k alone that makes concept B tie with concept A. */
export function breakEven(weights: readonly number[], a: readonly number[], b: readonly number[]) {
  const d = a.map((ai, i) => ai - b[i]);
  const D0 = weights.reduce((s, wi, i) => s + wi * d[i], 0);
  return weights.map((wk, k) => {
    if (wk === 0 || d[k] === 0) return { delta: null, possible: false };          // this weight cannot change the order
    const delta = -D0 / (wk * d[k]);                                               // e.g. +1.333 → +133.3 %
    return { delta, possible: delta >= -1 };                                       // below −100 % is impossible
  });
}
```

---

## 5. Ethics rules that constrain the software

> رضایت آگاهانه: دعوت‌نامه شامل معرفی پژوهشگران (ذکر حوزه‌های تخصصی)، هدف پژوهش، مراحل مشارکت (دو دور دلفی و ارزیابی کانسپت‌ها)، زمان تقریبی هر مرحله، نحوه حفظ محرمانگی و حق انصراف است. رضایت آگاهانه در ابتدای پرسش‌نامه و پیش از نمایش پرسش‌ها اخذ می‌شود. اگرچه تعهد به مشارکت در همه دورها پیش از آغاز مطالعه پرسیده می‌شود، مشارکت کاملاً داوطلبانه است و هر خبره می‌تواند در هر مرحله و بدون ذکر دلیل انصراف دهد؛ پاسخ‌های دورهای تکمیل‌شده پیش از انصراف، تنها در صورت عدم مخالفت فرد در تحلیل همان دورها باقی می‌ماند.
>
> ناشناس ماندن و محرمانگی: هویت اعضای پنل از یکدیگر پنهان می‌ماند و هر خبره با یک کد شناسایی می‌شود. بازخورد دور دوم به‌صورت تجمیعی ارائه می‌شود و امتیاز قبلی هر فرد تنها به خود او نمایش داده می‌شود. فایل کلید تطبیق کد و هویت، جدا از داده‌ها نگهداری می‌شود. ازآنجاکه شمار خبرگان واجد شرایط در هر حوزه محدود است و شناسایی افراد از روی مشخصاتشان امکان‌پذیر است، ویژگی‌های پنل تنها به‌صورت تجمیعی و در قالب دامنه گزارش می‌شوند، نام مؤسسه محل خدمت خبرگان ذکر نمی‌شود و نقل‌قول از پاسخ‌های باز، بدون جزئیات هویت‌بخش ارائه می‌گردد.
>
> احترام به مشارکت‌کنندگان: مشارکت هیچ هزینه‌ای برای خبرگان ندارد. خلاصه نتایج پس از پایان مطالعه برای آنان ارسال می‌شود و با کسب اجازه، از مشارکتشان در بخش سپاسگزاری پایان‌نامه قدردانی می‌گردد.
>
> — ۹–۴ ملاحظات اخلاقی

What these rules require of the software:

1. **Codes only.** Expert names, contact details and notes live in a separate identity store. They appear only on the researcher's private expert screen and in a separate "key file" export. Every other output (Excel, CSV, report, charts, questionnaires, thank-you summary, project file) uses codes (DECISIONS C1).
2. **Consent first.** Each questionnaire file opens with a consent page (editable text) and shows no question until consent is given. The response file records the consent and its time (DECISIONS P1).
3. **Withdrawal.** An expert can be marked «انصراف» with a date. By default, answers from rounds completed before withdrawal stay in the analysis. If the expert objects, a flag removes all of their data from every analysis, with a preview of what changes (DECISIONS P2).
4. **Feedback.** Round-2 feedback is aggregated by domain. The only individual score shown is the expert's own, in that expert's own file.
5. **Aggregate reporting.** The panel description gives frequencies, percentages, median and IQR, and ranges only. There is no institution field. Quotes from open answers are exported from an editable "display text" so identifying details can be removed (DECISIONS P4).
6. **Thank-you summary.** After the study, a per-expert summary of aggregate results (codes only) can be generated.

---

## 6. Hand-calculated fixtures (they become the unit tests in milestone 2)

The test files will repeat this arithmetic in comments. I ran every value below through the code above.

### F1. Bands, descriptives and consensus (scale 1–9, bands 1–3 / 4–6 / 7–9, thresholds 70/15/70/15)

| Param | Round-2 answers | valid n | CJ | blank | counts (low/mid/high) | % high | % low | median (Q1–Q3), IQR | Decision |
|---|---|---|---|---|---|---|---|---|---|
| P1 | 9 8 7 7 8 9 7 5 2 CJ | 9 | 1 | 0 | 1 / 1 / 7 | 77.8 (7·100=700 ≥ 70·9=630 ✓) | 11.1 (1·100=100 ≤ 15·9=135 ✓) | 7 (7–8), 1 | **retain** |
| P2 | 1 2 3 2 1 3 4 8 CJ — | 8 | 1 | 1 | 6 / 1 / 1 | 12.5 (100 ≤ 120 ✓) | 75 (600 ≥ 560 ✓) | 2.5 (1.75–3.25), 1.5 | **remove** |
| P3 | 9 9 9 9 9 9 9 1 1 4 | 10 | 0 | 0 | 2 / 1 / 7 | 70 (700 ≥ 700 ✓) | 20 (200 ≤ 150 ✗) | 9 (5.25–9), 3.75 | **no consensus** |
| P4 | 9 8 7 7 8 9 7 5 2 4 | 10 | 0 | 0 | 1 / 2 / 7 | 70 (700 ≥ 700 ✓, exactly on the boundary) | 10 (100 ≤ 150 ✓) | 7 (5.5–8), 2.5 | **retain** |

Type-7 working for P3 (sorted 1 1 4 9 9 9 9 9 9 9, n = 10). Q1: h = 9·0.25 = 2.25, so x[2] + 0.25·(x[3] − x[2]) = 4 + 0.25·5 = 5.25. Median: h = 4.5, so (9 + 9)/2 = 9. Q3: h = 6.75, giving 9. P2 is an even-n median: sorted valid 1 1 2 2 3 3 4 8, so (2 + 3)/2 = 2.5.

### F2. Weights, relations ۱–۵ (3 domains, groups G1 = {p1, p2, p3}, G2 = {p4, p5}, G3 = {p6})

Retained: p1, p2, p4, p5. Removed: p3. No consensus: p6, so **G3 has no retained parameter**. Domains: S (surgery) = E1, E2, E5. M (engineering) = E3. A (ergonomics) = E4. E5 skipped the allocation and is excluded. E4's totals are 90 and 80, not 100, to show that the renormalisation absorbs the difference.

| Expert | G1 / G2 / G3 | p1 p2 p3 | p4 p5 | Rel. ۲: G1, G2 | Rel. ۱: p1, p2 · p4, p5 | Rel. ۳: p1, p2, p4, p5 (Σ) |
|---|---|---|---|---|---|---|
| E1 (S) | 50/30/20 | 60 20 20 | 50 50 | 50/80 = 0.625, 30/80 = 0.375 | 60/80 = 0.75, 20/80 = 0.25 · 0.5, 0.5 | 0.46875, 0.15625, 0.1875, 0.1875 (1) |
| E2 (S) | 40/40/20 | 30 30 40 | 80 20 | 0.5, 0.5 | 30/60 = 0.5, 0.5 · 0.8, 0.2 | 0.25, 0.25, 0.4, 0.1 (1) |
| E3 (M) | 20/60/20 | 10 40 50 | 25 75 | 0.25, 0.75 | 10/50 = 0.2, 0.8 · 0.25, 0.75 | 0.05, 0.2, 0.1875, 0.5625 (1) |
| E4 (A) | 30/30/30 | 50 50 0 | 40 40 | 30/60 = 0.5, 0.5 | 0.5, 0.5 · 40/80 = 0.5, 0.5 | 0.25, 0.25, 0.25, 0.25 (1) |
| E5 (S) | — | — | — | excluded: `no-allocation` | | |

Relation ۴, domain weights:
- S = mean(E1, E2): p1 (0.46875 + 0.25)/2 = 0.359375; p2 = 0.203125; p4 = 0.29375; p5 = 0.14375 (Σ = 1).
- M = E3: 0.05, 0.2, 0.1875, 0.5625.
- A = E4: 0.25 for each of the four.

Relation ۵, Wᵢ:
- W₁ = (0.359375 + 0.05 + 0.25)/3 = 0.659375/3 = **0.2197917**
- W₂ = 0.653125/3 = **0.2177083**
- W₄ = 0.73125/3 = **0.24375**
- W₅ = 0.95625/3 = **0.31875**
- ΣW = 3/3 = **1** ✓

Contrast with a one-stage mean over the four experts: W₁ would be 0.2546875. This shows the effect of the two-stage averaging, which gives a domain with one remaining expert the same say as a domain with two.

Agreement index for p1. Individual overall weights sorted: 0.05, 0.25, 0.25, 0.46875. Q1: h = 0.75, so 0.05 + 0.75·0.2 = 0.2. Median: 0.25. Q3: h = 2.25, so 0.25 + 0.25·0.21875 = 0.3046875. IQR = **0.1046875**.

### F3. Weighted Pugh, relations ۶–۸, sensitivity and break-even

W = (p1 0.6, p2 0.4). Surgery has 3 raters (odd n), engineering 2 (even n), ergonomics 1 (single expert).

| Concept · param | Surgery scores → median (rel. ۶) | Engineering → median | Ergonomics → median | Aggregated (rel. ۷) |
|---|---|---|---|---|
| K1 · p1 | 4 5 3 → 4 | 3 4 → 3.5 | 4 → 4 | 11.5/3 = 3.8333 |
| K1 · p2 | 2 3 3 → 3 | 2 2 → 2 | 3 → 3 | 8/3 = 2.6667 |
| K2 · p1 | 3 3 4 → 3 | 4 5 → 4.5 | 3 → 3 | 10.5/3 = 3.5 |
| K2 · p2 | 4 4 5 → 4 | 4 3 → 3.5 | 4 → 4 | 11.5/3 = 3.8333 |
| K3 · p1 | 2 2 3 → 2 | 2 3 → 2.5 | 2 → 2 | 6.5/3 = 2.1667 |
| K3 · p2 | 5 4 5 → 5 | 5 5 → 5 | 5 → 5 | 15/3 = 5 |

Relation ۸:
- K1 = 0.6·3.8333 + 0.4·2.6667 = 2.3 + 1.0667 = **3.3667**
- K2 = 2.1 + 1.5333 = **3.6333**
- K3 = 1.3 + 2.0 = **3.3**

Ranking: K2 (1), K1 (2), K3 (3). The gap between the top two is 0.2667 < 0.4, so the **proposal's trigger is met**.

Sensitivity (renormalised weights → K1, K2, K3):

| Scenario | Weights | K1 | K2 | K3 | Top changed | Ranking changed |
|---|---|---|---|---|---|---|
| p1 +20 % | 0.6429, 0.3571 | 3.4167 | 3.6190 | 3.1786 | no | no |
| p1 −20 % | 0.5455, 0.4545 | 3.3030 | 3.6515 | 3.4545 | no | **yes** (K3 above K1) |
| p2 +20 % | 0.5556, 0.4444 | 3.3148 | 3.6481 | 3.4259 | no | **yes** |
| p2 −20 % | 0.6522, 0.3478 | 3.4275 | 3.6159 | 3.1522 | no | no |

Break-even for K2 vs K1: d = (3.5 − 3.8333, 3.8333 − 2.6667) = (−0.3333, +1.1667), D₀ = 0.2667.
- p1: δ* = −0.2667 / (0.6·−0.3333) = **+133.3 %**. Check: weights (1.4, 0.4) give K2 = K1 = 6.4333 before normalising.
- p2: δ* = −0.2667 / (0.4·1.1667) = **−57.1 %**. Check: weights (0.6, 0.1714) give K2 = K1 = 2.7571.

Per-domain agreement for K1 · p1: surgery 4 (3.5–4.5), IQR 1; engineering 3.5 (3.25–3.75), IQR 0.5; ergonomics 4 (4–4), IQR 0.

### F4. Pugh screening: two runs, 5 concepts, 4 parameters, 3 raters

Run 1, datum C1 (simplest). Majority symbol per cell; votes shown for the interesting cells:

| | p1 | p2 | p3 | p4 | +/−/S | net | result |
|---|---|---|---|---|---|---|---|
| C2 | + (+ + S) | + | **S** (+ − S tie) | − (− − +) | 2/1/1 | 1 | survives |
| C3 | S (S S +) | − | S | − | 0/2/2 | −2 | **dominated → eliminated** («بدون + و ۲ مورد −») |
| C4 | + | + | + (+ + S) | − | 3/1/0 | **2** | survives, **best** |
| C5 | **S** (+ − S tie) | S | S | S | 0/0/4 | 0 | survives (no −, so not dominated) |

Run 2, datum C4. Compared: C2, C5 and C1 (the run-1 datum):

| | p1 | p2 | p3 | p4 | +/−/S | net | result |
|---|---|---|---|---|---|---|---|
| C2 | S | + | − | S | 1/1/2 | 0 | kept (has +) |
| C5 | − | S | − | S | 0/2/2 | −2 | **dominated → eliminated** |
| C1 | − | − | − | + | 1/3/0 | −2 | kept (has +) |

Forwarded: **C4 (best), C2, C1** (3 ≤ 4, all feasible). Edge-case variants of this fixture are listed in § 7.

### F5. Candidate threshold (20 %)

There are 15 round-1 respondents, so 3 distinct experts are needed (3·100 = 300 ≥ 20·15 = 300 ✓). Candidate X is cited by E01, E04, E04 (in a second group) and E09: 3 distinct experts → **add**. Candidate Y is cited by E02 and E03 → 2 → not added. Candidate Z is cited by E05, and candidate Z′ by E06 and E07; merging Z′ into Z gives 3 → **add**. With 13 respondents, 20 % is 2.6, so 3 are still needed. With 10 respondents, 2 are enough.

---

## 7. Edge-case tests (milestone 2)

1. **Expert skips the allocation** → excluded with `no-allocation` and listed. Weights equal those computed without the expert (F2/E5).
2. **"Cannot judge" answer** → not in n, counted in `nCannotJudge`, and it changes the percentages exactly as if it were absent (F1/P1).
3. **Group with no retained parameter** → left out of the relation ۲ denominator, and each expert's weights still sum to 1 (F2/G3).
4. **Expert gives 0 points to every retained parameter of a group but positive points to that group** → the group is dropped for that expert (D-22). Example: G1 = 50, G2 = 50, p1 = p2 = 0, p3 = 100 gives G2 weight 1, p4 = p5 = 0.5, Σ = 1.
5. **Group level blank** / **within-group blank for a group with points** → excluded with the matching reason.
6. **Domain with a single expert** → relation ۴ equals that expert's weights (F2/M, F2/A). Relation ۶ equals that expert's score, with IQR 0 (F3/ergonomics).
7. **Domain with no valid allocator** → relation ۵ is averaged over the remaining domains, `domainsMissing` is reported, and ΣW = 1 still holds.
8. **Even n for the median** → F1/P2 (2.5), F3/engineering (3.5, 4.5, 2.5).
9. **Tie in Pugh votes** → `+ − S` gives S, `+ + S S` gives S, `+ + − S` gives +, and an all-blank cell gives null (F4).
10. **Exact threshold boundary** → 70 % exactly retains (F1/P4); 15 % exactly with n = 20 and 3 answers passes "≤ 15 %".
11. **n = 0 valid answers** → `none` with `noValidAnswers`.
12. **Screening edge cases** → the best dominates all others (safety rule forwards the highest run-2 net); more than 4 kept with a tie at the cutoff; a lone all-S concept (safety rule); the best or a kept concept infeasible; the run-1 datum is the best.
13. **Thresholds edited so that retain and remove can both hold** → `conflict: true`, and the status is `none`.
14. **Weighted matrix with a blank cell** → the concept is unranked and listed as incomplete.
15. **Weights that do not sum to 1** → relation ۸ uses them as entered, with a warning, and sensitivity starts from the normalised weights.

---

## 8. Architecture summary (details in milestone 3+)

- **Stack:** Vite + React + TypeScript; Tailwind CSS; Zustand (state) with an in-memory undo/redo history; Dexie (IndexedDB) with autosave; SheetJS (`xlsx`) for Excel read/write; plain SVG charts (no chart library), so PNG and SVG export uses one code path; Vitest for tests.
- **Fonts and libraries are bundled locally.** Vazirmatn comes from the npm package and is inlined into the single-file build. Nothing loads from a CDN at runtime.
- **Builds:** `npm run dev`; `npm run build` (normal); `npm run build:single` uses `vite-plugin-singlefile` to produce one offline `.html` file.
- **Layout of `src/core/`:** `types.ts`, `stats.ts`, `thresholds.ts`, `scale.ts`, `delphi/{bands,consensus,candidates,feedback,weights,panel,descriptives}.ts`, `pugh/{screening,weighted,sensitivity}.ts`, `io/{checksum,responseFile}.ts`. The code is pure TypeScript with no React or DOM imports. Tests live in `src/core/__tests__/`.
- **Expert files:** each questionnaire or scoring file is one self-contained RTL HTML page with its own CSS, JS, font and data. Pressing «ذخیره پاسخ» downloads `E07_round1.json` (or `_round2`, `_pugh`), which carries a SHA-256 checksum of its canonical JSON payload. Drafts are kept in the file's own `localStorage`.
