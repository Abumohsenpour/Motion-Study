/**
 * Names used in the charts, in either language.
 *
 * Project content (domains, groups, parameters, concepts, band labels) is typed in Persian. For the English
 * version of a chart the researcher can give each item an English label (Project.labelsEn, edited on the outputs
 * screen). Items without one fall back to a built-in translation of the default names, and otherwise to the
 * item's code alone (parameters, concepts) or its Persian name.
 */
import type { Id, Project } from '../core';
import type { Lang } from '../i18n';

/** English for the names a new project starts with. */
const DEFAULT_EN: Record<string, string> = {
  'جراحی درون‌عروقی': 'Surgery (endovascular)',
  'مهندسی (بیومکانیک/رباتیک/پزشکی)': 'Engineering',
  'ارگونومی و عوامل انسانی': 'Human factors & ergonomics',
  سینماتیک: 'Kinematics',
  دینامیک: 'Dynamics',
  ارگونومی: 'Ergonomics',
  'تنظیم‌پذیری': 'Adjustability',
  ایمنی: 'Safety',
  'کم‌اهمیت': 'Low importance',
  'مهم اما نه حیاتی': 'Important, not critical',
  حیاتی: 'Critical',
};

export const bandKey = (index: number): string => `band:${index}`;
export const shortKey = (domainId: Id): string => `short:${domainId}`;

export interface Labels {
  lang: Lang;
  domain: (id: Id) => string;
  domainShort: (id: Id) => string;
  group: (id: Id) => string;
  band: (index: number) => string;
  /** Parameter or concept name; empty in English when no English label was given (the code is always shown). */
  param: (id: Id) => string;
  concept: (id: Id) => string;
}

/** The English label stored for an item, or the built-in one for a default name. */
export function englishLabel(p: Project, key: string, fa: string): string | undefined {
  return p.labelsEn?.[key]?.trim() || DEFAULT_EN[fa.trim()];
}

export function chartLabels(p: Project, lang: Lang): Labels {
  const fa = lang === 'fa';
  const dom = (id: Id) => p.domains.find((d) => d.id === id);
  const named = (key: string, name: string) => (fa ? name : (englishLabel(p, key, name) ?? name));
  const coded = (key: string, name: string) => (fa ? name : (englishLabel(p, key, name) ?? ''));
  return {
    lang,
    domain: (id) => named(id, dom(id)?.name ?? ''),
    domainShort: (id) => {
      const d = dom(id);
      if (!d) return '';
      if (fa) return d.shortLabel;
      return p.labelsEn?.[shortKey(id)]?.trim() || (englishLabel(p, id, d.name)?.[0]?.toUpperCase() ?? d.shortLabel);
    },
    group: (id) => named(id, p.groups.find((g) => g.id === id)?.name ?? ''),
    band: (i) => named(bandKey(i), p.scale.bands[i]?.label ?? ''),
    param: (id) => coded(id, p.params.find((x) => x.id === id)?.name ?? ''),
    concept: (id) => coded(id, p.concepts.find((x) => x.id === id)?.name ?? ''),
  };
}
