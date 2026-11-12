/**
 * CORTEX (کورتکس) brand: the mark, the wordmark and the language / theme switches shared by the start page and the
 * project header. The mark is three nested arcs — the layers of a cortex, and the narrowing rounds of a Delphi
 * study — with a single node where they converge.
 */
import { BRAND, LOGO_SVG } from '../shared/brand';
import { usePrefs } from '../state/prefs';
import { t } from '../i18n';
import { Icon } from './icons';
import { cx } from './kit';

export { BRAND, LOGO_SVG };

export function LogoMark({ className = 'size-9' }: { className?: string }) {
  return <span className={cx('inline-block shrink-0 [&>svg]:size-full', className)} aria-hidden="true" dangerouslySetInnerHTML={{ __html: LOGO_SVG }} />;
}

export function Wordmark({ light, className }: { light?: boolean; className?: string }) {
  return (
    <span className={cx('inline-flex items-baseline gap-2 leading-none', className)}>
      <span className={cx('text-lg font-extrabold tracking-[0.18em]', light ? 'text-rail-ink' : 'text-ink')} dir="ltr">
        {BRAND.name}
      </span>
      <span className={cx('text-[13px] font-medium', light ? 'text-rail-muted' : 'text-muted')}>{BRAND.nameFa}</span>
    </span>
  );
}

/** فارسی | English switch. Changing the language re-mounts the interface (see App). */
export function LangSwitch({ className }: { className?: string }) {
  const { lang, setLang } = usePrefs();
  return (
    <span className={cx('inline-flex overflow-hidden rounded-lg border border-line bg-surface text-xs', className)} role="group" aria-label="Language / زبان">
      {(['fa', 'en'] as const).map((l) => (
        <button
          key={l}
          type="button"
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={cx('px-2.5 py-1 font-medium transition-colors', lang === l ? 'bg-accent text-accent-ink' : 'text-muted hover:bg-surface-2 hover:text-ink')}
        >
          {l === 'fa' ? 'فارسی' : 'English'}
        </button>
      ))}
    </span>
  );
}

export function ThemeSwitch() {
  const { theme, setTheme } = usePrefs();
  return (
    <button
      type="button"
      title={t(theme === 'dark' ? 'زمینه روشن' : 'زمینه تیره')}
      aria-label={t(theme === 'dark' ? 'زمینه روشن' : 'زمینه تیره')}
      onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
      className="inline-flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-2 hover:text-ink"
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}
