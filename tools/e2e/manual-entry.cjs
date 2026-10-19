/**
 * Manual-entry test: starts from an empty project and types every piece of data of the hand-solved example
 * (SPEC.md § 6, fixtures F1–F5) into the app through its screens, the way a researcher would, with no file import
 * and no sample project. Then it checks that the app shows the hand-calculated results and saves the project file
 * for check-manual.test.ts, which compares it number by number with the worked example.
 *
 *   node tools/e2e/manual-entry.cjs [path/to/app.html]     (default: dist-single/index.html)
 *
 * Runs Chromium with the network switched off. Screenshots and the downloaded files go to tools/e2e/work/.
 */
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../..');
const html = path.resolve(process.argv[2] ?? path.join(root, 'dist-single/index.html'));
const work = process.env.MANUAL_WORK_DIR ?? path.join(__dirname, 'work');
const exe = process.env.CHROMIUM_PATH ?? (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

// ---------------------------------------------------------------------------------------------------------------
// The data, as the researcher would read it off the hand-solved example (SPEC.md § 6).
// ---------------------------------------------------------------------------------------------------------------
// experts in the order they are added: domain button (ج surgery, م engineering, ا ergonomics), years, activity
const EXPERTS = [
  ['ج', 12, 'بالینی'],
  ['ج', 7, 'بالینی'],
  ['م', 9, 'دانشگاهی'],
  ['ا', 15, 'دانشگاهی'],
  ['ج', 22, 'بالینی'],
  ['ج', 6, 'بالینی'],
  ['م', 11, 'صنعتی'],
  ['م', 8, 'پژوهشی'],
  ['ا', 14, 'دانشگاهی'],
  ['ا', 10, 'پژوهشی'],
];
const CODES = EXPERTS.map((_, i) => `E${String(i + 1).padStart(2, '0')}`);
const GROUPS = ['گروه ۱ (G1)', 'گروه ۲ (G2)', 'گروه ۳ (G3)'];
// [group index, name]; the app numbers them P01 … P06
const PARAMS = [
  [0, 'پارامتر یک'],
  [0, 'پارامتر دو'],
  [0, 'پارامتر سه'],
  [1, 'پارامتر چهار'],
  [1, 'پارامتر پنج'],
  [2, 'پارامتر شش'],
];
const PCODES = PARAMS.map((_, i) => `P${String(i + 1).padStart(2, '0')}`);
// ratings of P01 … P06 by E01 … E10 (both rounds); ? = «توانایی قضاوت ندارم», - = no answer
const RATINGS = [
  '9 8 7 7 8 9 7 5 2 ?',
  '9 8 7 7 8 9 7 5 2 4',
  '1 2 3 2 1 3 4 8 ? -',
  '9 8 9 7 8 9 7 8 9 8',
  '8 9 8 7 9 8 9 7 8 9',
  '9 9 9 9 9 9 9 1 1 4',
].map((s) => s.split(' '));
// round-2 point allocations: [groups G1 G2 G3], [P01 … P06]; E05–E10 skip the allocation
const ALLOC = {
  E01: [[50, 30, 20], [60, 20, 20, 50, 50, 100]],
  E02: [[40, 40, 20], [30, 30, 40, 80, 20, 100]],
  E03: [[20, 60, 20], [10, 40, 50, 25, 75, 100]],
  E04: [[30, 30, 30], [50, 50, 0, 40, 40, 100]],
};
const OPEN = { E01: [0, 'پیشنهاد: تهویه زیر پیش‌بند'], E03: [1, 'تهویه و خنک‌سازی'] };
const CONCEPTS = ['ساده‌ترین (مرجع اجرای اول)', 'کانسپت دو', 'کانسپت سه', 'کانسپت چهار', 'کانسپت پنج'];
const RATERS = ['پژوهشگر', 'استاد راهنما', 'استاد مشاور'];
const SCREEN_ROWS = ['P01', 'P02', 'P04', 'P05'];
// run 1 against C1: per row, the votes of raters 1, 2, 3
const RUN1 = {
  C2: ['++S', '+++', '+-S', '--+'],
  C3: ['SS+', '--S', 'SSS', '-S-'],
  C4: ['+++', '+S+', '++S', '---'],
  C5: ['+-S', 'SSS', 'SS+', 'S-S'],
};
// run 2 against the best concept of run 1 (C4); the three raters agree
const RUN2 = { C2: 'S+-S', C5: '-S-S', C1: '---+' };
const WCOLS = [
  ['P01', '0.6'],
  ['P02', '0.4'],
];
const WRATERS = ['E01', 'E02', 'E05', 'E03', 'E07', 'E04'];
// weighted matrix scores (1–5) of the raters in WRATERS order
const SCORES = {
  C2: { P01: '453344', P02: '233223' },
  C4: { P01: '334453', P02: '445434' },
  C1: { P01: '223232', P02: '545555' },
};

// ---------------------------------------------------------------------------------------------------------------
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? '  — ' + detail : ''}`);
};
/** Page text with Persian digits and separators turned into Latin ones, so expected values can be written plainly. */
const latin = (s) => s.replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).replace(/٫/g, '.').replace(/٪/g, '%');

(async () => {
  fs.mkdirSync(work, { recursive: true });
  const browser = await chromium.launch({ executablePath: exe });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, offline: true, acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  ctx.on('request', (r) => requests.push(r.url()));

  const nav = (i) => page.getByRole('navigation', { name: 'مراحل' }).getByRole('button').nth(i).click();
  const tab = (name) => page.getByRole('tab', { name, exact: true }).click();
  const main = async () => latin(await page.locator('main').innerText());
  const shot = (name) => page.screenshot({ path: path.join(work, name + '.png'), fullPage: true });
  /** Edits that may change computed results open a "what will change" dialog; accept it when it appears. */
  const settle = async () => {
    await page.waitForTimeout(120);
    const apply = page.getByRole('dialog').getByRole('button', { name: 'اعمال' });
    if (await apply.count()) await apply.first().click();
  };
  const expectText = async (name, values) => {
    const t = await main();
    const missing = values.filter((v) => !t.includes(v));
    check(name, missing.length === 0, missing.length ? 'not shown: ' + missing.join(', ') : values.join(' · '));
  };

  await page.goto(pathToFileURL(html).href);
  await page.getByRole('button', { name: 'پروژه جدید' }).click();

  // 1. project ---------------------------------------------------------------------------------------------------
  await page.getByLabel('عنوان پروژه').fill('آزمون ورود دستی — نمونه حل‌شده');

  // 2. experts: add, then type name, years and activity -------------------------------------------------------
  await nav(1);
  for (const [domain] of EXPERTS) await page.getByRole('button', { name: domain, exact: true }).click();
  // names are shown by default in the researcher's private list; turn them on if a previous session hid them
  if (await page.getByRole('button', { name: 'نمایش نام‌ها' }).count()) await page.getByRole('button', { name: 'نمایش نام‌ها' }).click();
  for (let i = 0; i < EXPERTS.length; i++) {
    await page.getByLabel('نام خبره', { exact: true }).nth(i).fill(`خبره آزمون شماره ${i + 1}`);
    await page.getByLabel('سال تجربه', { exact: true }).nth(i).fill(String(EXPERTS[i][1]));
    await page.getByLabel('نوع فعالیت', { exact: true }).nth(i).fill(EXPERTS[i][2]);
  }
  const codesShown = await page.getByLabel('کد خبره').evaluateAll((els) => els.map((e) => e.value));
  check('ten experts added with codes E01–E10', JSON.stringify(codesShown) === JSON.stringify(CODES), codesShown.join(' '));
  await shot('01-experts');

  // 3. semantic groups and parameters ---------------------------------------------------------------------------
  await nav(2);
  for (let i = 0; i < GROUPS.length; i++) await page.getByLabel('نام گروه').nth(i).fill(GROUPS[i]);
  while ((await page.getByLabel('نام گروه').count()) > GROUPS.length) {
    await page.getByRole('button', { name: 'حذف گروه' }).nth(GROUPS.length).click();
    await settle();
  }
  for (let i = 0; i < PARAMS.length; i++) {
    const [g, name] = PARAMS[i];
    await page.getByRole('button', { name: 'پارامتر', exact: true }).nth(g).click();
    await page.getByLabel('نام پارامتر').nth(i).fill(name);
    await page.getByLabel('الزام طراحی').nth(i).fill(`الزام طراحی ${name}`);
  }
  const pcodes = await page.getByLabel('کد', { exact: true }).evaluateAll((els) => els.map((e) => e.value));
  check('six parameters in three groups (P01–P06)', JSON.stringify(pcodes) === JSON.stringify(PCODES), pcodes.join(' '));
  await shot('02-params');

  // 4. round 1: manual grid, consent and open answers -----------------------------------------------------------
  const fillGrid = async () => {
    for (let pi = 0; pi < PCODES.length; pi++)
      for (let ei = 0; ei < CODES.length; ei++) {
        const v = RATINGS[pi][ei];
        if (v === '-') continue;
        await page.getByLabel(`${CODES[ei]} — ${PCODES[pi]}`, { exact: true }).fill(v === '?' ? '؟' : v);
      }
    for (const c of CODES) await page.getByLabel(`رضایت ${c}`).check();
  };
  await nav(3);
  await tab('ورود دستی');
  await fillGrid();
  for (const [code, [g, text]] of Object.entries(OPEN)) {
    const row = page.getByRole('row').filter({ has: page.getByLabel(`رضایت ${code}`) });
    await row.getByRole('button', { name: 'افزودن' }).click();
    await page.getByLabel(`پاسخ باز ${GROUPS[g]}`).fill(text);
    await page.getByRole('dialog').getByRole('button', { name: 'بستن' }).last().click();
  }
  await shot('03-round1-grid');

  // 5. round-1 analysis: code the open answers, merge synonyms, decide on the candidate --------------------------
  await nav(4);
  await tab('کدگذاری پاسخ‌های باز');
  const cand = ['تهویه زیر پیش‌بند', 'تهویه و خنک‌سازی'];
  for (const [i, [, text]] of Object.values(OPEN).entries()) {
    const card = page.locator('div.rounded-lg.border').filter({ hasText: text }).filter({ has: page.getByPlaceholder('نامزد تازه از این پاسخ') }).last();
    await card.getByPlaceholder('نامزد تازه از این پاسخ').fill(cand[i]);
    await card.getByRole('button', { name: 'افزودن', exact: true }).click();
  }
  await page.getByLabel('ادغام در').nth(1).selectOption({ label: cand[0] });
  await settle();
  await page.getByLabel('تصمیم', { exact: true }).first().selectOption('reject');
  await settle();
  await page.getByPlaceholder('دلیل تصمیم دستی (الزامی)').fill('نمونه حل‌شده: فهرست پارامترها ثابت می‌ماند');
  const t5 = await main();
  check('candidate support: 2 distinct experts, threshold 2 (F5)', /به آستانه رسید/.test(t5) && t5.includes('E01, E03'), '');
  await shot('04-coding');

  // 6. round 2: same grid plus the point allocations ------------------------------------------------------------
  await nav(5);
  await tab('ورود دستی');
  await fillGrid();
  for (const [code, [gp, pp]] of Object.entries(ALLOC)) {
    const row = page.getByRole('row').filter({ has: page.getByLabel(`رضایت ${code}`) });
    await row.getByRole('button', { name: 'افزودن' }).click();
    const dlg = page.getByRole('dialog');
    for (let g = 0; g < GROUPS.length; g++) await dlg.getByLabel(`امتیاز ${GROUPS[g]}`).fill(String(gp[g]));
    for (let k = 0; k < PCODES.length; k++) await dlg.getByLabel(`امتیاز ${PCODES[k]}`, { exact: true }).fill(String(pp[k]));
    await dlg.getByRole('button', { name: 'بستن' }).last().click();
  }
  await shot('05-round2-grid');

  // 7. consensus and weights (F1, F2) -------------------------------------------------------------------------------
  await nav(6);
  await page.waitForTimeout(200);
  const filterOptions = latin((await page.getByLabel('فیلتر وضعیت').evaluate((el) => [...el.options].map((o) => o.text).join(' | '))));
  check('consensus (F1): 4 retained, 1 removed, 1 without consensus', filterOptions.includes('حفظ (4)') && filterOptions.includes('حذف (1)') && filterOptions.includes('فاقد اجماع (1)'), filterOptions);
  await shot('06-consensus');
  let weightsText = '';
  for (const t of await page.getByRole('tab').allInnerTexts()) {
    await tab(t);
    await page.waitForTimeout(150);
    const txt = await main();
    if (txt.includes('0.2198') && !weightsText) {
      weightsText = txt;
      await shot('06-weights');
    }
  }
  for (const w of ['0.2198', '0.2177', '0.2438', '0.3188']) check(`final weight ${w} shown (F2)`, weightsText.includes(w));

  // 8. Pugh screening: concepts, datum, votes of three raters in two runs (F4) --------------------------------------
  await nav(7);
  for (let i = 0; i < CONCEPTS.length; i++) {
    await page.getByRole('button', { name: 'افزودن کانسپت' }).click();
    await page.getByLabel('نام', { exact: true }).nth(i).fill(CONCEPTS[i]);
  }
  const raterNames = await page.getByLabel('نام ارزیاب').evaluateAll((els) => els.map((e) => e.value));
  check('three screening raters', JSON.stringify(raterNames) === JSON.stringify(RATERS), raterNames.join('، '));
  await tab('اجرای اول');
  await page.getByLabel('مرجع اجرای اول').selectOption({ label: `C1 — ${CONCEPTS[0]}` });
  await settle();
  const SYM = { '+': 'بهتر', '-': 'بدتر', S: 'مشابه' };
  for (let r = 0; r < RATERS.length; r++) {
    await page.getByLabel('نمایش', { exact: true }).selectOption({ label: `آرای ${RATERS[r]}` });
    for (const [c, rows] of Object.entries(RUN1))
      for (let k = 0; k < SCREEN_ROWS.length; k++) await page.getByRole('radio', { name: `${c} — ${SCREEN_ROWS[k]}: ${SYM[rows[k][r]]}` }).click();
  }
  await page.getByLabel('نمایش', { exact: true }).selectOption({ label: 'نتیجه اکثریت' });
  const run1 = await main();
  check('run 1: best concept C4, C3 dominated', run1.includes('کانسپت برتر اجرای اول') && /:\s*C4/.test(run1) && run1.includes('مغلوب'));
  await shot('07-run1');
  await tab('اجرای دوم');
  for (let r = 0; r < RATERS.length; r++) {
    await page.getByLabel('نمایش', { exact: true }).selectOption({ label: `آرای ${RATERS[r]}` });
    for (const [c, s] of Object.entries(RUN2))
      for (let k = 0; k < SCREEN_ROWS.length; k++) await page.getByRole('radio', { name: `${c} — ${SCREEN_ROWS[k]}: ${SYM[s[k]]}` }).click();
  }
  await tab('نتیجه و راه‌یابی');
  const fwdRows = await page.getByRole('row').filter({ hasText: 'راه‌یافته' }).allInnerTexts();
  const fwd = fwdRows.map((t) => /C\d/.exec(t)?.[0]).sort().join(' ');
  check('forwarded to the weighted matrix: C1, C2, C4 (F4)', fwd === 'C1 C2 C4', fwd);
  await shot('08-screening-result');

  // 9. weighted Pugh matrix: columns and weights typed by hand, six raters score 1–5 (F3) ---------------------------
  await nav(8);
  for (const [code, w] of WCOLS) {
    await page.getByLabel('افزودن ستون').selectOption({ label: `${code} — ${PARAMS[PCODES.indexOf(code)][1]}` });
    await page.getByRole('button', { name: 'افزودن', exact: true }).click();
    await settle();
    const input = page.getByLabel(`وزن ${code}`);
    await input.fill(w);
    await input.press('Enter');
    await settle();
  }
  await tab('امتیازدهی');
  for (const c of CODES.filter((x) => !WRATERS.includes(x))) {
    await page.getByRole('checkbox', { name: new RegExp(c) }).uncheck();
    await settle();
  }
  for (let r = 0; r < WRATERS.length; r++) {
    const sel = page.getByLabel('امتیازدهنده', { exact: true });
    const label = await sel.evaluate((el, code) => [...el.options].find((o) => o.text.startsWith(code + ' '))?.text, WRATERS[r]);
    await sel.selectOption({ label });
    for (const [c, byP] of Object.entries(SCORES))
      for (const [pc, s] of Object.entries(byP)) await page.getByLabel(`${c} — ${pc}`, { exact: true }).fill(s[r]);
  }
  await shot('09-scoring');
  await tab('نتایج');
  await expectText('weighted scores 3.367 / 3.633 / 3.300 (F3)', ['3.367', '3.633', '3.300']);
  await shot('10-weighted-results');
  await tab('تحلیل حساسیت');
  await expectText('sensitivity: gap 0.267 < 0.40, break-even +133.3% and −57.1%', ['0.267', '+133.3%', '−57.1%']);
  await shot('11-sensitivity');

  // 10. outputs: project file, Excel, anonymity check -----------------------------------------------------------------
  await nav(9);
  const save = async (name) => {
    const [d] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name }).first().click()]);
    const f = path.join(work, d.suggestedFilename());
    await d.saveAs(f);
    return f;
  };
  const projectFile = await save(/فایل پروژه \(.json\)/);
  fs.copyFileSync(projectFile, path.join(work, 'manual-project.json'));
  const xlsx = await save(/دانلود Excel/);
  check('Excel workbook downloaded', fs.statSync(xlsx).size > 10000, path.basename(xlsx));
  await page.getByRole('button', { name: 'اجرای بررسی' }).click();
  await page.getByText('هیچ نام یا اطلاعات تماسی در خروجی‌ها پیدا نشد').waitFor({ timeout: 15000 }).catch(() => {});
  check('anonymity check: none of the typed names appears in any output', (await page.getByText('هیچ نام یا اطلاعات تماسی در خروجی‌ها پیدا نشد').count()) > 0);

  // 11. the other path of a candidate: accepted → new parameter → rated in round 2 ------------------------------------
  await nav(4);
  await tab('کدگذاری پاسخ‌های باز');
  await page.getByLabel('تصمیم', { exact: true }).first().selectOption('add');
  await settle();
  await page.getByRole('button', { name: 'ساخت پارامتر' }).first().click();
  const dlg = page.getByRole('dialog');
  await dlg.getByLabel('کد', { exact: true }).fill('P07');
  await dlg.getByLabel('نام پارامتر').fill(cand[0]);
  await dlg.getByRole('button', { name: 'ساخت پارامتر' }).click();
  await settle();
  await nav(5);
  await tab('ورود دستی');
  await page.getByLabel('E01 — P07', { exact: true }).fill('8');
  check('accepted candidate becomes P07 and can be rated in round 2', (await page.getByLabel('E01 — P07', { exact: true }).inputValue()) !== '');

  check('no page errors', errors.length === 0, errors.join(' | '));
  const external = requests.filter((u) => !/^(file|data|blob):/.test(u));
  check('no network requests', external.length === 0, external.slice(0, 3).join(' '));
  await browser.close();
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed. Files in ${work}`);
  process.exit(failed ? 1 : 0);
})().catch((e) => {
  console.error(e);
  process.exit(2);
});
