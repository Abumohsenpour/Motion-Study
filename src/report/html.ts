/**
 * Printable RTL HTML reports (thesis report, round-1 report, thank-you summary). Self-contained: the font is
 * embedded, nothing is loaded from the network, and the page saves cleanly to PDF via the browser's print dialog.
 * Tables and figures get numbered Persian captions; any caption can be edited (project.captions).
 */
import fontUrl from 'vazirmatn/fonts/webfonts/Vazirmatn[wght].woff2?inline';
import type { Fmt } from '../ui/format';

export const escapeHtml = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export type Cell = string | number | null | undefined | { html: string };

export interface CaptionInfo {
  key: string;
  kind: 'table' | 'figure';
  number: number;
  text: string;
  defaultText: string;
}

export class ReportBuilder {
  private parts: string[] = [];
  private tables = 0;
  private figures = 0;
  readonly captionsUsed: CaptionInfo[] = [];

  constructor(
    readonly fmt: Fmt,
    private captions: Record<string, string> = {},
  ) {}

  private caption(kind: 'table' | 'figure', key: string, defaultText: string): string {
    const number = kind === 'table' ? ++this.tables : ++this.figures;
    const text = this.captions[key]?.trim() || defaultText;
    this.captionsUsed.push({ key, kind, number, text, defaultText });
    return `${kind === 'table' ? 'جدول' : 'نمودار'} ${this.fmt.int(number)} – ${escapeHtml(text)}`;
  }

  /** Next table/figure number (for cross-references in text). */
  nextTable = () => this.tables + 1;
  nextFigure = () => this.figures + 1;

  raw(html: string) {
    this.parts.push(html);
    return this;
  }
  h1(t: string) {
    return this.raw(`<h1>${escapeHtml(t)}</h1>`);
  }
  h2(t: string) {
    return this.raw(`<h2>${escapeHtml(t)}</h2>`);
  }
  h3(t: string) {
    return this.raw(`<h3>${escapeHtml(t)}</h3>`);
  }
  p(t: string, cls = '') {
    return this.raw(`<p${cls ? ` class="${cls}"` : ''}>${escapeHtml(t)}</p>`);
  }
  note(t: string, tone: 'info' | 'warn' = 'info') {
    return this.raw(`<div class="note ${tone}">${escapeHtml(t)}</div>`);
  }
  list(items: string[]) {
    return this.raw(`<ul>${items.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ul>`);
  }

  cell(c: Cell): string {
    if (c === null || c === undefined) return '';
    if (typeof c === 'object') return c.html;
    return escapeHtml(c);
  }

  table(key: string, caption: string, head: Cell[], rows: Cell[][], opts: { small?: boolean; footnote?: string } = {}) {
    const cap = this.caption('table', key, caption);
    return this.raw(
      `<figure class="tbl${opts.small ? ' small' : ''}"><figcaption>${cap}</figcaption><table><thead><tr>${head
        .map((h) => `<th>${this.cell(h)}</th>`)
        .join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${this.cell(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>${
        opts.footnote ? `<div class="foot">${escapeHtml(opts.footnote)}</div>` : ''
      }</figure>`,
    );
  }

  figure(key: string, caption: string, svg: string) {
    const cap = this.caption('figure', key, caption);
    return this.raw(`<figure class="fig">${svg}<figcaption>${cap}</figcaption></figure>`);
  }

  document(title: string): string {
    return `<!doctype html>
<html lang="fa" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
@font-face{font-family:'Vazirmatn';src:url(${fontUrl}) format('woff2');font-weight:100 900}
${REPORT_CSS}
</style>
</head>
<body>
<div class="toolbar"><button onclick="window.print()">چاپ / ذخیره PDF</button></div>
<main>
${this.parts.join('\n')}
</main>
</body>
</html>`;
  }
}

export const REPORT_CSS = `
@page{size:A4;margin:18mm 16mm}
*{box-sizing:border-box}
body{margin:0;background:#f5f4f0;color:#1f2430;font-family:Vazirmatn,Tahoma,sans-serif;font-size:12.5px;line-height:1.75}
main{max-width:900px;margin:0 auto;background:#fff;padding:28px 36px 40px;border:1px solid #dcdad2}
h1{font-size:20px;margin:0 0 4px}
h2{font-size:16px;margin:26px 0 8px;padding-bottom:4px;border-bottom:1px solid #dcdad2}
h3{font-size:13.5px;margin:16px 0 6px}
p{margin:6px 0;text-align:justify}
.meta{color:#5d6475;font-size:12px}
.note{border-radius:6px;padding:6px 10px;margin:8px 0;font-size:12px}
.note.info{background:#eef2f8;border:1px solid #cdd8ea}
.note.warn{background:#fbf1dc;border:1px solid #ecd39b}
figure{margin:14px 0;break-inside:avoid}
figure.tbl{break-inside:auto}
figcaption{font-weight:700;font-size:12px;margin-bottom:4px}
figure.fig figcaption{text-align:center;margin-top:4px}
figure.fig svg{display:block;max-width:100%;height:auto;margin:0 auto}
table{border-collapse:collapse;width:100%;font-size:11.5px}
.small table{font-size:10.5px}
th,td{border:1px solid #cfccc3;padding:3px 5px;text-align:center;vertical-align:middle}
th{background:#f0efea;font-weight:700}
td.r,th.r{text-align:right}
thead{display:table-header-group}
tr{break-inside:avoid}
.foot{font-size:10.5px;color:#5d6475;margin-top:3px}
.ltr{direction:ltr;unicode-bidi:isolate}
.chip{display:inline-block;min-width:16px;padding:0 3px;border-radius:3px;color:#fff;font-weight:700;font-size:10px;text-align:center}
.ok{color:#2f6b45;font-weight:700}.bad{color:#9b2c2c;font-weight:700}.muted{color:#5d6475}
.toolbar{max-width:900px;margin:12px auto;text-align:left}
.toolbar button{font:inherit;padding:6px 14px;border-radius:6px;border:1px solid #34507a;background:#34507a;color:#fff;cursor:pointer}
@media print{body{background:#fff}main{border:0;padding:0;max-width:none}.toolbar{display:none}}
`;

/** Opens a report in a new tab (blob URL); falls back to a download if pop-ups are blocked. */
export function openReport(html: string, fallbackName: string, download: (text: string, name: string, mime: string) => void) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const w = window.open(url, '_blank');
  if (!w) download(html, fallbackName, 'text/html');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
