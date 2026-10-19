/**
 * Editing with a preview: for edits that can affect data already entered, the edit is first applied to a
 * copy, the dependent results are recomputed, and the differences are shown before anything changes
 * (build request § 0.4, DECISIONS D-57). Deletions offer an undo toast.
 */
import { produce, type Draft } from 'immer';
import { dataCollectionStarted, describeImpact, type Impact, type Project } from '../core';
import { useStore } from '../state/store';
import { confirmDialog, toast } from '../ui/dialogs';
import { makeFmt } from '../ui/format';
import { usePrefs } from '../state/prefs';

const statusFa: Record<string, string> = { retain: 'حفظ', remove: 'حذف', none: 'فاقد اجماع' };

export function impactText(i: Impact, prev: Project, next: Project): string {
  const fmt = makeFmt(usePrefs.getState().digits);
  const pcode = (id: string) => (next.params.find((x) => x.id === id) ?? prev.params.find((x) => x.id === id))?.code ?? id;
  const ccode = (id: string) => (next.concepts.find((x) => x.id === id) ?? prev.concepts.find((x) => x.id === id))?.code ?? id;
  const round = (r: 'r1' | 'r2') => (r === 'r1' ? 'دور اول' : 'دور دوم');
  switch (i.kind) {
    case 'respondents':
      return `تعداد پاسخ‌دهندگان ${round(i.round)}: ${fmt.int(i.from)} ← ${fmt.int(i.to)}`;
    case 'invalid-ratings':
      return `پاسخ‌های خارج از مقیاس در ${round(i.round)}: ${fmt.int(i.from)} ← ${fmt.int(i.to)} (این پاسخ‌ها حذف نمی‌شوند ولی نامعتبر شمرده می‌شوند)`;
    case 'responses-removed':
      return `${fmt.int(i.count)} پاسخ‌نامه ${round(i.round)} حذف می‌شود`;
    case 'consensus':
      return `وضعیت اجماع ${pcode(i.paramId)}: ${statusFa[i.from]} ← ${statusFa[i.to]}`;
    case 'weight':
      return `وزن ${pcode(i.paramId)}: ${fmt.num(i.from, 4)} ← ${fmt.num(i.to, 4)}`;
    case 'candidate':
      return `پارامتر نامزد «${next.candidates.find((c) => c.id === i.candidateId)?.label ?? ''}»: ${i.from ? 'افزوده می‌شد' : 'افزوده نمی‌شد'} ← ${i.to ? 'افزوده می‌شود' : 'افزوده نمی‌شود'}`;
    case 'forwarded':
      return `کانسپت‌های راه‌یافته به ماتریس وزن‌دار: ${i.from.map(ccode).join('، ') || '—'} ← ${i.to.map(ccode).join('، ') || '—'}`;
    case 'ranking':
      return `رتبه‌بندی کانسپت‌ها: ${i.from.map(ccode).join(' > ') || '—'} ← ${i.to.map(ccode).join(' > ') || '—'}`;
    case 'scores-removed':
      return `${fmt.int(i.count)} امتیاز ماتریس وزن‌دار حذف می‌شود`;
  }
}

export interface EditOptions {
  /** Recompute dependents and show what changes before applying (only once data exists). */
  preview?: boolean;
  /** Always ask, with these lines (e.g. deleting something). */
  confirm?: { title: string; items?: string[]; confirmLabel?: string };
  /** Show an undo toast after applying. */
  undoToast?: string;
  detail?: string;
}

/** Applies an edit, asking first when it would change results that depend on entered data. */
export async function edit(label: string, recipe: (d: Draft<Project>) => void, opts: EditOptions = {}): Promise<boolean> {
  const s = useStore.getState();
  const prev = s.project;
  if (!prev) return false;
  const hasData = dataCollectionStarted(prev);
  if ((opts.preview && hasData) || opts.confirm) {
    const next = produce(prev, recipe);
    if (next === prev) return false;
    const impacts = opts.preview && hasData ? describeImpact(prev, next) : [];
    if (impacts.length > 0 || opts.confirm) {
      const items = [...(opts.confirm?.items ?? []), ...impacts.map((i) => impactText(i, prev, next))];
      const res = await confirmDialog({
        title: opts.confirm?.title ?? 'این تغییر روی نتایج محاسبه‌شده اثر می‌گذارد',
        body: impacts.length ? <span className="text-sm text-muted">پس از اعمال، همه نتایج وابسته دوباره محاسبه می‌شوند:</span> : undefined,
        items,
        askReason: hasData,
        confirmLabel: opts.confirm?.confirmLabel,
        tone: opts.confirm ? 'danger' : 'normal',
      });
      if (!res.ok) return false;
      s.apply(label, recipe, { reason: res.reason, detail: [opts.detail, ...items].filter(Boolean).join(' | ') });
      if (opts.undoToast) toast(opts.undoToast, { action: { label: 'بازگردانی', run: () => useStore.getState().undo() } });
      return true;
    }
  }
  s.apply(label, recipe, { detail: opts.detail });
  if (opts.undoToast) toast(opts.undoToast, { action: { label: 'بازگردانی', run: () => useStore.getState().undo() } });
  return true;
}
