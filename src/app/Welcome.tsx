/** Start page: saved projects, new project, open a project file, load the demo. */
import { useEffect, useState } from 'react';
import { createProject } from '../core';
import { deleteProject, getDb, listProjects, loadProject, saveProject } from '../state/db';
import { lastProjectId } from '../state/prefs';
import { useStore } from '../state/store';
import { parseProjectJson } from '../io/projectFile';
import { confirmDialog, toast } from '../ui/dialogs';
import { Button, Callout, Card, FilePick, IconButton } from '../ui/kit';
import { BRAND, LangSwitch, LogoMark, ThemeSwitch } from '../ui/brand';
import { Icon, type IconName } from '../ui/icons';
import { t } from '../i18n';
import { useFmt } from '../ui/format';
import { buildDemoProject, buildWorkedExample } from '../demo/demoProject';

export async function openProject(project: ReturnType<typeof createProject>, identities = {}) {
  await saveProject(project, identities).catch(() => toast(t('ذخیره در مرورگر ممکن نشد؛ پیش از بستن، از پروژه خروجی JSON بگیرید.'), { tone: 'bad' }));
  lastProjectId.set(project.id);
  useStore.getState().open(project, identities);
}

export function Welcome() {
  const fmt = useFmt();
  const [projects, setProjects] = useState<{ id: string; title: string; updatedAt: string }[] | null>(null);
  const noDb = !getDb();

  const refresh = () => listProjects().then(setProjects).catch(() => setProjects([]));
  useEffect(() => {
    refresh();
  }, []);

  const open = async (id: string) => {
    const r = await loadProject(id);
    if (!r) return toast(t('پروژه پیدا نشد.'), { tone: 'bad' });
    const { project } = parseProjectJson(JSON.stringify(r.project));
    lastProjectId.set(id);
    useStore.getState().open(project ?? r.project, r.identities);
  };

  const openFile = async ([f]: File[]) => {
    const { project, problem } = parseProjectJson(await f.text());
    if (!project) {
      toast(t(problem === 'newer-version' ? 'این فایل با نسخه جدیدتری از برنامه ساخته شده است.' : 'این فایل، فایل پروژه معتبر نیست.'), { tone: 'bad' });
      return;
    }
    if (projects?.some((x) => x.id === project.id)) {
      const r = await confirmDialog({
        title: t('پروژه‌ای با همین شناسه در این رایانه هست'),
        body: <p className="text-sm">{t('فایل جایگزین نسخه ذخیره‌شده شود؟ (کلید هویت خبرگان دست نمی‌خورد.)')}</p>,
        confirmLabel: t('جایگزین شود'),
        tone: 'danger',
      });
      if (!r.ok) return;
      const prev = await loadProject(project.id);
      return openProject(project, prev?.identities ?? {});
    }
    await openProject(project);
  };
  // the two samples are rebuilt on every click, so changes made while rehearsing never carry into a presentation
  const openDemo = () => {
    const d = buildDemoProject();
    d.project.title = t('نمونه حل‌شده و امتیازدهی‌شده (داده فرضی)');
    openProject(d.project, d.identities);
  };
  const openWorked = () => {
    const d = buildWorkedExample();
    d.project.id = 'worked-' + Math.random().toString(36).slice(2, 8);
    d.project.title = t('نمونه حل‌شده دستی (اعداد SPEC.md بخش ۶)');
    openProject(d.project, d.identities);
  };
  const phases: { icon: IconName; title: string; text: string }[] = [
    { icon: 'grid', title: 'بخش الف — دلفی', text: 'دو دور پرسش‌نامه، بازخورد کنترل‌شده، معیار اجماع ازپیش‌تعیین‌شده و وزن‌دهی سلسله‌مراتبی (روابط ۱ تا ۵).' },
    { icon: 'chart', title: 'بخش ب — ماتریس پیو', text: 'غربال کانسپت‌ها در دو اجرا، ماتریس وزن‌دار با امتیاز خبرگان و تحلیل حساسیت (روابط ۶ تا ۸).' },
    { icon: 'file', title: 'خروجی آماده پایان‌نامه', text: 'کارپوشه Excel با فرمول زنده، گزارش قابل چاپ، نمودارهای فارسی و انگلیسی و فایل‌های خبرگان.' },
  ];

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-8 py-5">
        <span className="inline-flex items-center gap-2.5">
          <LogoMark className="size-9" />
          <span className="text-lg font-extrabold tracking-[0.18em]" dir="ltr">
            {BRAND.name}
          </span>
        </span>
        <span className="inline-flex items-center gap-2">
          <LangSwitch />
          <ThemeSwitch />
        </span>
      </header>

      <main className="mx-auto max-w-6xl px-8 pb-16">
        <section className="relative overflow-hidden rounded-3xl bg-rail px-10 py-12 text-rail-ink">
          <div className="brand-gradient pointer-events-none absolute -end-24 -top-24 size-80 rounded-full opacity-30 blur-3xl" />
          <div className="brand-gradient pointer-events-none absolute -bottom-32 start-1/3 size-72 rounded-full opacity-20 blur-3xl" />
          <div className="relative max-w-3xl">
            <div className="text-sm font-medium text-rail-muted">{t('کورتکس — میز کار پژوهش دلفی و ماتریس پیو')}</div>
            <h1 className="mt-3 text-4xl leading-[1.35] font-extrabold tracking-tight">{t('از نظر خبرگان تا انتخاب کانسپت، در یک مسیر شفاف و قابل ردیابی')}</h1>
            <p className="mt-4 text-[15px] leading-8 text-rail-ink/80">
              {t('اجرای فاز تعریف (دلفی تعدیل‌شده دو دوری، اجماع و وزن‌دهی سلسله‌مراتبی) و فاز توسعه (غربال پیو و ماتریس پیو وزن‌دار) طبق طرح پژوهش. همه داده‌ها فقط روی همین رایانه و در مرورگر ذخیره می‌شوند؛ اینترنت لازم نیست.')}
            </p>
            <div className="mt-7 flex flex-wrap gap-2.5">
              <Button variant="primary" icon="plus" className="!px-5 !py-2.5 !text-[15px]" onClick={() => openProject(createProject(t('پروژه پایان‌نامه')))}>
                {t('پروژه جدید')}
              </Button>
              <FilePick accept=".json,application/json" onFiles={openFile}>
                {t('بازکردن فایل پروژه')} <span className="ltr">(.json)</span>
              </FilePick>
            </div>
          </div>
        </section>

        {noDb && (
          <Callout tone="bad" className="mt-5" title={t('ذخیره‌سازی مرورگر در دسترس نیست')}>
            {t('این مرورگر یا پنجره اجازه ذخیره در IndexedDB نمی‌دهد. می‌توانید کار کنید، ولی پیش از بستن صفحه حتماً از پروژه خروجی JSON بگیرید.')}
          </Callout>
        )}

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {phases.map((ph) => (
            <div key={ph.title} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
              <span className="inline-flex size-9 items-center justify-center rounded-xl bg-accent-soft text-accent">
                <Icon name={ph.icon} className="size-5" />
              </span>
              <div className="mt-3 font-bold">{t(ph.title)}</div>
              <p className="mt-1 text-sm leading-7 text-muted">{t(ph.text)}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
          <Card title={t('نمونه‌های حل‌شده')}>
            <div className="space-y-4">
              <div>
                <Button icon="chart" onClick={openDemo}>
                  {t('نمونه حل‌شده و امتیازدهی‌شده (۱۵ خبره، داده فرضی)')}
                </Button>
                <p className="mt-1.5 text-sm leading-7 text-muted">
                  {t('هر ده مرحله با داده فرضی درباره اگزواسکلتون پشتیبان پیش‌بند سربی تکمیل شده است: دو دور دلفی با پاسخ‌های باز و پارامتر نامزد، اجماع، وزن‌های سلسله‌مراتبی، غربال پیو در دو اجرا، ماتریس پیو وزن‌دار با امتیاز خبرگان و تحلیل حساسیت. برای نمایش روش، مثلاً در جلسه دفاع از پروپوزال.')}
                </p>
              </div>
              <div>
                <Button icon="grid" onClick={openWorked}>
                  {t('نمونه حل‌شده دستی (اعداد SPEC)')}
                </Button>
                <p className="mt-1.5 text-sm leading-7 text-muted">{t('نمونه کوچکی که همه اعداد آن پیش‌تر با دست محاسبه شده‌اند (SPEC.md بخش ۶)؛ برای نشان‌دادن درستی محاسبات برنامه.')}</p>
              </div>
            </div>
          </Card>

          <Card title={t('پروژه‌های ذخیره‌شده در این رایانه')}>
            {projects === null ? null : projects.length === 0 ? (
              <p className="text-sm text-muted">{t('هنوز پروژه‌ای ذخیره نشده است.')}</p>
            ) : (
              <ul className="divide-y divide-line">
                {projects.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-2 py-2.5">
                    <button type="button" className="min-w-0 text-start hover:text-accent" onClick={() => open(p.id)}>
                      <span className="font-medium" dir="auto">
                        {p.title}
                      </span>
                      {p.id === lastProjectId.get() && <span className="ms-2 text-xs text-muted">{t('(آخرین)')}</span>}
                      <span className="block text-xs text-muted">{t('آخرین تغییر: {d}', { d: fmt.date(p.updatedAt) })}</span>
                    </button>
                    <IconButton
                      icon="trash"
                      tone="danger"
                      label={t('حذف پروژه از این رایانه')}
                      onClick={async () => {
                        const r = await confirmDialog({
                          title: t('حذف «{title}» از این رایانه', { title: p.title }),
                          body: <p className="text-sm">{t('این کار برگشت‌پذیر نیست. اگر از پروژه و کلید هویت خروجی نگرفته‌اید، ابتدا آن را باز کنید و خروجی بگیرید.')}</p>,
                          confirmLabel: t('حذف کامل'),
                          tone: 'danger',
                        });
                        if (r.ok) {
                          await deleteProject(p.id);
                          refresh();
                        }
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
}
