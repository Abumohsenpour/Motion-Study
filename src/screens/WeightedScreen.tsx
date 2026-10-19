/**
 * Step 9 — weighted Pugh matrix: parameter columns with editable weights (from Part A or typed), concept rows,
 * absolute 1–5 scoring by the panel (manual grid or blinded offline files), relations ۶–۸, ranking, agreement
 * per domain, and the sensitivity analysis with break-even.
 */
import { useMemo, useState, type KeyboardEvent } from 'react';
import { expertById, projectWeights, respondents, screeningAnalysis, weightedAnalysis, weightedConceptIds, weightedRaterIds, SINGLE, type Id } from '../core';
import { edit } from '../app/edit';
import { scoreChart } from '../charts/scoreChart';
import { prepareFileImports, type ImportItem } from '../io/responses';
import { useProject } from '../state/store';
import { useFmt } from '../ui/format';
import { Badge, Button, Callout, Card, Checkbox, DomainChip, Empty, FilePick, IconButton, NumberInput, PageTitle, Reorder, Select, TableWrap, Tabs, cx, td, th } from '../ui/kit';
import { ImportDialog } from './rounds/ImportDialog';
import { downloadAllQuestionnaires, downloadQuestionnaire } from './rounds/files';

const move = <T,>(arr: T[], i: number, j: number) => {
  const [x] = arr.splice(i, 1);
  arr.splice(j, 0, x);
};

function ColumnsTab() {
  const p = useProject();
  const fmt = useFmt();
  const partA = useMemo(() => {
    try {
      return projectWeights(p).final;
    } catch {
      return {};
    }
  }, [p]);
  const a = weightedAnalysis(p, partA);
  const cols = p.weighted.columns;
  const forwarded = screeningAnalysis(p).forwarded;
  const rows = weightedConceptIds(p);
  const [add, setAdd] = useState('');
  const sendFromA = () =>
    edit(
      'ارسال وزن‌ها به بخش ب',
      (d) => {
        d.weighted.columns = Object.keys(partA).map((id) => ({ paramId: id, weight: partA[id] }));
        d.weighted.sentWeights = { at: new Date().toISOString(), weights: { ...partA } };
      },
      { preview: true, confirm: cols.length ? { title: 'جایگزینی ستون‌ها با وزن‌های فعلی بخش الف', confirmLabel: 'جایگزین شود' } : undefined },
    );
  return (
    <div className="space-y-4">
      {a.partAChanged && (
        <Callout tone="warn" title="وزن‌های بخش الف تغییر کرده‌اند">
          <p>وزن‌های این ماتریس با وزن‌های فعلی بخش الف یکی نیست. اگر تغییر از ویرایش‌های دستی شماست، می‌توانید نگه دارید؛ در غیر این صورت دوباره ارسال کنید.</p>
          <Button size="sm" className="mt-2" icon="refresh" onClick={sendFromA}>
            ارسال دوباره وزن‌های بخش الف
          </Button>
        </Callout>
      )}
      <Card
        title="ستون‌ها: پارامترها و وزن‌ها (Wᵢ)"
        actions={
          <>
            <Button size="sm" icon="refresh" onClick={sendFromA} disabled={!Object.keys(partA).length}>
              دریافت وزن‌ها از بخش الف
            </Button>
            <Button size="sm" disabled={!cols.length || a.weightsSumToOne} onClick={() => edit('نرمال‌سازی وزن‌ها', (d) => {
              const s = d.weighted.columns.reduce((t, c) => t + c.weight, 0);
              if (s > 0) for (const c of d.weighted.columns) c.weight = c.weight / s;
            }, { preview: true })}>
              نرمال‌سازی (مجموع = ۱)
            </Button>
          </>
        }
      >
        {cols.length === 0 ? (
          <Empty>ستونی تعریف نشده است. از «دریافت وزن‌ها از بخش الف» یا افزودن دستی استفاده کنید.</Empty>
        ) : (
          <TableWrap>
            <table className="sticky-table w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>کد</th>
                  <th className={th}>پارامتر</th>
                  <th className={th}>Wᵢ</th>
                  <th className={th}>Wᵢ بخش الف</th>
                  <th className={th} />
                </tr>
              </thead>
              <tbody>
                {cols.map((c, i) => {
                  const x = p.params.find((q) => q.id === c.paramId);
                  return (
                    <tr key={c.paramId}>
                      <td className={td + ' ltr'}>{x?.code}</td>
                      <td className={td}>{x?.name}</td>
                      <td className={td + ' w-32'}>
                        <NumberInput value={c.weight} min={0} lazy onChange={(v) => v !== null && edit('ویرایش دستی وزن ستون', (d) => void (d.weighted.columns[i].weight = v), { preview: true })} aria-label={`وزن ${x?.code}`} />
                      </td>
                      <td className={td + ' text-center text-muted tabular-nums'}>{partA[c.paramId] !== undefined ? fmt.num(partA[c.paramId], 4) : '—'}</td>
                      <td className={td + ' whitespace-nowrap'}>
                        <Reorder first={i === 0} last={i === cols.length - 1} onUp={() => edit('ترتیب ستون‌ها', (d) => move(d.weighted.columns, i, i - 1))} onDown={() => edit('ترتیب ستون‌ها', (d) => move(d.weighted.columns, i, i + 1))} />
                        <IconButton icon="trash" tone="danger" label="حذف ستون" onClick={() => edit('حذف ستون ماتریس وزن‌دار', (d) => void d.weighted.columns.splice(i, 1), { preview: true, undoToast: 'ستون حذف شد' })} />
                      </td>
                    </tr>
                  );
                })}
                <tr className="font-semibold">
                  <td className={td}>Σ</td>
                  <td className={td} />
                  <td className={td + ' text-center ' + (a.weightsSumToOne ? 'text-ok' : 'text-warn')}>{fmt.num(a.weightSum, 4)} {a.weightsSumToOne ? '✓' : '(≠ ۱)'}</td>
                  <td className={td} />
                  <td className={td} />
                </tr>
              </tbody>
            </table>
          </TableWrap>
        )}
        <div className="mt-3 flex gap-2">
          <Select
            value={add}
            onChange={setAdd}
            options={[{ value: '', label: '+ افزودن ستون (پارامتر)…' }, ...p.params.filter((x) => !cols.some((c) => c.paramId === x.id)).map((x) => ({ value: x.id, label: `${x.code} — ${x.name}` }))]}
            className="max-w-md"
            aria-label="افزودن ستون"
          />
          <Button size="sm" disabled={!add} onClick={() => edit('افزودن ستون ماتریس وزن‌دار', (d) => void d.weighted.columns.push({ paramId: add, weight: partA[add] ?? 0 }), { preview: true }).then(() => setAdd(''))}>
            افزودن
          </Button>
        </div>
      </Card>
      <Card
        title="سطرها: کانسپت‌ها"
        actions={
          p.weighted.conceptIds && (
            <Button size="sm" onClick={() => edit('سطرهای ماتریس: کانسپت‌های راه‌یافته', (d) => void (d.weighted.conceptIds = null), { preview: true })}>
              بازگشت به کانسپت‌های راه‌یافته از غربال
            </Button>
          )
        }
      >
        <p className="mb-2 text-sm text-muted">پیش‌فرض: کانسپت‌های راه‌یافته از غربال ({forwarded.map((id) => p.concepts.find((c) => c.id === id)?.code).join('، ') || '—'}). افزودن یا حذف دستی ممکن است.</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {p.concepts.map((c) => (
            <Checkbox
              key={c.id}
              checked={rows.includes(c.id)}
              onChange={(v) =>
                edit(
                  'سطرهای ماتریس وزن‌دار',
                  (d) => {
                    const set = new Set(d.weighted.conceptIds ?? rows);
                    if (v) set.add(c.id);
                    else set.delete(c.id);
                    d.weighted.conceptIds = d.concepts.map((x) => x.id).filter((id) => set.has(id));
                  },
                  { preview: true },
                )
              }
              label={
                <span>
                  <span className="ltr font-semibold">{c.code}</span> {c.name} {!c.feasible && <Badge tone="bad">امکان‌پذیر نیست</Badge>}
                </span>
              }
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

function ScoreCell({ value, onSet, onNav, id, label }: { value: number | null; onSet: (v: number | null) => void; onNav: (dr: number, dc: number) => void; id: string; label: string }) {
  const fmt = useFmt();
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    const moves: Record<string, [number, number]> = { ArrowUp: [-1, 0], ArrowDown: [1, 0], Enter: [1, 0], ArrowLeft: [0, 1], ArrowRight: [0, -1] };
    if (moves[e.key]) {
      e.preventDefault();
      onNav(...moves[e.key]);
    }
  };
  return (
    <input
      id={id}
      aria-label={label}
      value={value === null ? '' : fmt.int(value)}
      onFocus={(e) => e.target.select()}
      onKeyDown={onKey}
      onChange={(e) => {
        const t = e.target.value.trim().replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c))).slice(-1);
        if (t === '') return onSet(null);
        const n = Number(t);
        if (Number.isInteger(n) && n >= 1 && n <= 5) {
          onSet(n);
          onNav(0, 1);
        }
      }}
      className="h-8 w-9 rounded border border-line bg-surface text-center text-sm tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      dir="ltr"
      inputMode="numeric"
    />
  );
}

function ScoringTab() {
  const p = useProject();
  const fmt = useFmt();
  const concepts = weightedConceptIds(p);
  const cols = p.weighted.columns;
  const raters = weightedRaterIds(p);
  const single = p.weighted.mode === 'single';
  const [sel, setSel] = useState<Id>(single ? SINGLE : raters[0] ?? '');
  const [items, setItems] = useState<ImportItem[] | null>(null);
  const current = single ? SINGLE : raters.includes(sel) ? sel : raters[0];
  const r2 = respondents(p, 'r2').map((e) => e.id);
  const allIncluded = new Set(raters);
  const filled = (e: Id) => concepts.reduce((s, c) => s + cols.filter((col) => typeof p.weighted.scores[e]?.[c]?.[col.paramId] === 'number').length, 0);
  const total = concepts.length * cols.length;
  const gridId = 'wg';
  const focus = (r: number, c: number) => document.getElementById(`${gridId}-${r}-${c}`)?.focus();
  if (!cols.length || !concepts.length) return <Empty>ابتدا ستون‌ها (پارامترها و وزن‌ها) و سطرها (کانسپت‌ها) را تعیین کنید.</Empty>;
  return (
    <div className="space-y-4">
      <Card title="امتیازدهندگان">
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <Select
            value={p.weighted.mode}
            onChange={(v) => edit('حالت امتیازدهی ماتریس وزن‌دار', (d) => void (d.weighted.mode = v), { preview: true })}
            options={[
              { value: 'panel', label: 'اعضای پنل (روابط ۶ و ۷ به تفکیک حوزه)' },
              { value: 'single', label: 'یک امتیازدهنده (ساده)' },
            ]}
            className="w-80"
            aria-label="حالت امتیازدهی"
          />
          {!single && p.weighted.raterIds && (
            <Button size="sm" onClick={() => edit('امتیازدهندگان: پیش‌فرض', (d) => void (d.weighted.raterIds = null), { preview: true })}>
              بازگشت به پیش‌فرض (پاسخ‌دهندگان دور دوم)
            </Button>
          )}
        </div>
        {!single && (
          <>
            <p className="mb-2 text-sm text-muted">طبق طرح، اعضای پنل که دور دوم را تکمیل کرده‌اند امتیاز می‌دهند؛ پژوهشگر که کانسپت‌ها را تولید کرده امتیاز نمی‌دهد. کانسپت‌ها در فایل هر خبره با کد تصادفی و ترتیب تصادفی نمایش داده می‌شوند و نتایج غربال اعلام نمی‌شود.</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {p.experts
                .filter((e) => !e.excludeAllData)
                .map((e) => (
                  <Checkbox
                    key={e.id}
                    checked={allIncluded.has(e.id)}
                    onChange={(v) =>
                      edit(
                        'امتیازدهندگان ماتریس وزن‌دار',
                        (d) => {
                          const set = new Set(d.weighted.raterIds ?? raters);
                          if (v) set.add(e.id);
                          else set.delete(e.id);
                          d.weighted.raterIds = d.experts.map((x) => x.id).filter((id) => set.has(id));
                        },
                        { preview: true },
                      )
                    }
                    label={
                      <span className="inline-flex items-center gap-1">
                        <DomainChip domain={p.domains.find((d) => d.id === e.domainId)} />
                        <span className="ltr">{e.code}</span>
                        {!r2.includes(e.id) && <span className="text-xs text-muted">(بدون دور دوم)</span>}
                        <span className="text-xs text-muted">
                          {fmt.int(filled(e.id))}/{fmt.int(total)}
                        </span>
                      </span>
                    }
                  />
                ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button icon="download" variant="primary" disabled={!raters.length} onClick={() => downloadAllQuestionnaires(raters, 'pugh')}>
                فایل‌های امتیازدهی همه (ZIP)
              </Button>
              <FilePick accept=".json,application/json" multiple onFiles={async (files) => setItems(await prepareFileImports(files, p, 'pugh'))}>
                ورود فایل‌های امتیاز (.json)
              </FilePick>
            </div>
          </>
        )}
      </Card>
      <Card
        title="امتیازدهی (مقیاس ارزش ۵ سطحی)"
        actions={
          !single && (
            <Select
              value={current ?? ''}
              onChange={setSel}
              options={raters.map((id) => {
                const e = expertById(p, id)!;
                return { value: id, label: `${e.code} — ${p.domains.find((d) => d.id === e.domainId)?.shortLabel ?? ''} (${fmt.int(filled(id))}/${fmt.int(total)})` };
              })}
              className="w-56"
              aria-label="امتیازدهنده"
            />
          )
        }
      >
        <div className="mb-2 flex flex-wrap gap-2 text-xs text-muted">
          {p.settings.valueLabels.map((l, i) => (
            <span key={i} className="rounded bg-surface-2 px-2 py-0.5">
              <b>{fmt.int(i + 1)}</b> {l}
            </span>
          ))}
        </div>
        {!current ? (
          <Empty>امتیازدهنده‌ای انتخاب نشده است.</Empty>
        ) : (
          <>
            {!single && (
              <div className="mb-2 flex items-center gap-2 text-sm">
                <Button size="sm" icon="download" onClick={() => downloadQuestionnaire(current, 'pugh')}>
                  فایل امتیازدهی {expertById(p, current)?.code}
                </Button>
              </div>
            )}
            <TableWrap>
              <table className="sticky-table text-sm">
                <thead>
                  <tr>
                    <th className={th + ' sticky-col'}>کانسپت</th>
                    {cols.map((c) => (
                      <th key={c.paramId} className={th + ' text-center'} title={p.params.find((x) => x.id === c.paramId)?.name}>
                        <span className="ltr">{p.params.find((x) => x.id === c.paramId)?.code}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {concepts.map((cid, ri) => {
                    const c = p.concepts.find((x) => x.id === cid)!;
                    return (
                      <tr key={cid}>
                        <td className={td + ' sticky-col whitespace-nowrap'}>
                          <span className="ltr font-semibold">{c.code}</span> {c.name}
                        </td>
                        {cols.map((col, ci) => (
                          <td key={col.paramId} className={td + ' text-center'}>
                            <ScoreCell
                              id={`${gridId}-${ri}-${ci}`}
                              label={`${c.code} — ${p.params.find((x) => x.id === col.paramId)?.code}`}
                              value={p.weighted.scores[current]?.[cid]?.[col.paramId] ?? null}
                              onSet={(v) =>
                                edit('ورود دستی امتیاز ماتریس وزن‌دار', (d) => {
                                  ((d.weighted.scores[current] ??= {})[cid] ??= {})[col.paramId] = v;
                                })
                              }
                              onNav={(dr, dc) => {
                                const nr = ri + dr;
                                const nc = Math.min(cols.length - 1, Math.max(0, ci + dc));
                                if (nr >= 0 && nr < concepts.length) focus(nr, nc);
                              }}
                            />
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </TableWrap>
          </>
        )}
      </Card>
      {items && <ImportDialog items={items} label="ورود امتیازهای ماتریس وزن‌دار از فایل" onClose={() => setItems(null)} />}
    </div>
  );
}

function ResultsTab() {
  const p = useProject();
  const fmt = useFmt();
  const partA = useMemo(() => {
    try {
      return projectWeights(p).final;
    } catch {
      return {};
    }
  }, [p]);
  const a = weightedAnalysis(p, partA);
  const cols = p.weighted.columns;
  const cc = (id: Id) => p.concepts.find((c) => c.id === id)!;
  const pcode = (id: Id) => p.params.find((x) => x.id === id)?.code ?? '';
  const domains = p.weighted.mode === 'single' ? [] : p.domains;
  const [detail, setDetail] = useState(false);
  if (!cols.length || !a.conceptIds.length) return <Empty>ماتریس هنوز ستون یا سطر ندارد.</Empty>;
  const rankOf = new Map(a.result.ranking.map((r) => [r.id, r]));
  return (
    <div className="space-y-4">
      {!a.weightsSumToOne && <Callout tone="warn">مجموع وزن‌ها {fmt.num(a.weightSum, 4)} است (نه ۱). امتیاز وزنی با وزن‌های فعلی محاسبه شده است؛ برای نرمال‌سازی به تب «ستون‌ها و وزن‌ها» بروید.</Callout>}
      {a.result.incomplete.length > 0 && (
        <Callout tone="warn">
          امتیاز کانسپت‌های {a.result.incomplete.map((c) => cc(c).code).join('، ')} کامل نیست (خانه‌ای بدون هیچ امتیاز)؛ این کانسپت‌ها رتبه‌بندی نمی‌شوند.
        </Callout>
      )}
      <Card title="امتیاز تجمیعی (رابطه ۷) و امتیاز وزنی (رابطه ۸)">
        <TableWrap>
          <table className="sticky-table text-sm">
            <thead>
              <tr>
                <th className={th + ' sticky-col'}>کانسپت</th>
                {cols.map((c) => (
                  <th key={c.paramId} className={th + ' text-center'}>
                    <span className="ltr">{pcode(c.paramId)}</span>
                    <span className="block text-[10px] font-normal">W={fmt.num(c.weight, 3)}</span>
                  </th>
                ))}
                <th className={th + ' text-center'}>امتیاز وزنی</th>
                <th className={th + ' text-center'}>رتبه</th>
              </tr>
            </thead>
            <tbody>
              {a.conceptIds.map((cid) => (
                <tr key={cid}>
                  <td className={td + ' sticky-col whitespace-nowrap'}>
                    <span className="ltr font-semibold">{cc(cid).code}</span> {cc(cid).name}
                  </td>
                  {cols.map((c) => {
                    const cell = a.result.cells[cid][c.paramId];
                    return (
                      <td
                        key={c.paramId}
                        className={td + ' text-center tabular-nums'}
                        title={domains.map((d) => `${d.name}: میانه ${fmt.auto(cell.domainScore[d.id], 2)} (n=${cell.byDomain[d.id].n})`).join('\n')}
                      >
                        {fmt.num(cell.aggregated, 2)}
                      </td>
                    );
                  })}
                  <td className={td + ' text-center font-bold tabular-nums'}>{fmt.num(a.result.weighted[cid], 3)}</td>
                  <td className={td + ' text-center'}>{rankOf.has(cid) ? <Badge tone={rankOf.get(cid)!.rank === 1 ? 'ok' : 'neutral'}>{fmt.int(rankOf.get(cid)!.rank)}</Badge> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
        {a.result.ranking.length > 0 && (
          <div
            className="mt-4"
            dangerouslySetInnerHTML={{
              __html: scoreChart(
                a.result.ranking.map((r) => ({ label: `${cc(r.id).code} — ${cc(r.id).name}`, score: r.score, rank: r.rank })),
                fmt,
                { surface: 'transparent', ink: 'currentColor', muted: 'currentColor' },
              ),
            }}
          />
        )}
      </Card>
      {domains.length > 0 && (
        <Card
          title="امتیاز هر حوزه (رابطه ۶) و توافق خبرگان: میانه (Q1–Q3)"
          actions={
            <Button size="sm" onClick={() => setDetail(!detail)}>
              {detail ? 'پنهان‌کردن' : 'نمایش'}
            </Button>
          }
        >
          {detail && (
            <TableWrap>
              <table className="sticky-table text-xs">
                <thead>
                  <tr>
                    <th className={th + ' sticky-col'}>کانسپت / پارامتر</th>
                    {domains.map((d) => (
                      <th key={d.id} className={th + ' text-center'}>
                        <DomainChip domain={d} withName />
                      </th>
                    ))}
                    <th className={th + ' text-center'}>تجمیعی</th>
                  </tr>
                </thead>
                <tbody>
                  {a.conceptIds.flatMap((cid) =>
                    cols.map((c, i) => {
                      const cell = a.result.cells[cid][c.paramId];
                      return (
                        <tr key={cid + c.paramId} className={cx(i === 0 && 'border-t-2 border-line')}>
                          <td className={td + ' sticky-col whitespace-nowrap'}>
                            <span className={cx('ltr font-semibold', i > 0 && 'invisible')}>{cc(cid).code}</span>
                            <span className="text-muted"> · </span>
                            <span className="ltr text-muted">{pcode(c.paramId)}</span>
                          </td>
                          {domains.map((d) => {
                            const q = cell.byDomain[d.id];
                            return (
                              <td key={d.id} className={td + ' text-center whitespace-nowrap tabular-nums'}>
                                {q.n ? `${fmt.auto(q.median, 2)} (${fmt.auto(q.q1, 2)}–${fmt.auto(q.q3, 2)})` : '—'} <span className="text-muted">n={fmt.int(q.n)}</span>
                              </td>
                            );
                          })}
                          <td className={td + ' text-center font-semibold tabular-nums'}>{fmt.num(cell.aggregated, 2)}</td>
                        </tr>
                      );
                    }),
                  )}
                </tbody>
              </table>
            </TableWrap>
          )}
        </Card>
      )}
    </div>
  );
}

function SensitivityTab() {
  const p = useProject();
  const fmt = useFmt();
  const a = weightedAnalysis(p);
  const s = a.sensitivity;
  const cc = (id: Id) => p.concepts.find((c) => c.id === id)?.code ?? id;
  const cols = p.weighted.columns;
  const pcode = (i: number) => p.params.find((x) => x.id === cols[i].paramId)?.code ?? '';
  if (!s) return <Empty>تحلیل حساسیت به دست‌کم دو کانسپت با امتیاز کامل نیاز دارد.</Empty>;
  const step = p.settings.sensitivity.step;
  return (
    <div className="space-y-4">
      <Callout tone={s.trigger.triggered ? 'warn' : 'neutral'} title={`شرط اجرای تحلیل حساسیت طبق پروپوزال: ${s.trigger.triggered ? 'برقرار است' : 'برقرار نیست'}`}>
        اختلاف امتیاز وزنی دو کانسپت برتر ({cc(s.pair[0])} و {cc(s.pair[1])}) = <b>{fmt.num(s.trigger.gap, 3)}</b>؛ آستانه = {fmt.int(p.settings.sensitivity.pctOfRange)}٪ دامنه مقیاس = <b>{fmt.num(s.trigger.threshold, 2)}</b>.
        {s.supplementary && ' تحلیل زیر چون گزینه «همیشه اجرا شود» فعال است اجرا شده و «تکمیلی» (خارج از شرط پروپوزال) گزارش می‌شود.'}
        {!s.ran && ' تحلیل اجرا نشد (گزینه «همیشه اجرا شود» در تنظیمات خاموش است).'}
      </Callout>
      {s.ran && (
        <Card title={`تحلیل حساسیت تک‌عاملی: هر وزن یک بار ${fmt.int(step * 100)}٪ افزایش و یک بار ${fmt.int(step * 100)}٪ کاهش، سپس نرمال‌سازی`}>
          <p className="mb-2 text-sm text-muted">رتبه‌بندی پایه: {s.base.map((r) => `${cc(r.id)} (${fmt.num(r.score, 3)})`).join(' > ')}</p>
          <TableWrap>
            <table className="sticky-table w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>پارامتر</th>
                  <th className={th}>تغییر</th>
                  <th className={th}>وزن پس از نرمال‌سازی</th>
                  <th className={th}>رتبه‌بندی جدید (امتیاز)</th>
                  <th className={th}>کانسپت اول تغییر کرد؟</th>
                  <th className={th}>رتبه‌بندی تغییر کرد؟</th>
                </tr>
              </thead>
              <tbody>
                {s.scenarios.map((sc) => (
                  <tr key={`${sc.paramIndex}${sc.delta}`} className={sc.rankingChanged ? 'bg-warn-soft' : undefined}>
                    <td className={td + ' ltr'}>{pcode(sc.paramIndex)}</td>
                    <td className={td}>{sc.delta > 0 ? '+' : '−'}{fmt.int(Math.abs(sc.delta) * 100)}٪</td>
                    <td className={td + ' tabular-nums'}>{fmt.num(sc.weights[sc.paramIndex], 4)}</td>
                    <td className={td + ' text-xs'}>{sc.ranking.map((r) => `${cc(r.id)} (${fmt.num(r.score, 3)})`).join(' > ')}</td>
                    <td className={td}>{sc.topChanged ? <Badge tone="bad">بله</Badge> : <Badge tone="ok">خیر</Badge>}</td>
                    <td className={td}>{sc.rankingChanged ? <Badge tone="warn">بله</Badge> : <Badge tone="ok">خیر</Badge>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        </Card>
      )}
      <Card title={`نقطه سربه‌سر (تکمیلی): کمترین تغییر وزن هر پارامتر که ${cc(s.pair[1])} را با ${cc(s.pair[0])} برابر می‌کند`}>
        <p className="mb-2 text-sm text-muted">δ* = −D₀ / (wₖ·dₖ)؛ فقط برای دو کانسپت اول. تغییر کمتر از −۱۰۰٪ ممکن نیست (وزن منفی).</p>
        <TableWrap>
          <table className="sticky-table w-full text-sm">
            <thead>
              <tr>
                <th className={th}>پارامتر</th>
                <th className={th}>تغییر لازم در وزن</th>
                <th className={th}>وضعیت</th>
              </tr>
            </thead>
            <tbody>
              {s.breakEven.map((b, i) => (
                <tr key={i}>
                  <td className={td + ' ltr'}>{pcode(i)}</td>
                  <td className={td + ' tabular-nums'}>{b.delta === null ? '—' : `${b.delta > 0 ? '+' : '−'}${fmt.num(Math.abs(b.delta) * 100, 1)}٪`}</td>
                  <td className={td}>
                    {b.delta === null ? <span className="text-muted">این وزن ترتیب دو کانسپت را تغییر نمی‌دهد (امتیاز برابر در این پارامتر)</span> : b.possible ? (Math.abs(b.delta) <= step ? <Badge tone="warn">در محدوده ±{fmt.int(step * 100)}٪</Badge> : <Badge>ممکن</Badge>) : <Badge tone="ok">ناممکن</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      </Card>
    </div>
  );
}

export function WeightedScreen() {
  const [tab, setTab] = useState<'columns' | 'scoring' | 'results' | 'sensitivity'>('columns');
  return (
    <div className="space-y-4">
      <PageTitle
        title="ماتریس پیو وزن‌دار"
        subtitle="ستون‌ها پارامترهای مورد اجماع با وزن نهایی Wᵢ و سطرها کانسپت‌های راه‌یافته‌اند. امتیازدهی مطلق روی مقیاس ارزش ۵ سطحی است. امتیاز حوزه = میانه (رابطه ۶)، امتیاز تجمیعی = میانگین حوزه‌ها (رابطه ۷)، امتیاز وزنی = Σ Wᵢ × امتیاز تجمیعی (رابطه ۸)."
      />
      <Tabs
        tabs={[
          { id: 'columns', label: 'ستون‌ها و وزن‌ها' },
          { id: 'scoring', label: 'امتیازدهی' },
          { id: 'results', label: 'نتایج' },
          { id: 'sensitivity', label: 'تحلیل حساسیت' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'columns' && <ColumnsTab />}
      {tab === 'scoring' && <ScoringTab />}
      {tab === 'results' && <ResultsTab />}
      {tab === 'sensitivity' && <SensitivityTab />}
    </div>
  );
}
