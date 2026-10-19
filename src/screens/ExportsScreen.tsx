/**
 * Step 10 — outputs: Excel workbook (main output), CSVs, project and key files, the thesis report with editable
 * captions, charts (PNG/SVG), per-expert files and thank-you summaries, and an anonymity check of all outputs.
 */
import { useMemo, useState } from 'react';
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
import { useFmt } from '../ui/format';
import { Badge, Button, Callout, Card, PageTitle, TableWrap, TextInput, td, th } from '../ui/kit';
import { roundExperts } from './RoundScreen';
import { downloadAllQuestionnaires } from './rounds/files';

const base = (title: string) => safeFileName(title);

export function ExportsScreen() {
  const p = useProject();
  const fmt = useFmt();
  const identities = useStore((s) => s.identities);
  const [showCaptions, setShowCaptions] = useState(false);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const charts = useMemo(() => chartCatalog(p, fmt), [p, fmt]);
  const report = useMemo(() => (showCaptions ? thesisReport(p, fmt) : null), [p, fmt, showCaptions]);

  const excel = () => {
    try {
      downloadBlob(new Blob([workbookBytes(p) as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `${base(p.title)}_${stamp()}.xlsx`);
    } catch (e) {
      toast('ساخت فایل Excel ممکن نشد: ' + String(e), { tone: 'bad' });
    }
  };
  const csvZip = () => {
    const files = Object.fromEntries(Object.entries(sheetsAsCsv(p)).map(([k, v]) => [k, strToU8(v)]));
    downloadBlob(new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }), `${base(p.title)}_tables-csv_${stamp()}.zip`);
  };
  const thanksZip = () => {
    const files: Record<string, Uint8Array> = { 'thank-you_general.html': strToU8(thankYouHtml(p, fmt, null)) };
    for (const e of respondents(p, 'r1')) files[`${e.code}_thank-you.html`] = strToU8(thankYouHtml(p, fmt, e.id));
    downloadBlob(new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }), `thank-you_${stamp()}.zip`);
  };

  return (
    <div className="space-y-5">
      <PageTitle title="خروجی‌ها" subtitle="همه خروجی‌ها فقط کد خبرگان را دارند؛ نام‌ها تنها در فهرست خصوصی پژوهشگر و فایل کلید هویت جداگانه است." />

      <Card title="خروجی اصلی: کارپوشه Excel">
        <p className="mb-3 text-sm text-muted">
          برگه‌های راهنما، خبرگان (فقط کد)، پارامترها، توصیف پنل، پاسخ‌ها و نتایج دور اول، کدگذاری پاسخ‌های باز، پاسخ‌ها و اجماع دور دوم، توزیع امتیاز، وزن‌ها (روابط ۱ تا ۵ گام‌به‌گام)، تفهیم‌نامه طراحی، غربال اجرای اول و دوم، ماتریس وزن‌دار (روابط ۶ تا ۸)، تحلیل حساسیت و دفتر تغییرات. نتایج با فرمول‌های زنده Excel از داده‌های خام همان فایل دوباره محاسبه می‌شوند تا داور بتواند هر عدد را ردیابی کند.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" icon="download" onClick={excel}>
            دانلود Excel (.xlsx)
          </Button>
          <Button icon="download" onClick={csvZip}>
            همه جدول‌ها به‌صورت CSV (ZIP)
          </Button>
        </div>
      </Card>

      <Card title="فایل پروژه و کلید هویت">
        <div className="flex flex-wrap gap-2">
          <Button icon="download" onClick={() => downloadText(serializeProject(p), `${base(p.title)}_${stamp()}.json`)}>
            فایل پروژه (.json) — بدون نام‌ها
          </Button>
          <Button icon="download" onClick={() => downloadText(serializeIdentityKey(p, identities), `${base(p.title)}_identity-key_${stamp()}.json`)}>
            فایل کلید هویت (نام‌ها؛ جدا نگه دارید)
          </Button>
        </div>
      </Card>

      <Card
        title="گزارش پایان‌نامه (HTML قابل چاپ و ذخیره به PDF)"
        actions={
          <>
            <Button variant="primary" icon="print" onClick={() => openReport(thesisReport(p, fmt).html, 'thesis-report.html', downloadText)}>
              نمایش و چاپ
            </Button>
            <Button icon="download" onClick={() => downloadText(thesisReport(p, fmt).html, `${base(p.title)}_report_${stamp()}.html`, 'text/html')}>
              دانلود HTML
            </Button>
            <Button onClick={() => setShowCaptions(!showCaptions)}>{showCaptions ? 'بستن عنوان‌ها' : 'ویرایش عنوان جدول‌ها و نمودارها'}</Button>
          </>
        }
      >
        <p className="text-sm text-muted">همه جدول‌ها و نمودارها با شماره و عنوان فارسی، نمودارهای رنگی حوزه‌ها، خلاصه اجماع، وزن‌ها، تفهیم‌نامه، دو ماتریس غربال، ماتریس وزن‌دار و تحلیل حساسیت. در پنجره چاپ مرورگر «Save as PDF» را انتخاب کنید.</p>
        {report && (
          <TableWrap maxHeight="50vh">
            <table className="sticky-table mt-3 w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>شماره</th>
                  <th className={th}>عنوان</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {report.captions.map((c) => (
                  <tr key={c.key}>
                    <td className={td + ' whitespace-nowrap'}>
                      {c.kind === 'table' ? 'جدول' : 'نمودار'} {fmt.int(c.number)}
                    </td>
                    <td className={td}>
                      <TextInput value={p.captions[c.key] ?? c.defaultText} onChange={(v) => edit('عنوان جدول/نمودار', (d) => void (d.captions[c.key] = v))} aria-label="عنوان" />
                    </td>
                    <td className={td}>
                      {p.captions[c.key] && (
                        <Button size="sm" variant="ghost" onClick={() => edit('بازگشت عنوان به پیش‌فرض', (d) => void delete d.captions[c.key])}>
                          پیش‌فرض
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

      <Card title={`نمودارها (${fmt.int(charts.length)})`}>
        {charts.length === 0 ? (
          <p className="text-sm text-muted">هنوز داده‌ای برای نمودار نیست.</p>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {charts.map((c) => (
              <div key={c.key} className="rounded-lg border border-line p-2">
                <div className="mb-1 text-sm font-medium">{c.title}</div>
                <div className="max-h-48 overflow-hidden rounded bg-white" dangerouslySetInnerHTML={{ __html: c.svg.replace(/width="\d+" height="\d+"/, 'width="100%"') }} />
                <div className="mt-2 flex gap-2">
                  <Button size="sm" icon="download" onClick={() => downloadText(standaloneSvg(c.svg), `chart_${c.key}.svg`, 'image/svg+xml')}>
                    SVG
                  </Button>
                  <Button
                    size="sm"
                    icon="download"
                    onClick={async () => {
                      try {
                        downloadBlob(await svgToPng(c.svg), `chart_${c.key}.png`);
                      } catch {
                        toast('ساخت PNG ممکن نشد.', { tone: 'bad' });
                      }
                    }}
                  >
                    PNG
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="فایل‌های خبرگان">
        <div className="flex flex-wrap gap-2">
          <Button icon="download" disabled={!roundExperts(p, 'r1').length} onClick={() => downloadAllQuestionnaires(roundExperts(p, 'r1'), 'r1')}>
            پرسش‌نامه‌های دور اول (ZIP)
          </Button>
          <Button icon="download" disabled={!r2Invitees(p).length} onClick={() => downloadAllQuestionnaires(r2Invitees(p), 'r2')}>
            پرسش‌نامه‌های دور دوم (ZIP)
          </Button>
          <Button icon="download" disabled={!weightedRaterIds(p).length || !p.weighted.columns.length} onClick={() => downloadAllQuestionnaires(weightedRaterIds(p), 'pugh')}>
            فایل‌های امتیازدهی ماتریس وزن‌دار (ZIP)
          </Button>
          <Button icon="download" onClick={thanksZip}>
            خلاصه نتایج و تشکر برای خبرگان (ZIP)
          </Button>
          <Button icon="print" onClick={() => openReport(thankYouHtml(p, fmt, null), 'thank-you.html', downloadText)}>
            پیش‌نمایش خلاصه تشکر
          </Button>
        </div>
      </Card>

      <Card
        title="بررسی ناشناس‌بودن خروجی‌ها"
        actions={
          <Button
            onClick={() => {
              try {
                setScan(scanOutputsForNames(p, identities, fmt));
              } catch (e) {
                toast('بررسی ممکن نشد: ' + String(e), { tone: 'bad' });
              }
            }}
          >
            اجرای بررسی
          </Button>
        }
      >
        <p className="text-sm text-muted">همه خروجی‌ها (پروژه، Excel، CSV، گزارش‌ها، نمودارها، فایل‌های خبرگان و خلاصه تشکر) ساخته و برای نام، اطلاعات تماس و یادداشت هر خبره جست‌وجو می‌شوند.</p>
        {scan &&
          (scan.hits.length === 0 ? (
            <Callout tone="ok" className="mt-3" title="هیچ نام یا اطلاعات تماسی در خروجی‌ها پیدا نشد">
              {fmt.int(scan.outputs)} خروجی برای {fmt.int(scan.terms)} عبارت خصوصی بررسی شد.
              {scan.terms === 0 && ' (هنوز نام یا اطلاعات تماسی ثبت نشده است.)'}
            </Callout>
          ) : (
            <Callout tone="bad" className="mt-3" title={`${fmt.int(scan.hits.length)} مورد پیدا شد`}>
              <ul className="list-disc ps-5">
                {scan.hits.slice(0, 20).map((h, i) => (
                  <li key={i}>
                    {h.output}: <Badge tone="bad">{h.term}</Badge>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-xs">معمولاً یعنی نام در متنی آزاد (مثلاً متن پاسخ باز یا عنوان) نوشته شده است؛ آن را ویرایش کنید.</p>
            </Callout>
          ))}
      </Card>
    </div>
  );
}
