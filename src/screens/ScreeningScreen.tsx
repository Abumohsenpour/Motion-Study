/**
 * Step 8 — concepts and the unweighted Pugh screening (+ / − / S) in two runs, with the research team's majority
 * vote, the dominance rule, forwarding to the weighted matrix, and manual overrides with reasons.
 */
import { useState } from 'react';
import { majoritySymbol, newId, screeningAnalysis, screeningParamIds, type Concept, type Id, type PughSymbol, type ScreeningRun } from '../core';
import { edit } from '../app/edit';
import { useNav } from '../app/nav';
import { t } from '../i18n';
import { REASON_FA } from './screeningReasons';
import { useProject } from '../state/store';
import { Modal, toast } from '../ui/dialogs';
import { useFmt } from '../ui/format';
import { Badge, Button, Callout, Card, Checkbox, Empty, Field, FilePick, IconButton, PageTitle, Reorder, Select, TableWrap, Tabs, TextArea, TextInput, cx, td, th } from '../ui/kit';

const move = <T,>(arr: T[], i: number, j: number) => {
  const [x] = arr.splice(i, 1);
  arr.splice(j, 0, x);
};


const SYM: Record<PughSymbol, string> = { '+': '+', '-': '−', S: 'S' };

/** Downscales an image file to at most 1200 px and returns a data URL (keeps the project file small). */
async function imageToDataUrl(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const scale = Math.min(1, 1200 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    const ctx = c.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ConceptsTab() {
  const p = useProject();
  const fmt = useFmt();
  const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
  return (
    <Card
      title={t('کانسپت‌ها ({n})', { n: fmt.int(p.concepts.length) })}
      actions={
        <Button
          size="sm"
          icon="plus"
          onClick={() =>
            edit('افزودن کانسپت', (d) => {
              let k = d.concepts.length + 1;
              while (d.concepts.some((c) => c.code === `C${k}`)) k++;
              d.concepts.push({ id: newId('k_'), code: `C${k}`, name: '', sketch: null, description: '', feasible: true });
            })
          }
        >
          {t('افزودن کانسپت')}
        </Button>
      }
    >
      <p className="mb-3 text-sm text-muted">{t('هر کانسپت با یک کد، ترسیم دستی/دیجیتال و توصیف فنی کوتاه (حدود ۱۰۰ کلمه) مستند می‌شود. فقط کانسپت‌های امکان‌پذیر از نظر فنی به ماتریس وزن‌دار راه می‌یابند.')}</p>
      {p.concepts.length === 0 && <Empty>{t('هنوز کانسپتی ثبت نشده است.')}</Empty>}
      <div className="grid gap-3 lg:grid-cols-2">
        {p.concepts.map((c, i) => {
          const set = (label: string, f: (x: Concept) => void, preview = false) => edit(label, (d) => f(d.concepts[i] as Concept), { preview });
          const w = words(c.description);
          return (
            <div key={c.id} className="rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-end gap-2">
                <Field label={t('کد')} className="w-20">
                  <TextInput ltr value={c.code} onChange={(v) => set('کد کانسپت', (x) => void (x.code = v))} />
                </Field>
                <Field label={t('نام')} className="min-w-40 flex-1">
                  <TextInput value={c.name} onChange={(v) => set('نام کانسپت', (x) => void (x.name = v))} />
                </Field>
                <span className="flex items-center">
                  <Reorder first={i === 0} last={i === p.concepts.length - 1} onUp={() => edit('ترتیب کانسپت‌ها', (d) => move(d.concepts, i, i - 1))} onDown={() => edit('ترتیب کانسپت‌ها', (d) => move(d.concepts, i, i + 1))} />
                  <IconButton
                    icon="trash"
                    tone="danger"
                    label={t('حذف کانسپت')}
                    onClick={() =>
                      edit(
                        'حذف کانسپت',
                        (d) => {
                          d.concepts = d.concepts.filter((x) => x.id !== c.id);
                          if (d.screening.run1.datumId === c.id) d.screening.run1.datumId = null;
                          if (d.weighted.conceptIds) d.weighted.conceptIds = d.weighted.conceptIds.filter((x) => x !== c.id);
                          delete d.screening.overrides[c.id];
                        },
                        { preview: true, confirm: { title: t('حذف کانسپت {code}', { code: c.code }), items: [t('آرای غربال و امتیازهای این کانسپت دیگر شمرده نمی‌شوند.')], confirmLabel: t('حذف') }, undoToast: t('کانسپت {code} حذف شد', { code: c.code }) },
                      )
                    }
                  />
                </span>
              </div>
              <div className="mt-2 grid gap-3 sm:grid-cols-[10rem_1fr]">
                <div>
                  {c.sketch ? (
                    <img src={c.sketch} alt={t('طرح {code}', { code: c.code })} className="max-h-40 w-full rounded border border-line bg-white object-contain" />
                  ) : (
                    <div className="flex h-32 items-center justify-center rounded border border-dashed border-line text-xs text-muted">{t('بدون تصویر')}</div>
                  )}
                  <div className="mt-1 flex gap-1">
                    <FilePick
                      accept="image/*"
                      icon="upload"
                      onFiles={async ([f]) => {
                        try {
                          const data = await imageToDataUrl(f);
                          set('تصویر کانسپت', (x) => void (x.sketch = data));
                        } catch {
                          toast(t('خواندن تصویر ممکن نشد.'), { tone: 'bad' });
                        }
                      }}
                    >
                      {t('تصویر')}
                    </FilePick>
                    {c.sketch && <IconButton icon="trash" label={t('حذف تصویر')} onClick={() => set('حذف تصویر کانسپت', (x) => void (x.sketch = null))} />}
                  </div>
                </div>
                <div>
                  <Field label={t('توصیف فنی ({n} کلمه)', { n: fmt.int(w) })} hint={w > 130 ? t('طولانی‌تر از حدود ۱۰۰ کلمه') : undefined}>
                    <TextArea rows={6} value={c.description} onChange={(v) => set('توصیف کانسپت', (x) => void (x.description = v))} />
                  </Field>
                  <Checkbox className="mt-2" checked={c.feasible} onChange={(v) => set('امکان‌پذیری فنی کانسپت', (x) => void (x.feasible = v), true)} label={t('از نظر فنی امکان‌پذیر است')} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function RatersCard() {
  const p = useProject();
  const s = p.screening;
  return (
    <Card title={t('ارزیاب‌ها (تیم پژوهش)')}>
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={s.mode}
          onChange={(v) => edit('حالت ارزیابی غربال', (d) => void (d.screening.mode = v), { preview: true })}
          options={[
            { value: 'team', label: t('چند ارزیاب (رأی اکثریت؛ تساوی = S)') },
            { value: 'single', label: t('یک ارزیاب (ساده)') },
          ]}
          className="w-72"
          aria-label={t('حالت ارزیابی')}
        />
        {s.raters.map((r, i) => (
          <span key={r.id} className={cx('inline-flex items-center gap-1', s.mode === 'single' && i > 0 && 'opacity-40')}>
            <TextInput value={r.label} onChange={(v) => edit('نام ارزیاب غربال', (d) => void (d.screening.raters[i].label = v))} className="w-36" aria-label={t('نام ارزیاب')} />
            <IconButton
              icon="trash"
              tone="danger"
              label={t('حذف ارزیاب')}
              disabled={s.raters.length <= 1}
              onClick={() =>
                edit(
                  'حذف ارزیاب غربال',
                  (d) => {
                    d.screening.raters.splice(i, 1);
                    delete d.screening.run1.votes[r.id];
                    delete d.screening.run2.votes[r.id];
                  },
                  { preview: true, undoToast: t('ارزیاب حذف شد') },
                )
              }
            />
          </span>
        ))}
        <Button size="sm" icon="plus" disabled={s.raters.length >= 4} onClick={() => edit('افزودن ارزیاب غربال', (d) => void d.screening.raters.push({ id: newId('r_'), label: `ارزیاب ${d.screening.raters.length + 1}` }))}>
          {t('ارزیاب')}
        </Button>
      </div>
      <p className="mt-2 text-xs text-muted">{t('طبق طرح، ارزیابی غربال توسط تیم پژوهش (پژوهشگر، استاد راهنما و استاد/استادان مشاور) انجام می‌شود؛ نماد هر خانه با رأی اکثریت تعیین و در صورت تساوی «S» ثبت می‌شود.')}</p>
    </Card>
  );
}

function RowsDialog({ onClose }: { onClose: () => void }) {
  const p = useProject();
  const current = new Set(screeningParamIds(p));
  return (
    <Modal open wide title={t('سطرهای ماتریس غربال (پارامترها)')} onClose={onClose} footer={<Button onClick={onClose}>{t('بستن')}</Button>}>
      <div className="mb-3 flex gap-2">
        <Button size="sm" onClick={() => edit('سطرهای غربال: پارامترهای حفظ‌شده', (d) => void (d.screening.paramIds = null), { preview: true })}>
          {t('پیش‌فرض: پارامترهای حفظ‌شده دلفی')}
        </Button>
      </div>
      <div className="grid gap-1 md:grid-cols-2">
        {p.params.map((x) => (
          <Checkbox
            key={x.id}
            checked={current.has(x.id)}
            onChange={(v) =>
              edit(
                'سطرهای ماتریس غربال',
                (d) => {
                  const set = new Set(d.screening.paramIds ?? [...current]);
                  if (v) set.add(x.id);
                  else set.delete(x.id);
                  d.screening.paramIds = d.params.map((q) => q.id).filter((id) => set.has(id));
                },
                { preview: true },
              )
            }
            label={
              <span>
                <span className="ltr text-muted">{x.code}</span> {x.name}
              </span>
            }
          />
        ))}
      </div>
    </Modal>
  );
}

function SymbolPicker({ value, onChange, label }: { value: PughSymbol | null; onChange: (v: PughSymbol | null) => void; label: string }) {
  return (
    <span className="inline-flex overflow-hidden rounded-md border border-line" role="radiogroup" aria-label={label}>
      {(['+', 'S', '-'] as PughSymbol[]).map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={value === s}
          aria-label={`${label}: ${s === '+' ? t('بهتر') : s === '-' ? t('بدتر') : t('مشابه')}`}
          onClick={() => onChange(value === s ? null : s)}
          className={cx(
            'h-7 w-7 text-sm font-bold',
            value === s ? (s === '+' ? 'bg-ok text-surface' : s === '-' ? 'bg-bad text-surface' : 'bg-ink/70 text-surface') : 'bg-surface text-muted hover:bg-surface-2',
          )}
        >
          {SYM[s]}
        </button>
      ))}
    </span>
  );
}

function RunTab({ run }: { run: 1 | 2 }) {
  const p = useProject();
  const fmt = useFmt();
  const a = screeningAnalysis(p);
  const [rater, setRater] = useState<string>('majority');
  const [rows, setRows] = useState(false);
  const paramIds = a.paramIds;
  const s = p.screening;
  const raters = s.mode === 'single' ? s.raters.slice(0, 1) : s.raters;
  const runKey = run === 1 ? 'run1' : 'run2';
  const datum = run === 1 ? s.run1.datumId : a.best;
  const res = run === 1 ? a.run1 : a.run2;
  const compared = res ? Object.keys(res.totals) : [];
  const conceptCols = datum ? [datum, ...p.concepts.map((c) => c.id).filter((c) => compared.includes(c))] : [];
  const usesRun1 = run === 2 && a.run2UsesRun1Votes;
  const runData: ScreeningRun = usesRun1 ? s.run1 : s[runKey];
  const cc = (id: Id) => p.concepts.find((c) => c.id === id)!;
  const activeRater = rater === 'majority' || !raters.some((r) => r.id === rater) ? null : rater;

  const setVote = (r: Id, c: Id, prm: Id, v: PughSymbol | null) =>
    edit(run === 1 ? 'رأی غربال اجرای اول' : 'رأی غربال اجرای دوم', (d) => {
      const target = d.screening[runKey];
      if (run === 2) target.datumId = a.best; // record the datum the run-2 votes were given against
      ((target.votes[r] ??= {})[c] ??= {})[prm] = v;
    });

  if (!p.concepts.length) return <Empty>{t('ابتدا کانسپت‌ها را ثبت کنید.')}</Empty>;
  if (!paramIds.length) return <Empty>{t('پارامتری برای سطرهای ماتریس نیست (پارامترهای حفظ‌شده دلفی یا انتخاب دستی).')}</Empty>;

  return (
    <div className="space-y-4">
      {run === 1 && (
        <Card title={t('مرجع اجرای اول')}>
          <div className="flex flex-wrap items-center gap-3">
            <Select
              value={s.run1.datumId ?? ''}
              onChange={(v) => edit('مرجع اجرای اول', (d) => void (d.screening.run1.datumId = v || null), { preview: true })}
              options={[{ value: '', label: t('— انتخاب کانسپت مرجع (ساده‌ترین راه‌حل) —') }, ...p.concepts.map((c) => ({ value: c.id, label: `${c.code} — ${c.name}` }))]}
              className="w-96"
              aria-label={t('مرجع اجرای اول')}
            />
            <span className="text-sm text-muted">{t('طبق طرح: کانسپتی که ساده‌ترین راه‌حل است.')}</span>
          </div>
        </Card>
      )}
      {run === 2 && !a.best && <Callout tone="warn">{t('اجرای اول هنوز کامل نیست؛ کانسپت برتر مشخص نشده است.')}</Callout>}
      {run === 2 && a.best && (
        <Callout tone="accent" title={t('مرجع اجرای دوم: کانسپت برتر اجرای اول ({code})', { code: cc(a.best).code })}>
          {t('سایر کانسپت‌های باقی‌مانده، از جمله مرجع اجرای اول، با آن مقایسه می‌شوند.')}
          {usesRun1 && t(' چون مرجع اجرای اول خودش کانسپت برتر است، آرای اجرای اول برای اجرای دوم به کار می‌رود (DECISIONS D-40).')}
        </Callout>
      )}
      {run === 2 && a.run2DatumMismatch && (
        <Callout tone="bad" title={t('آرای اجرای دوم با مرجع دیگری ثبت شده‌اند')}>
          <p>
            {t('کانسپت برتر اجرای اول تغییر کرده است ({best})، ولی آرای فعلی اجرای دوم نسبت به {datum} داده شده‌اند. اجرای دوم را دوباره ارزیابی کنید.', { best: cc(a.best!).code, datum: cc(s.run2.datumId!)?.code ?? '?' })}
          </p>
          <Button size="sm" variant="danger" className="mt-2" onClick={() => edit('پاک‌کردن آرای اجرای دوم', (d) => void (d.screening.run2 = { datumId: null, votes: {}, bestChoice: null }), { preview: true, undoToast: t('آرای اجرای دوم پاک شد') })}>
            {t('پاک‌کردن آرای اجرای دوم')}
          </Button>
        </Callout>
      )}
      {run === 1 && a.bestTied.length > 1 && (
        <Callout tone="warn" title={t('تساوی در بالاترین امتیاز خالص اجرای اول')}>
          <div className="flex flex-wrap items-center gap-2">
            {t('کانسپت برتر را انتخاب کنید (پیش‌فرض: اولی در ترتیب نمایش):')}
            <Select
              value={s.run1.bestChoice ?? ''}
              onChange={(v) => edit('انتخاب کانسپت برتر در تساوی', (d) => void (d.screening.run1.bestChoice = v || null), { preview: true })}
              options={[{ value: '', label: t('پیش‌فرض') }, ...a.bestTied.map((c) => ({ value: c, label: cc(c).code }))]}
              className="w-40"
              aria-label={t('کانسپت برتر')}
            />
          </div>
        </Callout>
      )}
      {datum && res && (
        <Card
          title={run === 1 ? t('ماتریس غربال — اجرای اول') : t('ماتریس غربال — اجرای دوم')}
          actions={
            <>
              <Select
                value={activeRater ?? 'majority'}
                onChange={setRater}
                options={[{ value: 'majority', label: t('نتیجه اکثریت') }, ...raters.map((r) => ({ value: r.id, label: t('آرای {name}', { name: r.label }) }))]}
                className="w-48"
                aria-label={t('نمایش')}
              />
              {run === 1 && (
                <Button size="sm" onClick={() => setRows(true)}>
                  {t('سطرها ({n})', { n: fmt.int(paramIds.length) })}
                </Button>
              )}
            </>
          }
        >
          {usesRun1 && activeRater && <Callout className="mb-2">{t('آرای اجرای دوم همان آرای اجرای اول است؛ برای ویرایش به اجرای اول بروید.')}</Callout>}
          <TableWrap>
            <table className="sticky-table text-sm">
              <thead>
                <tr>
                  <th className={th + ' sticky-col'}>{t('پارامتر')}</th>
                  {conceptCols.map((c) => (
                    <th key={c} className={th + ' text-center'}>
                      <span className="ltr">{cc(c).code}</span>
                      {c === datum && <span className="block text-[10px] font-normal">{t('مرجع')}</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {paramIds.map((pid) => {
                  const x = p.params.find((q) => q.id === pid)!;
                  return (
                    <tr key={pid}>
                      <td className={td + ' sticky-col max-w-64'}>
                        <span className="ltr text-xs text-muted">{x.code}</span> {x.name}
                      </td>
                      {conceptCols.map((c) => {
                        if (c === datum) return <td key={c} className={td + ' bg-surface-2 text-center text-muted'}>{t('مرجع')}</td>;
                        if (activeRater && !usesRun1)
                          return (
                            <td key={c} className={td + ' text-center'}>
                              <SymbolPicker value={runData.votes[activeRater]?.[c]?.[pid] ?? null} onChange={(v) => setVote(activeRater, c, pid, v)} label={`${cc(c).code} — ${x.code}`} />
                            </td>
                          );
                        const votes = raters.map((r) => runData.votes[r.id]?.[c]?.[pid] ?? null);
                        const m = majoritySymbol(votes);
                        return (
                          <td key={c} className={td + ' text-center'} title={raters.map((r, i) => `${r.label}: ${votes[i] ? SYM[votes[i]!] : '—'}`).join('\n')}>
                            <span className={cx('font-bold', m === '+' ? 'text-ok' : m === '-' ? 'text-bad' : 'text-muted')}>{m ? SYM[m] : '·'}</span>
                            {raters.length > 1 && <span className="block text-[10px] text-muted">{votes.map((v) => (v ? SYM[v] : '·')).join(' ')}</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {(['plus', 'minus', 'same'] as const).map((k) => (
                  <tr key={k} className="bg-surface-2/60">
                    <td className={td + ' sticky-col font-semibold'}>{k === 'plus' ? t('تعداد +') : k === 'minus' ? t('تعداد −') : t('تعداد S')}</td>
                    {conceptCols.map((c) => (
                      <td key={c} className={td + ' text-center'}>
                        {c === datum ? '' : fmt.int(res.totals[c][k])}
                      </td>
                    ))}
                  </tr>
                ))}
                <tr className="bg-surface-2/60 font-semibold">
                  <td className={td + ' sticky-col'}>{t('امتیاز خالص')}</td>
                  {conceptCols.map((c) => (
                    <td key={c} className={td + ' text-center'}>
                      {c === datum ? fmt.int(0) : fmt.int(res.totals[c].net)}
                    </td>
                  ))}
                </tr>
                <tr>
                  <td className={td + ' sticky-col font-semibold'}>{t('نتیجه')}</td>
                  {conceptCols.map((c) => {
                    if (c === datum) return <td key={c} className={td} />;
                    const tot = res.totals[c];
                    return (
                      <td key={c} className={td + ' text-center'}>
                        {tot.dominated ? <Badge tone="bad">{t('مغلوب — حذف')}</Badge> : run === 1 && a.best === c ? <Badge tone="ok">{t('برتر')}</Badge> : run === 2 && tot.hasPlus ? <Badge tone="ok">{t('حفظ')}</Badge> : <Badge>{t('باقی')}</Badge>}
                        {tot.empty > 0 && <span className="block text-[10px] text-warn">{t('{n} خانه خالی', { n: fmt.int(tot.empty) })}</span>}
                      </td>
                    );
                  })}
                </tr>
              </tbody>
            </table>
          </TableWrap>
          {run === 1 && a.best && (
            <p className="mt-2 text-sm">
              {t('کانسپت برتر اجرای اول (بالاترین امتیاز خالص در میان کانسپت‌های باقی‌مانده و مرجع):')} <b className="ltr">{cc(a.best).code}</b>
            </p>
          )}
        </Card>
      )}
      {rows && <RowsDialog onClose={() => setRows(false)} />}
    </div>
  );
}

function ResultTab() {
  const p = useProject();
  const fmt = useFmt();
  const go = useNav((s) => s.go);
  const a = screeningAnalysis(p);
  const cc = (id: Id) => p.concepts.find((c) => c.id === id)!;
  if (!a.run1 || !a.run2) return <Empty>{t('پس از تعیین مرجع و ثبت آرای دو اجرا، نتیجه نمایش داده می‌شود.')}</Empty>;
  const ruleSaysForward = (c: Id) => a.forward!.forwarded.includes(c);
  return (
    <div className="space-y-4">
      {a.forward!.safetyRuleUsed && (
        <Callout tone="warn" title={t('قاعده حداقل دو گزینه اعمال شد')}>
          {a.forward!.bestDominatesAll
            ? t('کانسپت برتر همه کانسپت‌ها را مغلوب کرد؛ طبق طرح، کانسپت دارای بالاترین امتیاز خالص اجرای دوم نیز به گام بعد می‌رود.')
            : t('کمتر از دو کانسپت به گام بعد می‌رسید؛ با تعمیم قاعده طرح (DECISIONS D-38)، کانسپت امکان‌پذیر دارای بالاترین امتیاز خالص اجرای دوم افزوده شد.')}
        </Callout>
      )}
      {a.forward!.tieAtCutoff.length > 0 && (
        <Callout tone="warn" title={t('تساوی در مرز حداکثر کانسپت‌ها')}>
          <div className="flex flex-wrap items-center gap-2">
            {t('کانسپت‌های هم‌امتیاز: {list}. انتخاب شما:', { list: a.forward!.tieAtCutoff.map((c) => cc(c).code).join(t('، ')) })}
            {a.forward!.tieAtCutoff.map((c) => (
              <Checkbox
                key={c}
                checked={(p.screening.cutoffChoice ?? []).includes(c)}
                onChange={(v) =>
                  edit('انتخاب در تساوی مرز کانسپت‌ها', (d) => {
                    const set = new Set(d.screening.cutoffChoice ?? []);
                    if (v) set.add(c);
                    else set.delete(c);
                    d.screening.cutoffChoice = [...set];
                  })
                }
                label={<span className="ltr">{cc(c).code}</span>}
              />
            ))}
          </div>
        </Callout>
      )}
      <Card
        title={t('راه‌یابی به ماتریس وزن‌دار')}
        actions={
          <Button variant="primary" onClick={() => go('weighted')} disabled={a.forwarded.length === 0}>
            {t('رفتن به ماتریس وزن‌دار ({n} کانسپت)', { n: fmt.int(a.forwarded.length) })}
          </Button>
        }
      >
        <TableWrap>
          <table className="sticky-table w-full text-sm">
            <thead>
              <tr>
                <th className={th}>{t('کانسپت')}</th>
                <th className={th}>{t('اجرای اول (امتیاز خالص؛ تعداد + − S)')}</th>
                <th className={th}>{t('اجرای دوم (امتیاز خالص؛ تعداد + − S)')}</th>
                <th className={th}>{t('امکان‌پذیری')}</th>
                <th className={th}>{t('نتیجه قاعده')}</th>
                <th className={th}>{t('تصمیم نهایی')}</th>
              </tr>
            </thead>
            <tbody>
              {a.final.map((f) => {
                const c = cc(f.conceptId);
                const t1 = a.run1!.totals[c.id];
                const t2 = a.run2!.totals[c.id];
                // the net score first, then the counts in a left-to-right span so the signs stay with their numbers
                const fmtT = (tot: typeof t1) =>
                  tot ? (
                    <span className="whitespace-nowrap">
                      {t('خالص')} <b className="ltr">{fmt.int(tot.net)}</b>{' '}
                      <span className="ltr text-xs text-muted">
                        (+{fmt.int(tot.plus)} −{fmt.int(tot.minus)} S{fmt.int(tot.same)})
                      </span>
                    </span>
                  ) : (
                    '—'
                  );
                return (
                  <tr key={c.id}>
                    <td className={td}>
                      <span className="ltr font-semibold">{c.code}</span> {c.name}
                    </td>
                    <td className={td}>{c.id === a.run1!.datumId ? t('مرجع') : fmtT(t1)}</td>
                    <td className={td}>{c.id === a.best ? t('مرجع (برتر)') : fmtT(t2)}</td>
                    <td className={td}>{c.feasible ? <Badge tone="ok">{t('امکان‌پذیر')}</Badge> : <Badge tone="bad">{t('نیست')}</Badge>}</td>
                    <td className={td + ' text-xs'}>
                      {f.ruleReason === 'eliminated-run1' && t1
                        ? t('مغلوب مرجع {code} در اجرای اول: بدون «+»، {n} مورد «−»', { code: cc(a.run1!.datumId).code, n: fmt.int(t1.minus) })
                        : f.ruleReason === 'dominated' && t2
                          ? t('مغلوب کانسپت برتر در اجرای دوم: بدون «+»، {n} مورد «−»', { n: fmt.int(t2.minus) })
                          : t(REASON_FA[f.ruleReason])}
                    </td>
                    <td className={td + ' min-w-64'}>
                      <div className="flex items-center gap-2">
                        <Select
                          value={f.override ? (f.override.forward ? 'yes' : 'no') : 'rule'}
                          onChange={(v) =>
                            edit(
                              'تصمیم دستی راه‌یابی کانسپت',
                              (d) => {
                                if (v === 'rule') delete d.screening.overrides[c.id];
                                else d.screening.overrides[c.id] = { forward: v === 'yes', reason: d.screening.overrides[c.id]?.reason ?? '' };
                              },
                              { preview: true },
                            )
                          }
                          options={[
                            { value: 'rule', label: ruleSaysForward(c.id) ? t('طبق قاعده (راه می‌یابد)') : t('طبق قاعده (راه نمی‌یابد)') },
                            { value: 'yes', label: t('راه یابد (تصمیم دستی)') },
                            { value: 'no', label: t('راه نیابد (تصمیم دستی)') },
                          ]}
                          aria-label={t('تصمیم')}
                        />
                        {f.forward ? <Badge tone="ok">{t('راه‌یافته')}</Badge> : <Badge>—</Badge>}
                      </div>
                      {f.override && (
                        <TextInput
                          className={'mt-1 ' + (!f.override.reason.trim() ? 'border-warn' : '')}
                          value={f.override.reason}
                          placeholder={t('دلیل (الزامی، در گزارش می‌آید)')}
                          onChange={(v) => edit('دلیل تصمیم دستی راه‌یابی', (d) => void (d.screening.overrides[c.id].reason = v))}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </div>
  );
}

export function ScreeningScreen() {
  const [tab, setTab] = useState<'concepts' | 'run1' | 'run2' | 'result'>('concepts');
  const p = useProject();
  const fmt = useFmt();
  return (
    <div className="space-y-4">
      <PageTitle
        title={t('غربال پیو')}
        subtitle={t('هر کانسپت بر اساس پارامترهای مورد اجماع و بدون وزن با یک طرح مرجع مقایسه می‌شود (+ بهتر، − بدتر، S مشابه). کانسپتی که هیچ «+» و دست‌کم یک «−» داشته باشد مغلوب مرجع است و حذف می‌شود.')}
      />
      <RatersCard />
      <Tabs
        tabs={[
          { id: 'concepts', label: t('کانسپت‌ها ({n})', { n: fmt.int(p.concepts.length) }) },
          { id: 'run1', label: t('اجرای اول') },
          { id: 'run2', label: t('اجرای دوم') },
          { id: 'result', label: t('نتیجه و راه‌یابی') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'concepts' && <ConceptsTab />}
      {tab === 'run1' && <RunTab run={1} />}
      {tab === 'run2' && <RunTab run={2} />}
      {tab === 'result' && <ResultTab />}
    </div>
  );
}

