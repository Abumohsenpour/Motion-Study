/**
 * Step 5 — round-1 analysis: per-parameter statistics (overall and per domain, with domain-coloured bars),
 * coding of open answers into candidate parameters (synonym merges, the 20 % rule, logged decisions),
 * and the round-1 report.
 */
import { Fragment, useMemo, useState } from 'react';
import { candidateRows, codeOf, newId, openAnswers, respondents, roundStats, type Candidate, type OpenCoding, type Parameter, type Project } from '../core';
import { edit } from '../app/edit';
import { miniBandBars } from '../charts/bandChart';
import { downloadText } from '../io/download';
import { bandRows, medianIqr } from '../report/delphiSections';
import { openReport } from '../report/html';
import { round1ReportHtml } from '../report/round1Report';
import { useProject } from '../state/store';
import { Modal, toast } from '../ui/dialogs';
import { useFmt } from '../ui/format';
import { Badge, Button, Callout, Card, Checkbox, DomainChip, Empty, Field, IconButton, PageTitle, Select, TableWrap, Tabs, TextArea, TextInput, td, th } from '../ui/kit';

function StatsTab() {
  const p = useProject();
  const fmt = useFmt();
  const stats = useMemo(() => roundStats(p, 'r1'), [p]);
  const [open, setOpen] = useState<string | null>(null);
  const bands = p.scale.bands;
  if (!respondents(p, 'r1').length) return <Empty>هنوز پاسخی برای دور اول ثبت نشده است.</Empty>;
  return (
    <Card title="آمار هر پارامتر (کل پنل و به تفکیک حوزه)">
      <p className="mb-3 text-sm text-muted">
        نوارها توزیع پاسخ‌های معتبر هر حوزه را در طبقه‌ها نشان می‌دهند (کم‌رنگ = طبقه پایین، پررنگ = طبقه بالا). برای دیدن جزئیات هر حوزه روی ردیف کلیک کنید. میانه و دامنه بین چارکی توصیفی‌اند.
      </p>
      <div className="mb-2 flex flex-wrap items-center gap-3 text-xs text-muted">
        {p.domains.map((d) => (
          <DomainChip key={d.id} domain={d} withName />
        ))}
        <span>|</span>
        {bands.map((b, i) => (
          <span key={b.id} className="inline-flex items-center gap-1">
            <span className="inline-block h-3 w-4 rounded-sm bg-ink" style={{ opacity: 0.32 + (0.68 * i) / Math.max(1, bands.length - 1) }} />
            {b.label}
          </span>
        ))}
      </div>
      <TableWrap>
        <table className="sticky-table w-full text-sm">
          <thead>
            <tr>
              <th className={th}>کد</th>
              <th className={th}>پارامتر</th>
              <th className={th}>n</th>
              <th className={th}>؟</th>
              <th className={th}>میانه (Q1–Q3)</th>
              <th className={th}>IQR</th>
              {bands.map((b) => (
                <th key={b.id} className={th}>
                  {b.label}
                  <span className="block text-[10px] font-normal">
                    {fmt.int(b.from)}–{fmt.int(b.to)}
                  </span>
                </th>
              ))}
              <th className={th}>به تفکیک حوزه</th>
            </tr>
          </thead>
          <tbody>
            {stats.map((s) => (
              <Fragment key={s.param.id}>
                <tr className="cursor-pointer hover:bg-surface-2" onClick={() => setOpen(open === s.param.id ? null : s.param.id)} aria-expanded={open === s.param.id}>
                  <td className={td + ' ltr'}>{s.param.code}</td>
                  <td className={td + ' max-w-72'}>{s.param.name}</td>
                  <td className={td + ' text-center'}>{fmt.int(s.overall.n)}</td>
                  <td className={td + ' text-center text-muted'}>{fmt.int(s.overall.nCannotJudge)}</td>
                  <td className={td + ' text-center whitespace-nowrap'}>{medianIqr(fmt, s.overall)}</td>
                  <td className={td + ' text-center'}>{fmt.auto(s.overall.iqr, 2)}</td>
                  {s.overall.counts.map((c, i) => (
                    <td key={i} className={td + ' text-center whitespace-nowrap'}>
                      {fmt.pct(s.overall.percents[i])} <span className="text-xs text-muted">({fmt.int(c)})</span>
                    </td>
                  ))}
                  <td className={td}>
                    <span
                      className="block text-ink"
                      dangerouslySetInnerHTML={{ __html: miniBandBars(bandRows(p, s), bands.map((b) => b.label), fmt) }}
                    />
                  </td>
                </tr>
                {open === s.param.id && (
                  <tr>
                    <td colSpan={7 + bands.length} className="border-b border-line bg-surface-2/60 p-2">
                      <table className="w-full text-xs">
                        <thead>
                          <tr>
                            <th className={th}>حوزه</th>
                            <th className={th}>n</th>
                            <th className={th}>؟</th>
                            <th className={th}>میانه (Q1–Q3)</th>
                            {bands.map((b) => (
                              <th key={b.id} className={th}>
                                {b.label}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {p.domains.map((d) => {
                            const b = s.byDomain[d.id];
                            return (
                              <tr key={d.id}>
                                <td className={td}>
                                  <DomainChip domain={d} withName />
                                </td>
                                <td className={td + ' text-center'}>{fmt.int(b.n)}</td>
                                <td className={td + ' text-center'}>{fmt.int(b.nCannotJudge)}</td>
                                <td className={td + ' text-center'}>{medianIqr(fmt, b)}</td>
                                {b.counts.map((c, i) => (
                                  <td key={i} className={td + ' text-center'}>
                                    {fmt.pct(b.percents[i])} ({fmt.int(c)})
                                  </td>
                                ))}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Card>
  );
}

/** Saves the coding of one open answer. */
function setCoding(key: string, f: (c: OpenCoding) => void) {
  return edit('کدگذاری پاسخ باز', (d) => {
    const c = (d.codings[key] ??= { key, candidateIds: [], paramIds: [], commentOnly: false, displayText: null, note: '' }) as OpenCoding;
    f(c);
  });
}

function CreateParamDialog({ cand, onClose }: { cand: Candidate; onClose: () => void }) {
  const p = useProject();
  const [code, setCode] = useState(() => {
    for (let k = p.params.length + 1; ; k++) {
      const c = `P${String(k).padStart(2, '0')}`;
      if (!p.params.some((x) => x.code === c)) return c;
    }
  });
  const [name, setName] = useState(cand.label);
  const [groupId, setGroupId] = useState(p.groups[0]?.id ?? '');
  const [requirement, setRequirement] = useState('');
  const [explanation, setExplanation] = useState('');
  const dup = p.params.some((x) => x.code === code.trim());
  return (
    <Modal
      open
      title="ساخت پارامتر جدید برای دور دوم"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>انصراف</Button>
          <Button
            variant="primary"
            disabled={!code.trim() || !name.trim() || !groupId || dup}
            onClick={() => {
              const id = newId('p_');
              edit('افزودن پارامتر جدید از پاسخ‌های باز', (d) => {
                d.params.push({ id, code: code.trim(), name: name.trim(), groupId, requirement, explanation, range: '', source: 'literature', origin: 'round2' } satisfies Parameter);
                const c = d.candidates.find((x) => x.id === cand.id);
                if (c) c.paramId = id;
              });
              onClose();
            }}
          >
            ساخت پارامتر
          </Button>
        </>
      }
    >
      <div className="grid gap-3">
        <div className="grid grid-cols-[8rem_1fr] gap-3">
          <Field label="کد">
            <TextInput ltr value={code} onChange={setCode} />
            {dup && <span className="text-xs text-bad">تکراری</span>}
          </Field>
          <Field label="نام پارامتر">
            <TextInput value={name} onChange={setName} />
          </Field>
        </div>
        <Field label="گروه معنایی">
          <Select value={groupId} onChange={setGroupId} options={p.groups.map((g) => ({ value: g.id, label: g.name }))} />
        </Field>
        <Field label="الزام طراحی">
          <TextArea rows={2} value={requirement} onChange={setRequirement} />
        </Field>
        <Field label="توضیح مختصر">
          <TextArea rows={2} value={explanation} onChange={setExplanation} />
        </Field>
        <p className="text-xs text-muted">منشأ این پارامتر «افزوده در دور دوم» ثبت می‌شود و در پرسش‌نامه دور دوم با برچسب «جدید» و بدون داده دور اول نمایش داده می‌شود.</p>
      </div>
    </Modal>
  );
}

function CandidatesCard() {
  const p = useProject();
  const fmt = useFmt();
  const rows = candidateRows(p);
  const nResp = respondents(p, 'r1').length;
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState<Candidate | null>(null);
  return (
    <Card title="پارامترهای نامزد">
      <p className="mb-3 text-sm text-muted">
        پشتیبانی هر نامزد = تعداد خبرگان متمایز پس از ادغام موارد هم‌معنا. آستانه: دست‌کم {fmt.int(p.settings.candidatePct)}٪ از {fmt.int(nResp)} پاسخ‌دهنده دور اول ={' '}
        <b>{fmt.int(rows[0]?.minNeeded ?? Math.ceil((p.settings.candidatePct * nResp) / 100))}</b> خبره. نامزدهای به آستانه رسیده به‌طور پیش‌فرض به دور دوم افزوده می‌شوند؛ تصمیم دستی خلاف قاعده نیاز به دلیل دارد و ثبت می‌شود.
      </p>
      <div className="mb-3 flex gap-2">
        <TextInput value={label} onChange={setLabel} placeholder="عنوان نامزد جدید" className="max-w-sm" />
        <Button
          icon="plus"
          disabled={!label.trim()}
          onClick={() => {
            edit('افزودن پارامتر نامزد', (d) => void d.candidates.push({ id: newId('c_'), label: label.trim(), mergedInto: null, override: null, overrideReason: '', paramId: null }));
            setLabel('');
          }}
        >
          افزودن نامزد
        </Button>
      </div>
      {rows.length === 0 ? (
        <Empty>هنوز نامزدی تعریف نشده است. از فهرست پاسخ‌های باز، پاسخ‌ها را به نامزدها نسبت دهید.</Empty>
      ) : (
        <TableWrap>
          <table className="sticky-table w-full text-sm">
            <thead>
              <tr>
                <th className={th}>نامزد</th>
                <th className={th}>ادغام در</th>
                <th className={th}>خبرگان</th>
                <th className={th}>قاعده {fmt.int(p.settings.candidatePct)}٪</th>
                <th className={th}>تصمیم</th>
                <th className={th}>پارامتر دور دوم</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const c = r.candidate;
                const i = p.candidates.findIndex((x) => x.id === c.id);
                const param = p.params.find((x) => x.id === c.paramId);
                return (
                  <tr key={c.id} className={r.merged ? 'opacity-70' : undefined}>
                    <td className={td + ' min-w-48'}>
                      <TextInput value={c.label} onChange={(v) => edit('عنوان نامزد', (d) => void (d.candidates[i].label = v))} aria-label="عنوان نامزد" />
                    </td>
                    <td className={td + ' min-w-40'}>
                      <Select
                        value={c.mergedInto ?? ''}
                        onChange={(v) => edit('ادغام موارد هم‌معنا', (d) => void (d.candidates[i].mergedInto = v || null), { preview: true })}
                        options={[{ value: '', label: '— (مستقل)' }, ...p.candidates.filter((x) => x.id !== c.id).map((x) => ({ value: x.id, label: x.label }))]}
                        aria-label="ادغام در"
                      />
                    </td>
                    <td className={td + ' text-xs'}>
                      {r.merged ? (
                        <span className="text-muted">در نامزد دیگر شمرده می‌شود</span>
                      ) : (
                        <>
                          <b>{fmt.int(r.supporters.length)}</b> <span className="ltr text-muted">{r.supporters.map((id) => codeOf(p, id)).sort().join(', ')}</span>
                        </>
                      )}
                    </td>
                    <td className={td}>{r.merged ? '—' : r.meetsThreshold ? <Badge tone="ok">به آستانه رسید</Badge> : <Badge>نرسید</Badge>}</td>
                    <td className={td + ' min-w-56'}>
                      {!r.merged && (
                        <>
                          <Select
                            value={c.override ?? 'rule'}
                            onChange={(v) => edit('تصمیم دستی درباره نامزد', (d) => void (d.candidates[i].override = v === 'rule' ? null : v), { preview: true })}
                            options={[
                              { value: 'rule', label: `طبق قاعده (${r.meetsThreshold ? 'افزوده می‌شود' : 'افزوده نمی‌شود'})` },
                              { value: 'add', label: 'افزوده شود (تصمیم دستی)' },
                              { value: 'reject', label: 'افزوده نشود (تصمیم دستی)' },
                            ]}
                            aria-label="تصمیم"
                          />
                          {c.override && (
                            <TextInput
                              className={'mt-1 ' + (!c.overrideReason.trim() ? 'border-warn' : '')}
                              value={c.overrideReason}
                              placeholder="دلیل تصمیم دستی (الزامی)"
                              onChange={(v) => edit('دلیل تصمیم دستی نامزد', (d) => void (d.candidates[i].overrideReason = v))}
                            />
                          )}
                        </>
                      )}
                    </td>
                    <td className={td}>
                      {param ? (
                        <Badge tone="accent">
                          <span className="ltr">{param.code}</span>
                        </Badge>
                      ) : r.add ? (
                        <Button size="sm" variant="primary" onClick={() => setCreating(c)}>
                          ساخت پارامتر
                        </Button>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className={td}>
                      <IconButton
                        icon="trash"
                        tone="danger"
                        label="حذف نامزد"
                        onClick={() =>
                          edit(
                            'حذف پارامتر نامزد',
                            (d) => {
                              d.candidates = d.candidates.filter((x) => x.id !== c.id);
                              for (const x of d.candidates) if (x.mergedInto === c.id) x.mergedInto = null;
                              for (const k of Object.keys(d.codings)) d.codings[k].candidateIds = d.codings[k].candidateIds.filter((x) => x !== c.id);
                            },
                            { undoToast: 'نامزد حذف شد' },
                          )
                        }
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
      {rows.some((r) => r.add && !r.candidate.paramId) && (
        <Callout tone="warn" className="mt-3">
          نامزدهای تأییدشده باید پیش از ساخت فایل‌های دور دوم به پارامتر تبدیل شوند (دکمه «ساخت پارامتر»).
        </Callout>
      )}
      {creating && <CreateParamDialog cand={creating} onClose={() => setCreating(null)} />}
    </Card>
  );
}

function AnswerCard({ a, p }: { a: ReturnType<typeof openAnswers>[number]; p: Project }) {
  const e = p.experts.find((x) => x.id === a.expertId)!;
  const coding = a.coding;
  const [newCand, setNewCand] = useState('');
  const display = coding?.displayText ?? a.text;
  return (
    <div className="rounded-lg border border-line p-3">
      <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted">
        <DomainChip domain={p.domains.find((d) => d.id === e.domainId)} />
        <span className="ltr font-semibold text-ink">{e.code}</span>
        <span>گروه: {p.groups.find((g) => g.id === a.groupId)?.name}</span>
      </div>
      <p className="mb-2 rounded bg-surface-2 p-2 text-sm leading-7 whitespace-pre-wrap">{a.text}</p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-2">
          <div className="text-xs font-medium text-muted">نامزدها:</div>
          <div className="flex flex-wrap gap-1">
            {(coding?.candidateIds ?? []).map((cid) => (
              <Badge key={cid} tone="accent">
                {p.candidates.find((c) => c.id === cid)?.label}
                <button type="button" aria-label="برداشتن" onClick={() => setCoding(a.key, (c) => void (c.candidateIds = c.candidateIds.filter((x) => x !== cid)))}>
                  ×
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-1">
            <Select
              value=""
              onChange={(v) => v && setCoding(a.key, (c) => void (c.candidateIds.includes(v) || c.candidateIds.push(v)))}
              options={[{ value: '', label: '+ نسبت‌دادن به نامزد…' }, ...p.candidates.filter((c) => !c.mergedInto).map((c) => ({ value: c.id, label: c.label }))]}
              aria-label="نسبت‌دادن به نامزد"
            />
          </div>
          <div className="flex gap-1">
            <TextInput value={newCand} onChange={setNewCand} placeholder="نامزد تازه از این پاسخ" />
            <Button
              size="sm"
              disabled={!newCand.trim()}
              onClick={() => {
                const id = newId('c_');
                edit('افزودن پارامتر نامزد از پاسخ باز', (d) => {
                  d.candidates.push({ id, label: newCand.trim(), mergedInto: null, override: null, overrideReason: '', paramId: null });
                  const c = (d.codings[a.key] ??= { key: a.key, candidateIds: [], paramIds: [], commentOnly: false, displayText: null, note: '' }) as OpenCoding;
                  c.candidateIds.push(id);
                });
                setNewCand('');
              }}
            >
              افزودن
            </Button>
          </div>
          <Select
            value=""
            onChange={(v) => v && setCoding(a.key, (c) => void (c.paramIds.includes(v) || c.paramIds.push(v)))}
            options={[{ value: '', label: '+ مربوط به پارامتر موجود…' }, ...p.params.map((x) => ({ value: x.id, label: `${x.code} — ${x.name}` }))]}
            aria-label="مربوط به پارامتر موجود"
          />
          <div className="flex flex-wrap gap-1">
            {(coding?.paramIds ?? []).map((pid) => (
              <Badge key={pid}>
                <span className="ltr">{p.params.find((x) => x.id === pid)?.code}</span>
                <button type="button" aria-label="برداشتن" onClick={() => setCoding(a.key, (c) => void (c.paramIds = c.paramIds.filter((x) => x !== pid)))}>
                  ×
                </button>
              </Badge>
            ))}
          </div>
          <Checkbox checked={!!coding?.commentOnly} onChange={(v) => setCoding(a.key, (c) => void (c.commentOnly = v))} label="فقط توضیح است (پیشنهاد پارامتر نیست)" />
        </div>
        <div className="space-y-2">
          <Field label="متن قابل‌انتشار (در خروجی‌ها؛ جزئیات هویت‌بخش را حذف کنید)">
            <TextArea rows={3} value={display} onChange={(v) => setCoding(a.key, (c) => void (c.displayText = v === a.text ? null : v))} />
          </Field>
          <Field label="یادداشت کدگذاری">
            <TextInput value={coding?.note ?? ''} onChange={(v) => setCoding(a.key, (c) => void (c.note = v))} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function CodingTab() {
  const p = useProject();
  const fmt = useFmt();
  const answers = openAnswers(p);
  const [filter, setFilter] = useState<'all' | 'uncoded'>('all');
  const uncoded = (a: (typeof answers)[number]) => !a.coding || (!a.coding.commentOnly && !a.coding.candidateIds.length && !a.coding.paramIds.length);
  const shown = filter === 'all' ? answers : answers.filter(uncoded);
  return (
    <div className="space-y-4">
      <Card
        title={`پاسخ‌های باز (${fmt.int(answers.length)})`}
        actions={
          <Select
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: 'همه' },
              { value: 'uncoded', label: `کدگذاری‌نشده (${fmt.int(answers.filter(uncoded).length)})` },
            ]}
            aria-label="فیلتر"
          />
        }
      >
        {shown.length === 0 ? <Empty>پاسخ بازی برای نمایش نیست.</Empty> : <div className="space-y-3">{shown.map((a) => <AnswerCard key={a.key} a={a} p={p} />)}</div>}
      </Card>
      <CandidatesCard />
    </div>
  );
}

function ReportTab() {
  const p = useProject();
  const fmt = useFmt();
  const make = () => round1ReportHtml(p, fmt);
  return (
    <Card title="گزارش دور اول برای تیم پژوهش">
      <p className="mb-3 text-sm text-muted">شامل توصیف پنل و نرخ پاسخ، آمار هر پارامتر (کل و به تفکیک حوزه)، نمودارهای رنگی حوزه‌ها، پاسخ‌های باز و پارامترهای نامزد. فقط کد خبرگان در آن می‌آید.</p>
      <div className="flex gap-2">
        <Button variant="primary" icon="print" onClick={() => openReport(make(), 'round1-report.html', downloadText)}>
          نمایش و چاپ
        </Button>
        <Button
          icon="download"
          onClick={() => {
            downloadText(make(), 'round1-report.html', 'text/html');
            toast('گزارش ذخیره شد.');
          }}
        >
          دانلود HTML
        </Button>
      </div>
    </Card>
  );
}

export function Analysis1Screen() {
  const [tab, setTab] = useState<'stats' | 'coding' | 'report'>('stats');
  return (
    <div className="space-y-4">
      <PageTitle title="تحلیل دور اول" subtitle="برای هر پارامتر، میانه، دامنه بین چارکی و درصد پاسخ‌ها در هر طبقه، به‌صورت کلی و به تفکیک حوزه. پاسخ‌های باز کدگذاری و موارد هم‌معنا تجمیع می‌شوند." />
      <Tabs
        tabs={[
          { id: 'stats', label: 'آمار پارامترها' },
          { id: 'coding', label: 'کدگذاری پاسخ‌های باز' },
          { id: 'report', label: 'گزارش دور اول' },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'stats' && <StatsTab />}
      {tab === 'coding' && <CodingTab />}
      {tab === 'report' && <ReportTab />}
    </div>
  );
}
