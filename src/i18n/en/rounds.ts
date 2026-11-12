/** English texts: collecting round-1 / round-2 answers (files, manual entry, spreadsheet import) and import checks. */
const en: Record<string, string> = {
  // ---- RoundScreen
  'دور اول': 'Round 1',
  'دور دوم': 'Round 2',
  'ماتریس وزن‌دار': 'weighted matrix',
  'هر پارامتر همراه با الزام طراحی، توضیح مختصر و محدوده عددی روی مقیاس امتیازدهی ارزیابی می‌شود. در پایان هر گروه معنایی یک پرسش باز برای پیشنهاد پارامتر جدید یا توضیح هست.':
    'Each parameter is rated on the rating scale together with its design requirement, a short description and its numeric range. Each semantic group ends with an open question for proposing a new parameter or adding a comment.',
  'بازامتیازدهی همه پارامترهای دور اول به همراه پارامترهای جدید، با بازخورد کنترل‌شده شخصی؛ و توزیع سلسله‌مراتبی ۱۰۰ امتیاز برای وزن‌دهی.':
    'Re-rating of all Round 1 parameters plus the new ones, with personal controlled feedback; and a hierarchical allocation of 100 points for weighting.',
  '{n} پارامتر': '{n} parameters',
  '{n} پارامتر جدید': '{n} new parameters',
  '{n} پاسخ‌دهنده': '{n} respondents',
  'مهلت: {date}': 'Deadline: {date}',
  'پارامترهای جدید تأییدشده هنوز ساخته نشده‌اند': 'Approved new parameters have not been created yet',
  '{n} پارامتر نامزد به آستانه رسیده ولی هنوز به فهرست اضافه نشده است.':
    '{n} candidate parameters have reached the threshold but are not yet in the list.',
  'رفتن به تحلیل دور اول': 'Go to Round 1 analysis',
  'فایل‌ها و دریافت پاسخ': 'Files and responses',
  'ورود دستی': 'Manual entry',
  'ورود از Excel / CSV': 'Import from Excel / CSV',
  'ورود دستی پاسخ‌ها': 'Manual entry of answers',

  'دعوت‌شدگان دور دوم': 'Round 2 invitees',
  'بازگشت به پیش‌فرض': 'Reset to default',
  'بازگشت دعوت دور دوم به پیش‌فرض': 'Reset Round 2 invitees to default',
  'پیش‌فرض: پاسخ‌دهندگان دور اول که انصراف نداده‌اند ({n} نفر).': 'Default: Round 1 respondents who have not withdrawn ({n} people).',
  'فهرست دستی تنظیم شده است.': 'The list has been set manually.',
  '(بدون پاسخ دور ۱)': '(no Round 1 response)',

  'فایل‌های پرسش‌نامه و دریافت پاسخ ({n} خبره)': 'Questionnaire files and responses ({n} experts)',
  'دانلود همه پرسش‌نامه‌ها (ZIP)': 'Download all questionnaires (ZIP)',
  'ورود فایل‌های پاسخ': 'Import response files',
  'برای هر خبره یک فایل HTML آفلاین ساخته می‌شود که با کد او شخصی شده است. خبره فایل را در هر مرورگری باز می‌کند، رضایت می‌دهد، پاسخ می‌دهد و «ذخیره پاسخ» را می‌زند؛ فایل کوچکی مانند':
    'An offline HTML file, personalised with the expert’s code, is created for each expert. The expert opens it in any browser, gives consent, answers and presses «ذخیره پاسخ» (Save answers); a small file such as',
  'ذخیره می‌شود که آن را برای شما ایمیل می‌کند. پیش‌نویس پاسخ‌ها در خود فایل نگه داشته می‌شود.':
    'is saved, which the expert emails to you. Draft answers are kept in the file itself.',
  'فایل دور دوم برای هر خبره بازخورد کنترل‌شده شخصی دارد: توزیع پاسخ‌های پنل در دور اول به تفکیک حوزه و فقط امتیاز خود او.':
    'Each expert’s Round 2 file carries personal controlled feedback: the distribution of the panel’s Round 1 answers by domain, and only that expert’s own rating.',
  'ابتدا گروه‌ها و پارامترها را تعریف کنید.': 'Define the groups and parameters first.',
  'کد': 'Code',
  'حوزه': 'Domain',
  'وضعیت': 'Status',
  'پاسخ دریافت‌شده': 'Response received',
  'رضایت': 'Consent',
  'فایل ساخته نشده': 'File not generated',
  'دعوت‌شده': 'Invited',
  'رضایت داده': 'Consented',
  'پاسخ داده': 'Responded',
  'انصراف داده': 'Withdrew',
  'انصراف': 'Cancel',
  '{a} از {b}': '{a} of {b}',
  'فایل': 'file',
  'صفحه‌گسترده': 'spreadsheet',
  'بدون توزیع امتیاز': 'No point allocation',
  'ثبت شده': 'Recorded',
  'ثبت نشده': 'Not recorded',
  'پرسش‌نامه': 'Questionnaire',
  'حذف پاسخ‌نامه': 'Delete response',
  'حذف پاسخ‌نامه {code}': 'Delete the response of {code}',
  'حذف': 'Delete',
  'پاسخ‌نامه {code} حذف شد': 'Response of {code} deleted',
  'ورود پاسخ‌های دور اول از فایل': 'Import Round 1 responses from files',
  'ورود پاسخ‌های دور دوم از فایل': 'Import Round 2 responses from files',
  'ورود پاسخ‌های دور اول از صفحه‌گسترده': 'Import Round 1 responses from a spreadsheet',
  'ورود پاسخ‌های دور دوم از صفحه‌گسترده': 'Import Round 2 responses from a spreadsheet',
  'اگر پاسخ‌ها را با ابزار فرم آنلاین یا در Excel گردآوری کرده‌اید، آن‌ها را در قالب الگو (یک ردیف برای هر خبره و یک ستون برای هر کد پارامتر) وارد کنید. پیش از ورود، پیش‌نمایش و تفاوت‌ها نمایش داده می‌شود.':
    'If you collected the answers with an online form tool or in Excel, import them in the template layout (one row per expert, one column per parameter code). A preview with the differences is shown before anything is imported.',
  'دانلود الگو (با پاسخ‌های فعلی)': 'Download template (with current answers)',
  'خواندن فایل ممکن نشد.': 'The file could not be read.',
  'ورود فایل': 'Import file',

  // ---- EntryGrid
  'ورود دستی پاسخ‌های دور اول': 'Manual entry of Round 1 answers',
  'ورود دستی پاسخ‌های دور دوم': 'Manual entry of Round 2 answers',
  '؟': '?',
  'عدد {min} تا {max} = امتیاز؛ x یا ق یا ؟ = «{cj}»؛ Delete = پاک‌کردن. کلیدهای جهت‌نما و Enter بین خانه‌ها جابه‌جا می‌کنند.':
    'A number from {min} to {max} = rating; x or ? = “{cj}”; Delete = clear. Arrow keys and Enter move between cells.',
  'خبره': 'Expert',
  'پاسخ‌ها': 'Answers',
  'پاسخ باز': 'Open answer',
  'توزیع امتیاز': 'Point allocation',
  'جدید': 'New',
  'رضایت {code}': 'Consent of {code}',
  'دارد ✎': 'Edit ✎',
  'افزودن': 'Add',
  'مجموع {v} ✓': 'Total {v} ✓',
  'مجموع {v} (نه ۱۰۰)': 'Total {v} (not 100)',
  'توزیع امتیاز — {code}': 'Point allocation — {code}',
  'بستن': 'Close',
  'مجموع غیر از ۱۰۰ فقط هشدار است؛ روابط ۱ و ۲ امتیازها را نرمال می‌کنند. خانه خالی در سطحی که عدد دیگری دارد صفر شمرده می‌شود.':
    'A total other than 100 is only a warning; Eqs. 1 and 2 normalise the points. An empty cell counts as zero at a level where another cell has a number.',
  'گروه‌های معنایی': 'Semantic groups',
  'امتیاز {name}': 'Points for {name}',
  'پاسخ‌های باز — {code}': 'Open answers — {code}',
  'پاسخ باز {name}': 'Open answer for {name}',

  // ---- ImportDialog
  'پیش‌نمایش ورود پاسخ‌ها': 'Import preview',
  '{n} پاسخ‌نامه وارد شد.': '{n} responses imported.',
  'ورود {n} مورد انتخاب‌شده': 'Import {n} selected',
  'برای یک خبره بیش از یک فایل انتخاب شده است؛ آخرین مورد جایگزین قبلی می‌شود.':
    'More than one file is selected for the same expert; the last one replaces the earlier ones.',
  'فایل / ردیف': 'File / row',
  'بررسی': 'Checks',
  'انتخاب': 'Select',
  'قابل ورود نیست': 'Cannot be imported',
  'جایگزینی — {n} پاسخ متفاوت': 'Replaces — {n} answers differ',
  ' (جایگزینی)': ' (replaces)',

  // ---- files.ts (change-log labels)
  'تولید فایل پرسش‌نامه دور اول': 'Generate Round 1 questionnaire files',
  'تولید فایل پرسش‌نامه دور دوم': 'Generate Round 2 questionnaire files',
  'تولید فایل امتیازدهی ماتریس وزن‌دار': 'Generate weighted-matrix scoring files',
  'ساخت کدهای تصادفی کانسپت‌ها برای خبرگان': 'Create random concept codes for the experts',

  // ---- io/responses.ts: checks shown in the import preview
  '{n} پرسش بی‌پاسخ': '{n} unanswered questions',
  'رضایت آگاهانه ثبت نشده است': 'Informed consent is not recorded',
  'توزیع امتیاز ندارد (از وزن‌دهی کنار گذاشته می‌شود)': 'No point allocation (left out of weighting)',
  'فایل JSON نیست': 'Not a JSON file',
  'فایل پاسخ این برنامه نیست': 'Not a response file of this app',
  'مربوط به پروژه دیگری است': 'Belongs to another project',
  'فایل {a} است، نه {b}': 'This is a {a} file, not {b}',
  'کنترل صحت (checksum) نادرست است: فایل آسیب دیده یا دستی ویرایش شده است':
    'The checksum is wrong: the file is damaged or was edited by hand',
  'خبره {code} در فهرست نیست': 'Expert {code} is not in the list',
  'کد خبره در فایل {a} است و اکنون {b}': 'The expert code is {a} in the file and {b} now',
  'این خبره با استفاده از داده‌هایش مخالفت کرده است؛ داده در تحلیل‌ها شمرده نمی‌شود':
    'This expert has objected to the use of their data; the data is not counted in the analyses',
  '{n} پارامتر ناشناخته در فایل (نادیده گرفته می‌شود)': '{n} unknown parameters in the file (ignored)',
  'کلید کدهای تصادفی این خبره پیدا نشد (فایل امتیازدهی از این پروژه ساخته نشده است)':
    'The random-code key of this expert was not found (the scoring file was not generated from this project)',
  'کانسپت با کد {code} ناشناخته است': 'The concept with code {code} is unknown',
  '{n} خانه بی‌پاسخ': '{n} unanswered cells',
  'فایل خالی است': 'The file is empty',
  'ستون «کد خبره» پیدا نشد': 'The «کد خبره» (expert code) column was not found',
  'ستون پارامترهای {codes} پیدا نشد (بی‌پاسخ شمرده می‌شوند)': 'No column found for parameters {codes} (counted as unanswered)',
  '، ': ', ',
  '{file} — ردیف {n}': '{file} — row {n}',
  '{n} مقدار خارج از مقیاس (نامعتبر شمرده می‌شود)': '{n} values outside the scale (treated as invalid)',
};

export default en;
