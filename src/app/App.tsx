/** Top-level layout: welcome screen when no project is open, otherwise sidebar + step screen. */
import { useEffect, useMemo } from 'react';
import { useNav } from './nav';
import { useStore } from '../state/store';
import { usePrefs } from '../state/prefs';
import { ConfirmHost, ToastHost } from '../ui/dialogs';
import { IconButton, cx, useUndoKeys } from '../ui/kit';
import { BRAND, LangSwitch, LogoMark, ThemeSwitch, Wordmark } from '../ui/brand';
import { t } from '../i18n';
import { Icon } from '../ui/icons';
import { useFmt } from '../ui/format';
import { STEPS, stepState, type StepId, type StepStatus } from './steps';
import { Welcome } from './Welcome';
import { ProjectScreen } from '../screens/ProjectScreen';
import { ExpertsScreen } from '../screens/ExpertsScreen';
import { ParamsScreen } from '../screens/ParamsScreen';
import { Round1Screen, Round2Screen } from '../screens/RoundScreen';
import { Analysis1Screen } from '../screens/Analysis1Screen';
import { WeightsScreen } from '../screens/WeightsScreen';
import { ScreeningScreen } from '../screens/ScreeningScreen';
import { WeightedScreen } from '../screens/WeightedScreen';
import { ExportsScreen } from '../screens/ExportsScreen';

const SCREENS: Record<StepId, () => React.JSX.Element> = {
  project: ProjectScreen,
  experts: ExpertsScreen,
  params: ParamsScreen,
  round1: Round1Screen,
  analysis1: Analysis1Screen,
  round2: Round2Screen,
  weights: WeightsScreen,
  screening: ScreeningScreen,
  weighted: WeightedScreen,
  exports: ExportsScreen,
};

const statusLabel: Record<StepStatus, string> = { 'not-started': 'شروع نشده', 'in-progress': 'در جریان', complete: 'کامل' };

/** Step number in a circle whose style shows the step's status (with the status also written below the title). */
function StepDot({ n, status, active }: { n: string; status: StepStatus; active: boolean }) {
  return (
    <span
      className={cx(
        'mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
        status === 'complete' && 'bg-emerald-400/90 text-[#0b2a1c]',
        status === 'in-progress' && 'border-2 border-amber-300 text-amber-200',
        status === 'not-started' && (active ? 'border border-rail-ink/70 text-rail-ink' : 'border border-rail-muted/50 text-rail-muted'),
      )}
    >
      {status === 'complete' ? <Icon name="check" className="size-3.5" /> : n}
    </span>
  );
}

function Sidebar() {
  const project = useStore((s) => s.project)!;
  const { step, go } = useNav();
  const fmt = useFmt();
  const states = useMemo(() => Object.fromEntries(STEPS.map((s) => [s.id, stepState(project, s.id)])), [project]);
  const partTitle = { setup: 'آماده‌سازی', A: 'بخش الف — دلفی (فاز تعریف)', B: 'بخش ب — انتخاب کانسپت (فاز توسعه)', out: 'پایان' } as const;
  const done = STEPS.filter((s) => s.id !== 'exports' && states[s.id].status === 'complete').length;
  return (
    <aside className="no-print sticky top-0 flex h-screen w-72 shrink-0 flex-col bg-rail text-rail-ink">
      <div className="flex items-center gap-2.5 px-5 pt-5 pb-4">
        <LogoMark className="size-9" />
        <Wordmark light />
      </div>
      <div className="mx-4 mb-3 rounded-xl bg-rail-2 px-3.5 py-3">
        <div className="text-[11px] text-rail-muted">{t('پروژه')}</div>
        <div className="mt-0.5 text-sm leading-6 font-semibold" dir="auto">
          {project.title}
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-rail" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length - 1} aria-valuenow={done} aria-label={t('پیشرفت مراحل')}>
          <div className="brand-gradient h-full rounded-full transition-all" style={{ width: `${(100 * done) / (STEPS.length - 1)}%` }} />
        </div>
        <div className="mt-1 text-[11px] text-rail-muted">{t('{a} از {b} مرحله کامل شده', { a: fmt.int(done), b: fmt.int(STEPS.length - 1) })}</div>
      </div>
      <nav aria-label={t('مراحل')} className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        <ol className="space-y-0.5">
          {STEPS.map((s, i) => {
            const st = states[s.id];
            const showPart = i === 0 || STEPS[i - 1].part !== s.part;
            const active = step === s.id;
            return (
              <li key={s.id}>
                {showPart && <div className="mt-3.5 mb-1 px-2.5 text-[10.5px] font-semibold tracking-wide text-rail-muted uppercase">{t(partTitle[s.part])}</div>}
                <button
                  type="button"
                  onClick={() => go(s.id)}
                  aria-current={active ? 'step' : undefined}
                  className={cx(
                    'relative flex w-full items-start gap-2.5 rounded-xl px-2.5 py-1.5 text-start text-sm transition-colors',
                    active ? 'bg-rail-2 font-semibold text-rail-ink' : 'text-rail-ink/85 hover:bg-rail-2/60',
                  )}
                >
                  {active && <span className="brand-gradient absolute inset-y-2 start-0 w-1 rounded-full" />}
                  <StepDot n={fmt.int(i + 1)} status={s.id === 'exports' ? 'not-started' : st.status} active={active} />
                  <span className="min-w-0 flex-1">
                    <span className="block leading-6">{t(s.title)}</span>
                    {s.id !== 'exports' && (
                      <span className="flex flex-wrap items-center gap-x-2 text-[11px] font-normal text-rail-muted">
                        <span>{t(statusLabel[st.status])}</span>
                        {st.warnings.length > 0 && (
                          <span className="inline-flex items-center gap-0.5 text-amber-300" title={st.warnings.map(fmt.digits).join('\n')}>
                            <Icon name="alert" className="size-3" />
                            {t('{n} هشدار', { n: fmt.int(st.warnings.length) })}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>
      <div className="border-t border-white/10 px-5 py-3 text-[11px] text-rail-muted">
        <span dir="ltr">
          {BRAND.name} {BRAND.version}
        </span>{' '}
        · {t('آفلاین؛ داده‌ها فقط روی همین رایانه')}
      </div>
    </aside>
  );
}

function Header() {
  const { saveStatus, past, future, undo, redo, close } = useStore();
  const { digits, setDigits, lang } = usePrefs();
  const step = useNav((s) => s.step);
  const fmt = useFmt();
  const index = STEPS.findIndex((s) => s.id === step);
  const saveText = { idle: '', saving: 'در حال ذخیره…', saved: 'ذخیره شد', error: 'خطا در ذخیره — از پروژه خروجی JSON بگیرید' }[saveStatus];
  return (
    <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-bg/85 px-8 py-2.5 backdrop-blur">
      <div className="flex min-w-0 items-center gap-3 text-xs text-muted">
        <span className="whitespace-nowrap">{t('مرحله {a} از {b}', { a: fmt.int(index + 1), b: fmt.int(STEPS.length) })}</span>
        <span className="h-4 w-px bg-line" />
        <span className={cx('inline-flex items-center gap-1.5', saveStatus === 'error' && 'text-bad')} role="status">
          {saveStatus === 'saved' && <span className="size-1.5 rounded-full bg-ok" />}
          {saveText && t(saveText)}
        </span>
      </div>
      <div className="flex items-center gap-1">
        <IconButton icon="undo" label={t('بازگردانی (Ctrl+Z)') + (past.length ? '' : ' — ' + t('موردی نیست'))} onClick={undo} disabled={!past.length} />
        <IconButton icon="redo" label={t('انجام دوباره (Ctrl+Y)')} onClick={redo} disabled={!future.length} />
        <span className="mx-1.5 h-5 w-px bg-line" />
        {lang === 'fa' && (
          <button
            type="button"
            onClick={() => setDigits(digits === 'fa' ? 'latin' : 'fa')}
            className="rounded-lg px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink"
            title={t('نمایش ارقام فارسی یا لاتین')}
          >
            {digits === 'fa' ? '۱۲۳ → 123' : '123 → ۱۲۳'}
          </button>
        )}
        <LangSwitch className="mx-1" />
        <ThemeSwitch />
        <IconButton icon="folder" label={t('بستن پروژه و بازگشت به صفحه آغاز')} onClick={close} className="size-8" />
      </div>
    </header>
  );
}

export function App() {
  const project = useStore((s) => s.project);
  const theme = usePrefs((s) => s.theme);
  const lang = usePrefs((s) => s.lang);
  const step = useNav((s) => s.step);
  const { undo, redo } = useStore.getState();
  useUndoKeys(undo, redo);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
    document.title = lang === 'fa' ? `${BRAND.name} — ${BRAND.nameFa}` : BRAND.name;
  }, [lang]);

  const Screen = SCREENS[step];
  // key={lang}: the whole interface is re-mounted when the language changes, so every t() call is evaluated again
  return (
    <div key={lang}>
      {!project ? (
        <Welcome />
      ) : (
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <Header />
            <main className="mx-auto max-w-[1400px] px-8 py-7">
              <Screen key={project.id + step} />
            </main>
          </div>
        </div>
      )}
      <ConfirmHost />
      <ToastHost />
    </div>
  );
}
