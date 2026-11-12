/** English texts: round-1 analysis (Analysis1Screen) and consensus / weights (WeightsScreen). */
const en: Record<string, string> = {
  // ——— shared small pieces ———
  '، ': ', ',
  '؟': '?',
  '٪': '%',
  'کد': 'Code',
  'پارامتر': 'Parameter',
  'حوزه': 'Domain',
  'گروه': 'Group',
  'میانه (Q1–Q3)': 'Median (Q1–Q3)',
  'به تفکیک حوزه': 'By domain',
  'نمایش و چاپ': 'View and print',
  'انصراف': 'Cancel',
  'افزودن': 'Add',
  'همه': 'All',
  'جدید': 'New',

  // ——— round-1 analysis: statistics ———
  'تحلیل دور اول': 'Round 1 analysis',
  'برای هر پارامتر، میانه، دامنه بین چارکی و درصد پاسخ‌ها در هر طبقه، به‌صورت کلی و به تفکیک حوزه. پاسخ‌های باز کدگذاری و موارد هم‌معنا تجمیع می‌شوند.':
    'For each parameter: the median, the interquartile range and the percentage of answers in each band, overall and by domain. Open answers are coded and synonymous items are merged.',
  'آمار پارامترها': 'Parameter statistics',
  'کدگذاری پاسخ‌های باز': 'Coding open answers',
  'گزارش دور اول': 'Round 1 report',
  'هنوز پاسخی برای دور اول ثبت نشده است.': 'No answers have been recorded for round 1 yet.',
  'آمار هر پارامتر (کل پنل و به تفکیک حوزه)': 'Statistics per parameter (whole panel and by domain)',
  'نوارها توزیع پاسخ‌های معتبر هر حوزه را در طبقه‌ها نشان می‌دهند (کم‌رنگ = طبقه پایین، پررنگ = طبقه بالا). برای دیدن جزئیات هر حوزه روی ردیف کلیک کنید. میانه و دامنه بین چارکی توصیفی‌اند.':
    'The bars show how each domain’s valid answers are distributed over the bands (light = bottom band, dark = top band). Click a row to see the details for each domain. The median and the interquartile range are descriptive only.',

  // ——— round-1 analysis: new parameter dialog ———
  'ساخت پارامتر جدید برای دور دوم': 'Create a new parameter for round 2',
  'ساخت پارامتر': 'Create parameter',
  'تکراری': 'Duplicate',
  'نام پارامتر': 'Parameter name',
  'گروه معنایی': 'Semantic group',
  'الزام طراحی': 'Design requirement',
  'توضیح مختصر': 'Short explanation',
  'منشأ این پارامتر «افزوده در دور دوم» ثبت می‌شود و در پرسش‌نامه دور دوم با برچسب «جدید» و بدون داده دور اول نمایش داده می‌شود.':
    'The origin of this parameter is recorded as “added in round 2”; in the round 2 questionnaire it is shown with the label “new” and without round 1 data.',

  // ——— round-1 analysis: candidate parameters ———
  'پارامترهای نامزد': 'Candidate parameters',
  'پشتیبانی هر نامزد = تعداد خبرگان متمایز پس از ادغام موارد هم‌معنا. آستانه: دست‌کم {pct} از {n} پاسخ‌دهنده دور اول =':
    'Support for a candidate = the number of distinct experts after merging synonymous items. Threshold: at least {pct} of the {n} round 1 respondents =',
  'خبره. نامزدهای به آستانه رسیده به‌طور پیش‌فرض به دور دوم افزوده می‌شوند؛ تصمیم دستی خلاف قاعده نیاز به دلیل دارد و ثبت می‌شود.':
    'expert(s). Candidates that reach the threshold are added to round 2 by default; a manual decision against the rule needs a reason and is logged.',
  'عنوان نامزد جدید': 'Title of the new candidate',
  'افزودن نامزد': 'Add candidate',
  'هنوز نامزدی تعریف نشده است. از فهرست پاسخ‌های باز، پاسخ‌ها را به نامزدها نسبت دهید.':
    'No candidates have been defined yet. Assign answers to candidates from the list of open answers.',
  'نامزد': 'Candidate',
  'ادغام در': 'Merged into',
  'خبرگان': 'Experts',
  'قاعده {pct}': '{pct} rule',
  'تصمیم': 'Decision',
  'پارامتر دور دوم': 'Round 2 parameter',
  'عنوان نامزد': 'Candidate title',
  '— (مستقل)': '— (independent)',
  'در نامزد دیگر شمرده می‌شود': 'Counted under another candidate',
  'به آستانه رسید': 'Threshold reached',
  'نرسید': 'Not reached',
  'طبق قاعده (افزوده می‌شود)': 'By the rule (will be added)',
  'طبق قاعده (افزوده نمی‌شود)': 'By the rule (will not be added)',
  'افزوده شود (تصمیم دستی)': 'Add (manual decision)',
  'افزوده نشود (تصمیم دستی)': 'Do not add (manual decision)',
  'دلیل تصمیم دستی (الزامی)': 'Reason for the manual decision (required)',
  'حذف نامزد': 'Delete candidate',
  'نامزد حذف شد': 'Candidate deleted',
  'نامزدهای تأییدشده باید پیش از ساخت فایل‌های دور دوم به پارامتر تبدیل شوند (دکمه «ساخت پارامتر»).':
    'Approved candidates must be turned into parameters before the round 2 files are created (the “Create parameter” button).',

  // ——— round-1 analysis: open answers ———
  'گروه: {name}': 'Group: {name}',
  'نامزدها:': 'Candidates:',
  'برداشتن': 'Remove',
  '+ نسبت‌دادن به نامزد…': '+ Assign to a candidate…',
  'نسبت‌دادن به نامزد': 'Assign to a candidate',
  'نامزد تازه از این پاسخ': 'New candidate from this answer',
  '+ مربوط به پارامتر موجود…': '+ Related to an existing parameter…',
  'مربوط به پارامتر موجود': 'Related to an existing parameter',
  'فقط توضیح است (پیشنهاد پارامتر نیست)': 'Comment only (does not propose a parameter)',
  'متن قابل‌انتشار (در خروجی‌ها؛ جزئیات هویت‌بخش را حذف کنید)': 'Publishable text (used in outputs; remove identifying details)',
  'یادداشت کدگذاری': 'Coding note',
  'پاسخ‌های باز ({n})': 'Open answers ({n})',
  'کدگذاری‌نشده ({n})': 'Uncoded ({n})',
  'فیلتر': 'Filter',
  'پاسخ بازی برای نمایش نیست.': 'There are no open answers to show.',

  // ——— round-1 analysis: report ———
  'گزارش دور اول برای تیم پژوهش': 'Round 1 report for the research team',
  'شامل توصیف پنل و نرخ پاسخ، آمار هر پارامتر (کل و به تفکیک حوزه)، نمودارهای رنگی حوزه‌ها، پاسخ‌های باز و پارامترهای نامزد. فقط کد خبرگان در آن می‌آید.':
    'Contains the panel description and response rate, the statistics of each parameter (overall and by domain), the domain-coloured charts, the open answers and the candidate parameters. Experts appear by code only.',
  'گزارش ذخیره شد.': 'Report saved.',
  'دانلود HTML': 'Download HTML',

  // ——— round-1 analysis: change-log labels ———
  'کدگذاری پاسخ باز': 'Code open answer',
  'افزودن پارامتر جدید از پاسخ‌های باز': 'Add new parameter from open answers',
  'افزودن پارامتر نامزد': 'Add candidate parameter',
  'ادغام موارد هم‌معنا': 'Merge synonymous items',
  'تصمیم دستی درباره نامزد': 'Manual decision on candidate',
  'دلیل تصمیم دستی نامزد': 'Reason for manual decision on candidate',
  'حذف پارامتر نامزد': 'Delete candidate parameter',
  'افزودن پارامتر نامزد از پاسخ باز': 'Add candidate parameter from open answer',

  // ——— consensus and weights: status labels (STATUS_FA / EXCLUSION_FA) ———
  'حفظ': 'Retain',
  'فاقد اجماع': 'No consensus',
  ' (تعارض)': ' (conflict)',
  'توزیع امتیاز انجام نشده است': 'No point allocation was made',
  'توزیع میان گروه‌ها خالی است': 'The allocation between groups is blank',
  'توزیع درون یک گروه دارای امتیاز خالی است': 'The allocation within a group that received points is blank',
  'به هیچ گروه دارای پارامتر حفظ‌شده امتیاز نداده است': 'Gave no points to any group that has a retained parameter',

  // ——— consensus and weights: panel and consensus ———
  'اجماع و وزن‌ها': 'Consensus and weights',
  'معیار اجماع ازپیش‌تعیین‌شده فقط روی امتیازهای دور دوم اعمال می‌شود. وزن‌ها تنها برای پارامترهای حفظ‌شده با روابط ۱ تا ۵ از توزیع سلسله‌مراتبی امتیاز محاسبه می‌شوند.':
    'The predefined consensus criterion is applied to the round 2 ratings only. Weights are calculated for retained parameters only, with Eqs. 1 to 5, from the hierarchical point allocation.',
  'گزارش این مرحله': 'Report for this step',
  'پنل و اجماع': 'Panel and consensus',
  'وزن‌ها (روابط ۱ تا ۵)': 'Weights (Eqs. 1 to 5)',
  'تفهیم‌نامه طراحی': 'Design brief',
  'حداقل نهایی پنل برقرار است': 'The final panel minimum is met',
  'حداقل نهایی پنل برقرار نیست': 'The final panel minimum is not met',
  'کل پاسخ‌دهندگان دور دوم:': 'Round 2 respondents in total:',
  '(حداقل {n})': '(minimum {n})',
  'طبق طرح، این شرط پیش از تحلیل دور دوم بررسی می‌شود. تحلیل انجام می‌شود ولی این وضعیت در گزارش ذکر خواهد شد.':
    'According to the proposal, this condition is checked before the round 2 analysis. The analysis is still carried out, but this situation will be stated in the report.',
  'وضعیت اجماع (فقط امتیازهای دور دوم)': 'Consensus status (round 2 ratings only)',
  'همه ({n})': 'All ({n})',
  'حفظ ({n})': 'Retain ({n})',
  'حذف ({n})': 'Remove ({n})',
  'فاقد اجماع ({n})': 'No consensus ({n})',
  'فیلتر وضعیت': 'Status filter',
  'حفظ: ≥{a} پاسخ‌های معتبر در طبقه بالا و ≤{b} در طبقه پایین. حذف: ≥{c} در طبقه پایین و ≤{d} در طبقه بالا. با n = {n}: حفظ یعنی دست‌کم {top} پاسخ بالا و حداکثر {bottom} پاسخ پایین. میانه و IQR فقط توصیفی‌اند.':
    'Retain: ≥{a} of valid answers in the top band and ≤{b} in the bottom band. Remove: ≥{c} in the bottom band and ≤{d} in the top band. With n = {n}: retain means at least {top} top-band answers and at most {bottom} bottom-band answers. The median and IQR are descriptive only.',
  'هنوز پاسخی برای دور دوم ثبت نشده است.': 'No answers have been recorded for round 2 yet.',
  'وضعیت': 'Status',
  'بدون پاسخ معتبر': 'No valid answers',

  // ——— consensus and weights: weights ———
  'هیچ پارامتری به اجماع حفظ نرسیده است؛ وزنی محاسبه نمی‌شود.': 'No parameter has reached consensus to retain; no weights are calculated.',
  'خبرگان واردشده در وزن‌دهی': 'Experts included in the weighting',
  '{n} خبره کنار گذاشته شدند (توزیع امتیاز ناقص)': 'Experts excluded: {n} (incomplete point allocation)',
  '* این خبره به گروهی امتیاز داده ولی به هیچ پارامتر حفظ‌شده آن گروه امتیازی نداده است؛ آن گروه برای او فاقد پارامتر حفظ‌شده تلقی شد و سهمش میان گروه‌های دیگر او بازتوزیع شد (DECISIONS D-22).':
    '* This expert gave points to a group but none to any retained parameter of that group; for this expert the group was treated as having no retained parameter and its share was redistributed among the expert’s other groups (DECISIONS D-22).',
  'حوزه {names} توزیع‌کننده معتبر ندارد؛ رابطه ۵ روی {n} حوزه میانگین گرفته می‌شود.':
    'Domain {names} has no expert with a valid allocation; Eq. 5 is averaged over {n} domain(s).',
  'رابطه ۱ تا ۳: وزن‌های هر خبره': 'Eqs. 1 to 3: weights of each expert',
  'رابطه ۳ = وزن گروه (رابطه ۲) × وزن درون‌گروهی (رابطه ۱). برای دیدن روابط ۱ و ۲ روی کد خبره کلیک کنید. ردیف Σ باید برای هر خبره ۱ باشد.':
    'Eq. 3 = group weight (Eq. 2) × within-group weight (Eq. 1). Click an expert code to see Eqs. 1 and 2. The Σ row must be 1 for every expert.',
  'رابطه ۲ — وزن گروه‌ها نزد {code}': 'Eq. 2 — group weights for {code}',
  'رابطه ۱ — وزن درون‌گروهی': 'Eq. 1 — within-group weight',
  'رابطه ۴ و ۵: وزن هر حوزه و وزن نهایی': 'Eqs. 4 and 5: weight per domain and final weight',
  'Wᵢ×۱۰۰': 'Wᵢ×100',
  'IQR وزن‌های فردی (Q1–Q3)': 'IQR of individual weights (Q1–Q3)',
  '✓ مجموع وزن‌های کلی هر خبره = ۱': '✓ Overall weights of every expert sum to 1',
  '✗ مجموع وزن‌های یک خبره ۱ نیست': '✗ The weights of an expert do not sum to 1',
  '✓ ΣWᵢ = ۱': '✓ ΣWᵢ = 1',
  '✗ ΣWᵢ ≠ ۱': '✗ ΣWᵢ ≠ 1',

  // ——— consensus and weights: design brief ———
  'ارسال وزن‌ها به بخش ب': 'Send weights to Part B',
  'جایگزینی ستون‌های ماتریس وزن‌دار': 'Replace the weighted matrix columns',
  'ستون‌ها و وزن‌های فعلی ماتریس پیو وزن‌دار (از جمله ویرایش‌های دستی) با پارامترهای حفظ‌شده و Wᵢ فعلی جایگزین می‌شوند. امتیازهای واردشده برای پارامترهای باقی‌مانده حفظ می‌شوند.':
    'The current columns and weights of the weighted Pugh matrix (including manual edits) are replaced with the retained parameters and the current Wᵢ. Scores already entered for parameters that remain are kept.',
  'جایگزین شود': 'Replace',
  'پس از ورود پاسخ‌های دور دوم، تفهیم‌نامه طراحی ساخته می‌شود.': 'The design brief is built once the round 2 answers have been entered.',
  'تفهیم‌نامه طراحی (Design Brief)': 'Design brief',
  'آخرین ارسال به بخش ب: {date}': 'Last sent to Part B: {date}',
  'رتبه': 'Rank',
  'IQR وزن': 'Weight IQR',
  'پارامترهای حذف‌شده ({n})': 'Removed parameters ({n})',
  'پارامترهای فاقد اجماع ({n})': 'Parameters without consensus ({n})',
  'موردی نیست.': 'None.',
};

export default en;
