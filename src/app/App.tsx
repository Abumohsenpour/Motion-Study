/** Top-level layout: welcome screen when no project is open, otherwise sidebar + step screen. */
import { useEffect, useMemo } from 'react';
import { create } from 'zustand';
import { useStore } from '../state/store';
import { usePrefs } from '../state/prefs';
import { ConfirmHost, ToastHost } from '../ui/dialogs';
import { Badge, IconButton, cx, useUndoKeys } from '../ui/kit';
import { Icon } from '../ui/icons';
import { useFmt } from '../ui/format';
import { STEPS, stepState, type StepId, type StepStatus } from './steps';
import { Welcome } from './Welcome';
import { ProjectScreen } from '../screens/ProjectScreen';
import { ExpertsScreen } from '../screens/ExpertsScreen';
import { ParamsScreen } from '../screens/ParamsScreen';

function Placeholder() {
  return <div className="text-muted">این بخش در مرحله بعد ساخته می‌شود.</div>;
}

export const useNav = create<{ step: StepId; go: (s: StepId) => void }>((set) => ({
  step: 'project',
  go: (step) => {
    set({ step });
    window.scrollTo({ top: 0 });
  },
}));

const SCREENS: Partial<Record<StepId, () => React.JSX.Element>> = {
  project: ProjectScreen,
  experts: ExpertsScreen,
  params: ParamsScreen,
};

const statusLabel: Record<StepStatus, string> = { 'not-started': 'شروع نشده', 'in-progress': 'در جریان', complete: 'کامل' };

function StatusBadge({ status }: { status: StepStatus }) {
  return (
    <Badge tone={status === 'complete' ? 'ok' : status === 'in-progress' ? 'warn' : 'neutral'} className="text-[11px]">
      {status === 'complete' && <Icon name="check" className="size-3" />}
      {statusLabel[status]}
    </Badge>
  );
}

function Sidebar() {
  const project = useStore((s) => s.project)!;
  const { step, go } = useNav();
  const fmt = useFmt();
  const states = useMemo(() => Object.fromEntries(STEPS.map((s) => [s.id, stepState(project, s.id)])), [project]);
  const partTitle = { setup: 'آماده‌سازی', A: 'بخش الف — دلفی (فاز تعریف)', B: 'بخش ب — انتخاب کانسپت (فاز توسعه)', out: '' } as const;
  return (
    <nav aria-label="مراحل" className="no-print sticky top-0 h-screen w-64 shrink-0 overflow-y-auto border-l border-line bg-surface px-3 py-4">
      <div className="mb-4 px-2 text-sm font-bold leading-6">{project.title}</div>
      <ol className="space-y-0.5">
        {STEPS.map((s, i) => {
          const st = states[s.id];
          const showPart = i === 0 || STEPS[i - 1].part !== s.part;
          return (
            <li key={s.id}>
              {showPart && partTitle[s.part] && <div className="mt-3 mb-1 px-2 text-[11px] font-semibold text-muted">{partTitle[s.part]}</div>}
              <button
                type="button"
                onClick={() => go(s.id)}
                aria-current={step === s.id ? 'step' : undefined}
                className={cx(
                  'flex w-full items-start gap-2 rounded-lg px-2 py-1.5 text-right text-sm',
                  step === s.id ? 'bg-accent-soft font-semibold text-ink' : 'text-ink hover:bg-surface-2',
                )}
              >
                <span className="mt-0.5 w-4 shrink-0 text-xs text-muted">{fmt.int(i + 1)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block">{s.title}</span>
                  {s.id !== 'exports' && (
                    <span className="mt-0.5 flex flex-wrap items-center gap-1">
                      <StatusBadge status={st.status} />
                      {st.warnings.length > 0 && (
                        <span className="inline-flex items-center gap-0.5 text-[11px] text-warn" title={st.warnings.join('\n')}>
                          <Icon name="alert" className="size-3" />
                          {fmt.int(st.warnings.length)} هشدار
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
  );
}

function Header() {
  const { saveStatus, past, future, undo, redo, close } = useStore();
  const { digits, setDigits, theme, setTheme } = usePrefs();
  const saveText = { idle: '', saving: 'در حال ذخیره…', saved: 'ذخیره شد', error: 'خطا در ذخیره — از پروژه خروجی JSON بگیرید' }[saveStatus];
  return (
    <header className="no-print sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-line bg-bg/90 px-6 py-2 backdrop-blur">
      <span className={cx('text-xs', saveStatus === 'error' ? 'text-bad' : 'text-muted')} role="status">
        {saveText}
      </span>
      <div className="flex items-center gap-1">
        <IconButton icon="undo" label={`بازگردانی (Ctrl+Z)${past.length ? '' : ' — موردی نیست'}`} onClick={undo} disabled={!past.length} />
        <IconButton icon="redo" label="انجام دوباره (Ctrl+Y)" onClick={redo} disabled={!future.length} />
        <span className="mx-1 h-5 w-px bg-line" />
        <button
          type="button"
          onClick={() => setDigits(digits === 'fa' ? 'latin' : 'fa')}
          className="rounded-md px-2 py-1 text-xs text-muted hover:bg-surface-2 hover:text-ink"
          title="نمایش ارقام فارسی یا لاتین"
        >
          {digits === 'fa' ? '۱۲۳ → 123' : '123 → ۱۲۳'}
        </button>
        <IconButton icon={theme === 'dark' ? 'sun' : 'moon'} label={theme === 'dark' ? 'زمینه روشن' : 'زمینه تیره'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
        <IconButton icon="folder" label="بستن پروژه و بازگشت به صفحه آغاز" onClick={close} />
      </div>
    </header>
  );
}

export function App() {
  const project = useStore((s) => s.project);
  const theme = usePrefs((s) => s.theme);
  const step = useNav((s) => s.step);
  const { undo, redo } = useStore.getState();
  useUndoKeys(undo, redo);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  const Screen = SCREENS[step] ?? Placeholder;
  return (
    <>
      {!project ? (
        <Welcome />
      ) : (
        <div className="flex min-h-screen">
          <Sidebar />
          <div className="min-w-0 flex-1">
            <Header />
            <main className="mx-auto max-w-[1400px] px-6 py-6">
              <Screen key={project.id + step} />
            </main>
          </div>
        </div>
      )}
      <ConfirmHost />
      <ToastHost />
    </>
  );
}
