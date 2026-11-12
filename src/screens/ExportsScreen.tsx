/**
 * Step 10 — outputs: Excel workbook (main output), CSVs, project and key files, the thesis report with editable
 * captions, charts (PNG/SVG), per-expert files and thank-you summaries, and an anonymity check of all outputs.
 */
import { useMemo, useState } from 'react';
import { t, type Lang } from '../i18n';
import { usePrefs } from '../state/prefs';
import { bandKey, englishLabel, shortKey } from '../charts/labels';
import { Modal } from '../ui/dialogs';
import { strToU8, zipSync } from 'fflate';
import { r2Invitees, respondents, weightedRaterIds } from '../core';
import { edit } from '../app/edit';
import { chartCatalog, standaloneSvg, svgToPng } from '../charts/catalog';
import { downloadBlob, downloadText, safeFileName, stamp } from '../io/download';
import { sheetsAsCsv, workbookBytes } from '../io/excel';
import { scanOutputsForNames, type ScanResult } from '../io/nameScan';
import { serializeIdentityKey, serializeProject } from '../io/projectFile';
import { openReport } from '../report/html';
import { thesisReport } from '../report/thesisReport';
import { thankYouHtml } from '../report/thankYou';
import { useProject, useStore } from '../state/store';
import { toast } from '../ui/dialogs';
import { makeFmt, useFmt } from '../ui/format';
import { Badge, Button, Callout, Card, PageTitle, TableWrap, TextInput, cx, td, th } from '../ui/kit';
import { roundExperts } from './RoundScreen';
import { downloadAllQuestionnaires } from './rounds/files';

const base = (title: string) => safeFileName(title);

/** English names for the English version of the charts (project content itself stays as typed). */
function EnglishLabelsDialog({ onClose }: { onClose: () => void }) {
  const p = useProject();
  const sections: { title: string; rows: { key: string; code?: string; fa: string }[] }[] = [
    { title: 'حوزه‌ها', rows: p.domains.flatMap((d) => [{ key: d.id, fa: d.name }, { key: shortKey(d.id), fa: t('برچسب کوتاه «{s}»', { s: d.shortLabel }) }]) },
    { title: 'طبقه‌های مقیاس', rows: p.scale.bands.map((b, i) => ({ key: bandKey(i), fa: b.label })) },
    { title: 'گروه‌های معنایی', rows: p.groups.map((g) => ({ key: g.id, fa: g.name })) },
    { title: 'پارامترها', rows: p.params.map((x) => ({ key: x.id, code: x.code, fa: x.name })) },
    { title: 'کانسپت‌ها', rows: p.concepts.map((x) => ({ key: x.id, code: x.code, fa: x.name })) },
  ];
  return (
    <Modal open wide title={t('برچسب‌های انگلیسی نمودارها')} onClose={onClose} footer={<Button onClick={onClose}>{t('بستن')}</Button>}>
      <p className="mb-3 text-sm text-muted">{t('اختیاری است و فقط در نسخه انگلیسی نمودارها به کار می‌رود. خانه خالی: برای نام‌های پیش‌فرض ترجمه آماده، و برای پارامترها و کانسپت‌ها فقط کد نمایش داده می‌شود.')}</p>
      <div className="space-y-4">
        {sections
          .filter((s) => s.rows.length)
          .map((s) => (
            <div key={s.title}>
              <div className="mb-1.5 text-[13px] font-bold">{t(s.title)}</div>
              <div className="grid gap-1.5">
                {s.rows.map((r) => (
                  <label key={r.key} className="grid grid-cols-[4rem_1fr_1fr] items-center gap-2 text-sm">
                    <span className="ltr text-xs text-muted">{r.code}</span>
                    <span dir="auto">{r.fa}</span>
                    <TextInput
                      ltr
                      value={p.labelsEn[r.key] ?? ''}
                      placeholder={englishLabel({ ...p, labelsEn: {} }, r.key, r.fa) ?? ''}
                      onChange={(v) => edit('برچسب انگلیسی نمودار', (d) => void (v.trim() ? (d.labelsEn[r.key] = v) : delete d.labelsEn[r.key]))}
                      aria-label={`English — ${r.code ?? r.fa}`}
                    />
                  </label>
                ))}
              </div>
            </div>
          ))}
      </div>
    </Modal>
  );
}

export function ExportsScreen() {
  const p = useProject();
  const fmt = useFmt();
  const identities = useStore((s) => s.identities);
  const [showCaptions, setShowCaptions] = useState(false);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const uiLang = usePrefs((s) => s.lang);
  const digits = usePrefs((s) => s.digits);
  // charts can be exported in either language, whatever the language of the interface
  const [chartLang, setChartLang] = useState<Lang>(uiLang);
  const [labels, setLabels] = useState(false);
  const charts = useMemo(() => chartCatalog(p, makeFmt(chartLang === 'en' ? 'latin' : digits, chartLang), chartLang), [p, chartLang, digits]);
  const report = useMemo(() => (showCaptions ? thesisReport(p, fmt) : null), [p, fmt, showCaptions]);

  const excel = () => {
    try {
      downloadBlob(new Blob([workbookBytes(p) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base(p.title)}_${stamp()}.xlsx`);
    } catch (e) {
      toast(t('ساخت فایل Excel ممکن نشد: ') + String(e), { tone: 'bad' });
    }
  };
  const csvZip = () => {
    const files = Object.fromEntries(Object.entries(sheetsAsCsv(p)).map(([k, v]) => [k, strToU8(v)]));
    downloadBlob(new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }), `${base(p.title)}_tables-csv_${stamp()}.zip`);
  };
  // every chart in both languages, as SVG (vector) and PNG
  const chartsZip = async () => {
    try {
      const files: Record<string, Uint8Array> = {};
      for (const lang of ['fa', 'en'] as const) {
        for (const c of chartCatalog(p, makeFmt(lang === 'en' ? 'latin' : digits, lang), lang)) {
          files[`${lang}/chart_${c.key}_${lang}.svg`] = strToU8(standaloneSvg(c.svg));
          files[`${lang}/chart_${c.key}_${lang}.png`] = new Uint8Array(await (await svgToPng(c.svg)).arrayBuffer());
        }
      }
      downloadBlob(new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }), `${base(p.title)}_charts_${stamp()}.zip`);
    } catch {
      toast(t('ساخت PNG ممکن نشد.'), { tone: 'bad' });
    }
  };
  const thanksZip = () => {
    const files: Record<string, Uint8Array> = { 'thank-you_general.html': strToU8(thankYouHtml(p, fmt, null)) };
    for (const e of respondents(p, 'r1')) files[`${e.code}_thank-you.html`] = strToU8(thankYouHtml(p, fmt, e.id));
    downloadBlob(new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }), `thank-you_${stamp()}.zip`);
  };

  return (
    <div className="space-y-5">
      <PageTitle title={t('خروجی‌ها')} subtitle={t('همه خروجی‌ها فقط کد خبرگان را دارند؛ نام‌ها تنها در فهرست خصوصی پژوهشگر و فایل کلید هویت جداگانه است.')} />

      <Card title={t('خروجی اصلی: کارپوشه Excel')}>
        <p className="mb-3 text-sm text-muted">
          {t('برگه‌های راهنما، خبرگان (فقط کد)، پارامترها، توصیف پنل، پاسخ‌ها و نتایج دور اول، کدگذاری پاسخ‌های باز، پاسخ‌ها و اجماع دور دوم، توزیع امتیاز، وزن‌ها (روابط ۱ تا ۵ گام‌به‌گام)، تفهیم‌نامه طراحی، غربال اجرای اول و دوم، ماتریس وزن‌دار (روابط ۶ تا ۸)، تحلیل حساسیت و دفتر تغییرات. نتایج با فرمول‌های زنده Excel از داده‌های خام همان فایل دوباره محاسبه می‌شوند تا داور بتواند هر عدد را ردیابی کند.')}{' '}
          {uiLang === 'en' && t('کارپوشه و گزارش به فارسی ساخته می‌شوند.')}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon="download" onClick={excel}>
            {t('دانلود Excel')} <span className="ltr">(.xlsx)</span>
          </Button>
          <Button icon="download" onClick={csvZip}>
            {t('همه جدول‌ها به‌صورت CSV (ZIP)')}
          </Button>
        </div>
      </Card>

      <Card title={t('فایل پروژه و کلید هویت')}>
        <div className="flex flex-wrap gap-2">
          <Button icon="download" onClick={() => downloadText(serializeProject(p), `${base(p.title)}_${stamp()}.json`)}>
            {t('فایل پروژه')} <span className="ltr">(.json)</span> — {t('بدون نام‌ها')}
          </Button>
          <Button icon="download" onClick={() => downloadText(serializeIdentityKey(p, identities), `${base(p.title)}_identity-key_${stamp()}.json`)}>
            {t('فایل کلید هویت (نام‌ها؛ جدا نگه دارید)')}
          </Button>
        </div>
      </Card>

      <Card
        title={t('گزارش پایان‌نامه (HTML قابل چاپ و ذخیره به PDF)')}
        actions={
          <>
            <Button variant="primary" icon="print" onClick={() => openReport(thesisReport(p, fmt).html, 'thesis-report.html', downloadText)}>
              {t('نمایش و چاپ')}
            </Button>
            <Button icon="download" onClick={() => downloadText(thesisReport(p, fmt).html, `${base(p.title)}_report_${stamp()}.html`, 'text/html')}>
              {t('دانلود HTML')}
            </Button>
            <Button onClick={() => setShowCaptions(!showCaptions)}>{t(showCaptions ? 'بستن عنوان‌ها' : 'ویرایش عنوان جدول‌ها و نمودارها')}</Button>
          </>
        }
      >
        <p className="text-sm text-muted">{t('همه جدول‌ها و نمودارها با شماره و عنوان فارسی، نمودارهای رنگی حوزه‌ها، خلاصه اجماع، وزن‌ها، تفهیم‌نامه، دو ماتریس غربال، ماتریس وزن‌دار و تحلیل حساسیت. در پنجره چاپ مرورگر «Save as PDF» را انتخاب کنید.')}</p>
        {report && (
          <TableWrap maxHeight="50vh">
            <table className="sticky-table mt-3 w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>{t('شماره')}</th>
                  <th className={th}>{t('عنوان')}</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {report.captions.map((c) => (
                  <tr key={c.key}>
                    <td className={td + ' whitespace-nowrap'}>
                      {t(c.kind === 'table' ? 'جدول' : 'نمودار')} {fmt.int(c.number)}
                    </td>
                    <td className={td}>
                      <TextInput value={p.captions[c.key] ?? c.defaultText} onChange={(v) => edit('عنوان جدول/نمودار', (d) => void (d.captions[c.key] = v))} aria-label={t('عنوان')} />
                    </td>
                    <td className={td}>
                      {p.captions[c.key] && (
                        <Button size="sm" variant="ghost" onClick={() => edit('بازگشت عنوان به پیش‌فرض', (d) => void delete d.captions[c.key])}>
                          {t('پیش‌فرض')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>

      <Card
        title={t('نمودارها ({n})', { n: fmt.int(charts.length) })}
        actions={
          <>
            <span className="text-xs text-muted">{t('زبان نمودارها:')}</span>
            <span className="inline-flex overflow-hidden rounded-lg border border-line text-xs" role="group" aria-label={t('زبان نمودارها:')}>
              {(['fa', 'en'] as const).map((l) => (
                <button key={l} type="button" aria-pressed={chartLang === l} onClick={() => setChartLang(l)} className={cx('px-2.5 py-1 font-medium', chartLang === l ? 'bg-accent text-accent-ink' : 'bg-surface text-muted hover:bg-surface-2')}>
                  {l === 'fa' ? 'فارسی' : 'English'}
                </button>
              ))}
            </span>
            <Button size="sm" onClick={() => setLabels(true)}>
              {t('برچسب‌های انگلیسی نمودارها')}
            </Button>
            <Button size="sm" icon="download" disabled={!charts.length} onClick={chartsZip}>
              {t('همه نمودارها (فارسی و انگلیسی، ZIP)')}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">{t('هر نمودار در دو نسخه فارسی و انگلیسی از همان داده‌ها ساخته می‌شود. در نسخه انگلیسی، نام پارامترها و کانسپت‌ها از «برچسب‌های انگلیسی نمودارها» خوانده می‌شود؛ اگر برچسبی ننوشته باشید فقط کد نمایش داده می‌شود.')}</p>
        {charts.length === 0 ? (
          <p className="text-sm text-muted">{t('هنوز داده‌ای برای نمودار نیست.')}</p>
        ) : (
          <div className="grid gap-4 xl:grid-cols-2">
            {charts.map((c) => (
              <figure key={c.key} className="overflow-hidden rounded-xl border border-line">
                <div className="max-h-80 overflow-y-auto bg-white" dangerouslySetInnerHTML={{ __html: c.svg.replace(/width="\d+" height="\d+"/, 'width="100%"') }} />
                <figcaption className="flex items-center justify-between gap-2 border-t border-line bg-surface-2/60 px-3 py-2">
                  <span className="min-w-0 truncate text-[13px] font-medium" dir="auto">
                    {c.title}
                  </span>
                  <span className="flex shrink-0 gap-1.5">
                    <Button size="sm" icon="download" onClick={() => downloadText(standaloneSvg(c.svg), `chart_${c.key}_${chartLang}.svg`, 'image/svg+xml')}>
                      SVG
                    </Button>
                    <Button
                      size="sm"
                      icon="download"
                      onClick={async () => {
                        try {
                          downloadBlob(await svgToPng(c.svg), `chart_${c.key}_${chartLang}.png`);
                        } catch {
                          toast(t('ساخت PNG ممکن نشد.'), { tone: 'bad' });
                        }
                      }}
                    >
                      PNG
                    </Button>
                  </span>
                </figcaption>
              </figure>
            ))}
          </div>
        )}
      </Card>

      <Card title={t('فایل‌های خبرگان')}>
        <div className="flex flex-wrap gap-2">
          <Button icon="download" disabled={!roundExperts(p, 'r1').length} onClick={() => downloadAllQuestionnaires(roundExperts(p, 'r1'), 'r1')}>
            {t('پرسش‌نامه‌های دور اول (ZIP)')}
          </Button>
          <Button icon="download" disabled={!r2Invitees(p).length} onClick={() => downloadAllQuestionnaires(r2Invitees(p), 'r2')}>
            {t('پرسش‌نامه‌های دور دوم (ZIP)')}
          </Button>
          <Button icon="download" disabled={!weightedRaterIds(p).length || !p.weighted.columns.length} onClick={() => downloadAllQuestionnaires(weightedRaterIds(p), 'pugh')}>
            {t('فایل‌های امتیازدهی ماتریس وزن‌دار (ZIP)')}
          </Button>
          <Button icon="download" onClick={thanksZip}>
            {t('خلاصه نتایج و تشکر برای خبرگان (ZIP)')}
          </Button>
          <Button icon="print" onClick={() => openReport(thankYouHtml(p, fmt, null), 'thank-you.html', downloadText)}>
            {t('پیش‌نمایش خلاصه تشکر')}
          </Button>
        </div>
      </Card>

      <Card
        title={t('بررسی ناشناس‌بودن خروجی‌ها')}
        actions={
          <Button
            onClick={() => {
              try {
                setScan(scanOutputsForNames(p, identities, fmt));
              } catch (e) {
                toast(t('بررسی ممکن نشد: ') + String(e), { tone: 'bad' });
              }
            }}
          >
            {t('اجرای بررسی')}
          </Button>
        }
      >
        <p className="text-sm text-muted">{t('همه خروجی‌ها (پروژه، Excel، CSV، گزارش‌ها، نمودارها، فایل‌های خبرگان و خلاصه تشکر) ساخته و برای نام، اطلاعات تماس و یادداشت هر خبره جست‌وجو می‌شوند.')}</p>
        {scan &&
          (scan.hits.length === 0 ? (
            <Callout tone="ok" className="mt-3" title={t('هیچ نام یا اطلاعات تماسی در خروجی‌ها پیدا نشد')}>
              {t('{a} خروجی برای {b} عبارت خصوصی بررسی شد.', { a: fmt.int(scan.outputs), b: fmt.int(scan.terms) })}
              {scan.terms === 0 && ' ' + t('(هنوز نام یا اطلاعات تماسی ثبت نشده است.)')}
            </Callout>
          ) : (
            <Callout tone="bad" className="mt-3" title={t('{n} مورد پیدا شد', { n: fmt.int(scan.hits.length) })}>
              <ul className="list-disc ps-5">
                {scan.hits.slice(0, 20).map((h, i) => (
                  <li key={i}>
                    {h.output}: <Badge tone="bad">{h.term}</Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs">{t('معمولاً یعنی نام در متنی آزاد (مثلاً متن پاسخ باز یا عنوان) نوشته شده است؛ آن را ویرایش کنید.')}</p>
            </Callout>
          ))}
      </Card>
      {labels && <EnglishLabelsDialog onClose={() => setLabels(false)} />}
    </div>
  );
}
