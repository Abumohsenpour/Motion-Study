/**
 * Two-language interface (Persian / English).
 *
 * The Persian text stays in the code as the source; `t('متن فارسی')` returns it unchanged in Persian mode and looks
 * up its English equivalent (src/i18n/en/*.ts) in English mode. Placeholders in braces are filled from `vars`:
 *   t('{n} خبره هنوز پاسخ نداده‌اند.', { n: 3 })
 * A text without an English entry is shown in Persian (i18n.test.ts fails for any such text found in the code).
 *
 * Only the software's own interface is translated. Project content typed by the researcher (parameter names,
 * domain names, consent text …) is shown as entered, and the expert questionnaires and reports stay Persian.
 */
import { usePrefs, type Lang } from '../state/prefs';
import { EN } from './en';

export type { Lang };
export type Vars = Record<string, string | number>;

/** A key may carry a context after a bar ('حذف|status') when one Persian word needs two English ones; the context is never shown. */
const bare = (fa: string) => fa.replace(/\|[a-z]+$/, '');

const fill = (s: string, vars?: Vars) => (vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s);

/** Translation for an explicit language (used by the charts, which can be exported in either language). */
export function tr(lang: Lang, fa: string, vars?: Vars): string {
  return fill(lang === 'en' ? (EN[fa] ?? bare(fa)) : bare(fa), vars);
}

/** Translation for the current interface language. The whole interface is re-mounted when the language changes. */
export function t(fa: string, vars?: Vars): string {
  return tr(usePrefs.getState().lang, fa, vars);
}

/** Consensus status of a parameter («حذف» here is "remove", not the "delete" of buttons). */
export const statusLabel = (status: 'retain' | 'remove' | 'none', lang: Lang = usePrefs.getState().lang): string =>
  tr(lang, { retain: 'حفظ|status', remove: 'حذف|status', none: 'فاقد اجماع' }[status]);

export const currentLang = (): Lang => usePrefs.getState().lang;
export const isRtl = (): boolean => usePrefs.getState().lang === 'fa';
