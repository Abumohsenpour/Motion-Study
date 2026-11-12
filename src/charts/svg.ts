/**
 * Small SVG drawing surface shared by every figure.
 *
 * Figures are laid out once in "logical" coordinates (x grows from the reading start) and drawn mirrored for the
 * Persian version, so the Persian (right-to-left) and English (left-to-right) versions of a chart come from the
 * same code and always show the same thing.
 */
import type { Lang } from '../i18n';

export const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
export const truncate = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

/** Colours of the figures (fixed, light background: figures are made for print and slides). */
export const THEME = {
  surface: '#ffffff',
  ink: '#171a2e',
  muted: '#5a6079',
  faint: '#8b90a6',
  grid: '#e3e6f0',
  track: '#f1f2f8',
  brand: '#4a3fd6',
  brandSoft: '#b9b4f2',
  ok: '#1c7448',
  bad: '#b02525',
  neutral: '#6b7088',
  overall: '#3a3f58',
};

type Anchor = 'start' | 'middle' | 'end';
interface TextOpts {
  size?: number;
  weight?: number;
  fill?: string;
  anchor?: Anchor;
  opacity?: number;
  /** Latin codes and numbers keep left-to-right order inside a right-to-left figure. */
  ltr?: boolean;
}

/** Rough text width (px) for layout decisions such as legends and "does the label fit inside the bar". */
export const textWidth = (s: string, size = 12) => s.length * size * 0.56;

export class Canvas {
  private out: string[] = [];
  readonly rtl: boolean;
  constructor(
    readonly lang: Lang,
    readonly W: number,
  ) {
    this.rtl = lang === 'fa';
  }

  /** Physical x of a logical x. */
  px(x: number): number {
    return this.rtl ? this.W - x : x;
  }

  text(x: number, y: number, s: string, o: TextOpts = {}): void {
    const dir = o.ltr ? 'ltr' : this.rtl ? 'rtl' : 'ltr';
    // text-anchor is relative to the text's own direction, so a left-to-right run inside a mirrored figure swaps it
    const anchor: Anchor = o.anchor ?? 'start';
    const a = o.ltr && this.rtl ? ({ start: 'end', end: 'start', middle: 'middle' } as const)[anchor] : anchor;
    this.out.push(
      `<text x="${this.px(x).toFixed(1)}" y="${y.toFixed(1)}" direction="${dir}" text-anchor="${a}" font-size="${o.size ?? 12}"${o.weight ? ` font-weight="${o.weight}"` : ''} fill="${o.fill ?? THEME.ink}"${o.opacity !== undefined ? ` fill-opacity="${o.opacity}"` : ''}>${esc(s)}</text>`,
    );
  }

  rect(x: number, y: number, w: number, h: number, o: { fill?: string; opacity?: number; rx?: number; stroke?: string; dash?: string; title?: string } = {}): void {
    if (w <= 0 || h <= 0) return;
    const X = this.rtl ? this.W - x - w : x;
    this.out.push(
      `<rect x="${X.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"${o.rx ? ` rx="${o.rx}"` : ''} fill="${o.fill ?? 'none'}"${o.opacity !== undefined ? ` fill-opacity="${o.opacity.toFixed(2)}"` : ''}${o.stroke ? ` stroke="${o.stroke}"` : ''}${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}>${o.title ? `<title>${esc(o.title)}</title>` : ''}</rect>`,
    );
  }

  line(x1: number, y1: number, x2: number, y2: number, o: { stroke?: string; width?: number; dash?: string; opacity?: number; cap?: boolean } = {}): void {
    this.out.push(
      `<line x1="${this.px(x1).toFixed(1)}" y1="${y1.toFixed(1)}" x2="${this.px(x2).toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${o.stroke ?? THEME.grid}" stroke-width="${o.width ?? 1}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ''}${o.opacity !== undefined ? ` stroke-opacity="${o.opacity}"` : ''}${o.cap ? ' stroke-linecap="round"' : ''}/>`,
    );
  }

  circle(x: number, y: number, r: number, o: { fill?: string; stroke?: string; width?: number; title?: string } = {}): void {
    this.out.push(
      `<circle cx="${this.px(x).toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${o.fill ?? 'none'}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.width ?? 1.5}"` : ''}>${o.title ? `<title>${esc(o.title)}</title>` : ''}</circle>`,
    );
  }

  /** Small rounded label with white text (domain marks, rank numbers). */
  chip(x: number, y: number, w: number, h: number, label: string, fill: string): void {
    this.rect(x, y, w, h, { fill, rx: 4 });
    this.out.push(
      `<text x="${(this.rtl ? this.W - x - w / 2 : x + w / 2).toFixed(1)}" y="${(y + h / 2 + 0.5).toFixed(1)}" text-anchor="middle" dominant-baseline="middle" font-size="${Math.min(10, h - 4)}" font-weight="700" fill="#fff">${esc(label)}</text>`,
    );
  }

  svg(H: number, label: string): string {
    return `<svg xmlns="http://www.w3.org/2000/svg" style="direction:ltr" viewBox="0 0 ${this.W} ${Math.ceil(H)}" width="${this.W}" height="${Math.ceil(H)}" font-family="Vazirmatn, Tahoma, sans-serif" role="img" aria-label="${esc(label)}"><rect width="${this.W}" height="${Math.ceil(H)}" fill="${THEME.surface}"/>${this.out.join('')}</svg>`;
  }
}

/** Title and optional subtitle at the top of a figure; returns the y where the content starts. */
export function heading(c: Canvas, pad: number, title?: string, subtitle?: string): number {
  let y = pad;
  if (title) {
    c.text(pad, y + 12, title, { size: 15, weight: 700 });
    y += 24;
  }
  if (subtitle) {
    c.text(pad, y + 8, subtitle, { size: 11, fill: THEME.muted });
    y += 20;
  }
  return y + (title || subtitle ? 6 : 0);
}
