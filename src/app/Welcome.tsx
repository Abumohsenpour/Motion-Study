/** Start page: saved projects, new project, open a project file, load the demo. */
import { useEffect, useState } from 'react';
import { createProject } from '../core';
import { deleteProject, getDb, listProjects, loadProject, saveProject } from '../state/db';
import { lastProjectId } from '../state/prefs';
import { useStore } from '../state/store';
import { parseProjectJson } from '../io/projectFile';
import { confirmDialog, toast } from '../ui/dialogs';
import { Button, Callout, Card, FilePick, IconButton } from '../ui/kit';
import { useFmt } from '../ui/format';
import { buildDemoProject, buildWorkedExample } from '../demo/demoProject';

export async function openProject(project: ReturnType<typeof createProject>, identities = {}) {
  await saveProject(project, identities).catch(() => toast('ذخیره در مرورگر ممکن نشد؛ پیش از بستن، از پروژه خروجی JSON بگیرید.', { tone: 'bad' }));
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
    if (!r) return toast('پروژه پیدا نشد.', { tone: 'bad' });
    const { project } = parseProjectJson(JSON.stringify(r.project));
    lastProjectId.set(id);
    useStore.getState().open(project ?? r.project, r.identities);
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="text-2xl font-bold">ابزار پژوهش دلفی و ماتریس پیو</h1>
      <p className="mt-2 text-sm leading-7 text-muted">
        اجرای فاز تعریف (دلفی تعدیل‌شده دو دوری، اجماع و وزن‌دهی سلسله‌مراتبی) و فاز توسعه (غربال پیو و ماتریس پیو وزن‌دار) طبق طرح پژوهش. همه داده‌ها فقط روی همین رایانه و در مرورگر ذخیره می‌شوند؛ اینترنت لازم نیست.
      </p>
      {noDb && (
        <Callout tone="bad" className="mt-4" title="ذخیره‌سازی مرورگر در دسترس نیست">
          این مرورگر یا پنجره اجازه ذخیره در IndexedDB نمی‌دهد. می‌توانید کار کنید، ولی پیش از بستن صفحه حتماً از پروژه خروجی JSON بگیرید.
        </Callout>
      )}
      <div className="mt-6 flex flex-wrap gap-2">
        <Button variant="primary" icon="plus" onClick={() => openProject(createProject('پروژه پایان‌نامه'))}>
          پروژه جدید
        </Button>
        <FilePick
          accept=".json,application/json"
          onFiles={async ([f]) => {
            const { project, problem } = parseProjectJson(await f.text());
            if (!project) {
              toast(problem === 'newer-version' ? 'این فایل با نسخه جدیدتری از برنامه ساخته شده است.' : 'این فایل، فایل پروژه معتبر نیست.', { tone: 'bad' });
              return;
            }
            const exists = projects?.some((x) => x.id === project.id);
            if (exists) {
              const r = await confirmDialog({
                title: 'پروژه‌ای با همین شناسه در این رایانه هست',
                body: <p className="text-sm">فایل جایگزین نسخه ذخیره‌شده شود؟ (کلید هویت خبرگان دست نمی‌خورد.)</p>,
                confirmLabel: 'جایگزین شود',
                tone: 'danger',
              });
              if (!r.ok) return;
              const prev = await loadProject(project.id);
              return openProject(project, prev?.identities ?? {});
            }
            await openProject(project);
          }}
        >
          بازکردن فایل پروژه (.json)
        </FilePick>
        <Button icon="chart" onClick={() => {
            const d = buildDemoProject();
            openProject(d.project, d.identities);
          }}>
          پروژه نمونه کامل (۱۵ خبره، داده ساختگی)
        </Button>
        <Button
          icon="grid"
          onClick={() => {
            const d = buildWorkedExample();
            d.project.id = 'worked-' + Math.random().toString(36).slice(2, 8);
            openProject(d.project, d.identities);
          }}
        >
          نمونه حل‌شده دستی (اعداد SPEC)
        </Button>
      </div>

      <Card title="پروژه‌های ذخیره‌شده در این رایانه" className="mt-8">
        {projects === null ? null : projects.length === 0 ? (
          <p className="text-sm text-muted">هنوز پروژه‌ای ذخیره نشده است.</p>
        ) : (
          <ul className="divide-y divide-line">
            {projects.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 py-2">
                <button type="button" className="text-right hover:underline" onClick={() => open(p.id)}>
                  <span className="font-medium">{p.title}</span>
                  {p.id === lastProjectId.get() && <span className="ms-2 text-xs text-muted">(آخرین)</span>}
                  <span className="block text-xs text-muted">آخرین تغییر: {fmt.date(p.updatedAt)}</span>
                </button>
                <IconButton
                  icon="trash"
                  tone="danger"
                  label="حذف پروژه از این رایانه"
                  onClick={async () => {
                    const r = await confirmDialog({
                      title: `حذف «${p.title}» از این رایانه`,
                      body: <p className="text-sm">این کار برگشت‌پذیر نیست. اگر از پروژه و کلید هویت خروجی نگرفته‌اید، ابتدا آن را باز کنید و خروجی بگیرید.</p>,
                      confirmLabel: 'حذف کامل',
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
  );
}
