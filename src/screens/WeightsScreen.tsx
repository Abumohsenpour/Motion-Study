/**
 * Step 7 — consensus and weights: panel minimum check, consensus status of every parameter (round 2 only),
 * relations ۱–۵ step by step with checks, the design brief, and "send weights to Part B".
 */
import { Fragment, useMemo, useState } from 'react';
import { codeOf, consensusHelper, panelCheck, projectWeights, respondents, round2Analysis, type ConsensusStatus } from '../core';
import { edit } from '../app/edit';
import { useNav } from '../app/nav';
import { miniBandBars } from '../charts/bandChart';
import { downloadText } from '../io/download';
import { bandRows, medianIqr } from '../report/delphiSections';
import { openReport, ReportBuilder } from '../report/html';
import { briefSection, consensusSection, EXCLUSION_FA, weightsSection } from '../report/weightsSections';
import { statusLabel, t } from '../i18n';
import { useProject } from '../state/store';
import { useFmt } from '../ui/format';
import { Icon } from '../ui/icons';
import { Badge, Button, Callout, Card, DomainChip, Empty, PageTitle, Select, TableWrap, Tabs, td, th } from '../ui/kit';

function StatusBadge({ s, conflict }: { s: ConsensusStatus; conflict?: boolean }) {
  return (
    <Badge tone={s === 'retain' ? 'ok' : s === 'remove' ? 'bad' : 'neutral'}>
      <Icon name={s === 'retain' ? 'check' : s === 'remove' ? 'x' : 'info'} className="size-3" />
      {statusLabel(s)}
      {conflict && t(' (تعارض)')}
    </Badge>
  );
}

function PanelCheckCard() {
  const p = useProject();
  const fmt = useFmt();
  const pc = panelCheck(p);
  return (
    <Callout tone={pc.ok ? 'ok' : 'bad'} title={pc.ok ? t('حداقل نهایی پنل برقرار است') : t('حداقل نهایی پنل برقرار نیست')}>
      <div className="mt-1 flex flex-wrap items-center gap-3 text-sm">
        <span>
          {t('کل پاسخ‌دهندگان دور دوم:')} <b>{fmt.int(pc.total)}</b> {t('(حداقل {n})', { n: fmt.int(p.settings.panel.minTotal) })} {pc.totalOk ? '✓' : '✗'}
        </span>
        {p.domains.map((d) => (
          <span key={d.id} className="inline-flex items-center gap-1">
            <DomainChip domain={d} /> {d.name}: <b>{fmt.int(pc.perDomain[d.id])}</b> {t('(حداقل {n})', { n: fmt.int(p.settings.panel.minPerDomain) })} {pc.domainOk[d.id] ? '✓' : '✗'}
          </span>
        ))}
      </div>
      {!pc.ok && <div className="mt-1 text-sm">{t('طبق طرح، این شرط پیش از تحلیل دور دوم بررسی می‌شود. تحلیل انجام می‌شود ولی این وضعیت در گزارش ذکر خواهد شد.')}</div>}
    </Callout>
  );
}

function ConsensusTab() {
  const p = useProject();
  const fmt = useFmt();
  const rows = useMemo(() => round2Analysis(p), [p]);
  const [filter, setFilter] = useState<'all' | ConsensusStatus>('all');
  const cs = p.settings.consensus;
  const shown = filter === 'all' ? rows : rows.filter((r) => r.consensus.status === filter);
  const count = (s: ConsensusStatus) => rows.filter((r) => r.consensus.status === s).length;
  const nTypical = respondents(p, 'r2').length;
  const h = consensusHelper(nTypical, cs);
  return (
    <div className="space-y-4">
      <PanelCheckCard />
      <Card
        title={t('وضعیت اجماع (فقط امتیازهای دور دوم)')}
        actions={
          <Select
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'all', label: t('همه ({n})', { n: fmt.int(rows.length) }) },
              { value: 'retain', label: t('حفظ ({n})', { n: fmt.int(count('retain')) }) },
              { value: 'remove', label: t('حذف ({n})', { n: fmt.int(count('remove')) }) },
              { value: 'none', label: t('فاقد اجماع ({n})', { n: fmt.int(count('none')) }) },
            ]}
            aria-label={t('فیلتر وضعیت')}
          />
        }
      >
        <p className="mb-2 text-sm text-muted">
          {t('حفظ: ≥{a} پاسخ‌های معتبر در طبقه بالا و ≤{b} در طبقه پایین. حذف: ≥{c} در طبقه پایین و ≤{d} در طبقه بالا. با n = {n}: حفظ یعنی دست‌کم {top} پاسخ بالا و حداکثر {bottom} پاسخ پایین. میانه و IQR فقط توصیفی‌اند.', {
            a: fmt.pct(cs.retainTopMin, 0),
            b: fmt.pct(cs.retainBottomMax, 0),
            c: fmt.pct(cs.removeBottomMin, 0),
            d: fmt.pct(cs.removeTopMax, 0),
            n: fmt.int(nTypical),
            top: fmt.int(h.retainMinTop),
            bottom: fmt.int(h.retainMaxBottom),
          })}
        </p>
        {rows.length === 0 || nTypical === 0 ? (
          <Empty>{t('هنوز پاسخی برای دور دوم ثبت نشده است.')}</Empty>
        ) : (
          <TableWrap>
            <table className="sticky-table w-full text-sm">
              <thead>
                <tr>
                  <th className={th}>{t('کد')}</th>
                  <th className={th}>{t('پارامتر')}</th>
                  <th className={th}>n</th>
                  {p.scale.bands.map((b) => (
                    <th key={b.id} className={th}>
                      {b.label}
                    </th>
                  ))}
                  <th className={th}>{t('میانه (Q1–Q3)')}</th>
                  <th className={th}>{t('به تفکیک حوزه')}</th>
                  <th className={th}>{t('وضعیت')}</th>
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.param.id}>
                    <td className={td + ' ltr'}>{r.param.code}</td>
                    <td className={td}>
                      {r.param.name} {r.param.origin === 'round2' && <Badge tone="accent">{t('جدید')}</Badge>}
                    </td>
                    <td className={td + ' text-center'}>
                      {fmt.int(r.overall.n)}
                      {r.overall.nCannotJudge > 0 && <span className="block text-[11px] text-muted">{t('؟')} {fmt.int(r.overall.nCannotJudge)}</span>}
                    </td>
                    {r.overall.counts.map((c, i) => (
                      <td key={i} className={td + ' text-center whitespace-nowrap'}>
                        {fmt.pct(r.overall.percents[i])} <span className="text-xs text-muted">({fmt.int(c)})</span>
                      </td>
                    ))}
                    <td className={td + ' text-center whitespace-nowrap text-muted'}>{medianIqr(fmt, r.overall)}</td>
                    <td className={td}>
                      <span className="block text-ink" dangerouslySetInnerHTML={{ __html: miniBandBars(bandRows(p, r), p.scale.bands.map((b) => b.label), fmt) }} />
                    </td>
                    <td className={td}>
                      <StatusBadge s={r.consensus.status} conflict={r.consensus.conflict} />
                      {r.consensus.noValidAnswers && <span className="block text-[11px] text-muted">{t('بدون پاسخ معتبر')}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableWrap>
        )}
      </Card>
    </div>
  );
}

function WeightsTab() {
  const p = useProject();
  const fmt = useFmt();
  const w = useMemo(() => projectWeights(p), [p]);
  const [open, setOpen] = useState<string | null>(null);
  const pcode = (id: string) => p.params.find((x) => x.id === id)?.code ?? '';
  if (!w.retainedParams.length) return <Empty>{t('هیچ پارامتری به اجماع حفظ نرسیده است؛ وزنی محاسبه نمی‌شود.')}</Empty>;
  const used = p.domains.filter((d) => w.domainWeights[d.id]);
  return (
    <div className="space-y-4">
      <Card title={t('خبرگان واردشده در وزن‌دهی')}>
        <div className="flex flex-wrap gap-2 text-sm">
          {w.perExpert.map((e) => (
            <Badge key={e.expertId} tone={e.droppedGroups.length ? 'warn' : 'ok'}>
              <span className="ltr">{codeOf(p, e.expertId)}</span>
              {e.droppedGroups.length > 0 && ' *'}
            </Badge>
          ))}
        </div>
        {w.excluded.length > 0 && (
          <Callout tone="warn" className="mt-3" title={t('{n} خبره کنار گذاشته شدند (توزیع امتیاز ناقص)', { n: fmt.int(w.excluded.length) })}>
            <ul className="list-disc ps-5">
              {w.excluded.map((x) => (
                <li key={x.expertId}>
                  <span className="ltr font-semibold">{codeOf(p, x.expertId)}</span>: {t(EXCLUSION_FA[x.reason])}
                  {x.groupId && ` (${p.groups.find((g) => g.id === x.groupId)?.name})`}
                </li>
              ))}
            </ul>
          </Callout>
        )}
        {w.perExpert.some((e) => e.droppedGroups.length) && (
          <Callout tone="warn" className="mt-3">
            {t('* این خبره به گروهی امتیاز داده ولی به هیچ پارامتر حفظ‌شده آن گروه امتیازی نداده است؛ آن گروه برای او فاقد پارامتر حفظ‌شده تلقی شد و سهمش میان گروه‌های دیگر او بازتوزیع شد (DECISIONS D-22).')}
          </Callout>
        )}
        {w.domainsMissing.length > 0 && (
          <Callout tone="bad" className="mt-3">
            {t('حوزه {names} توزیع‌کننده معتبر ندارد؛ رابطه ۵ روی {n} حوزه میانگین گرفته می‌شود.', { names: w.domainsMissing.map((d) => p.domains.find((x) => x.id === d)?.name).join(t('، ')), n: fmt.int(w.domainsUsed.length) })}
          </Callout>
        )}
      </Card>

      <Card title={t('رابطه ۱ تا ۳: وزن‌های هر خبره')}>
        <p className="mb-2 text-sm text-muted">{t('رابطه ۳ = وزن گروه (رابطه ۲) × وزن درون‌گروهی (رابطه ۱). برای دیدن روابط ۱ و ۲ روی کد خبره کلیک کنید. ردیف Σ باید برای هر خبره ۱ باشد.')}</p>
        <TableWrap>
          <table className="sticky-table text-sm">
            <thead>
              <tr>
                <th className={th + ' sticky-col'}>{t('کد')}</th>
                {w.perExpert.map((e) => (
                  <th key={e.expertId} className={th + ' text-center'}>
                    <button type="button" className="ltr underline-offset-2 hover:underline" onClick={() => setOpen(open === e.expertId ? null : e.expertId)}>
                      {codeOf(p, e.expertId)}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {w.retainedParams.map((id) => (
                <tr key={id}>
                  <td className={td + ' sticky-col ltr'}>{pcode(id)}</td>
                  {w.perExpert.map((e) => (
                    <td key={e.expertId} className={td + ' text-center tabular-nums'}>
                      {fmt.num(e.overall[id], 4)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={td + ' sticky-col'}>Σ</td>
                {w.perExpert.map((e) => (
                  <td key={e.expertId} className={td + ' text-center ' + (Math.abs(e.sum - 1) <= 1e-9 ? 'text-ok' : 'text-bad')}>
                    {fmt.num(e.sum, 4)}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </TableWrap>
        {open && (() => {
          const e = w.perExpert.find((x) => x.expertId === open)!;
          return (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-line p-3 text-sm">
                <div className="mb-1 font-semibold">{t('رابطه ۲ — وزن گروه‌ها نزد {code}', { code: codeOf(p, e.expertId) })}</div>
                {w.retainedGroups.map((g) => (
                  <div key={g} className="flex justify-between">
                    <span>{p.groups.find((x) => x.id === g)?.name}</span>
                    <span className="tabular-nums">{fmt.num(e.groupWeight[g], 4)}</span>
                  </div>
                ))}
              </div>
              <div className="rounded-lg border border-line p-3 text-sm">
                <div className="mb-1 font-semibold">{t('رابطه ۱ — وزن درون‌گروهی')}</div>
                {w.retainedParams.map((id) => (
                  <div key={id} className="flex justify-between">
                    <span className="ltr">{pcode(id)}</span>
                    <span className="tabular-nums">{fmt.num(e.withinWeight[id], 4)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
      </Card>

      <Card title={t('رابطه ۴ و ۵: وزن هر حوزه و وزن نهایی')}>
        <TableWrap>
          <table className="sticky-table w-full text-sm">
            <thead>
              <tr>
                <th className={th}>{t('کد')}</th>
                <th className={th}>{t('پارامتر')}</th>
                {used.map((d) => (
                  <th key={d.id} className={th + ' text-center'}>
                    <DomainChip domain={d} />
                  </th>
                ))}
                <th className={th + ' text-center'}>Wᵢ</th>
                <th className={th + ' text-center'}>{t('Wᵢ×۱۰۰')}</th>
                <th className={th + ' text-center'}>{t('IQR وزن‌های فردی (Q1–Q3)')}</th>
              </tr>
            </thead>
            <tbody>
              {w.retainedParams.map((id) => (
                <tr key={id}>
                  <td className={td + ' ltr'}>{pcode(id)}</td>
                  <td className={td}>{p.params.find((x) => x.id === id)?.name}</td>
                  {used.map((d) => (
                    <td key={d.id} className={td + ' text-center tabular-nums'}>
                      {fmt.num(w.domainWeights[d.id]![id], 4)}
                    </td>
                  ))}
                  <td className={td + ' text-center font-semibold tabular-nums'}>{fmt.num(w.final[id], 4)}</td>
                  <td className={td + ' text-center tabular-nums'}>{fmt.num(100 * w.final[id], 2)}</td>
                  <td className={td + ' text-center tabular-nums whitespace-nowrap'}>
                    {fmt.num(w.agreement[id].iqr, 4)} ({fmt.num(w.agreement[id].q1, 4)}–{fmt.num(w.agreement[id].q3, 4)})
                  </td>
                </tr>
              ))}
              <tr className="font-semibold">
                <td className={td}>Σ</td>
                <td className={td} />
                {used.map((d) => (
                  <td key={d.id} className={td + ' text-center'}>
                    {fmt.num(Object.values(w.domainWeights[d.id]!).reduce((s, x) => s + x, 0), 4)}
                  </td>
                ))}
                <td className={td + ' text-center ' + (w.checks.finalSumOk ? 'text-ok' : 'text-bad')}>{fmt.num(w.checks.finalSum, 4)}</td>
                <td className={td + ' text-center'}>{fmt.num(100 * w.checks.finalSum, 2)}</td>
                <td className={td} />
              </tr>
            </tbody>
          </table>
        </TableWrap>
        <div className="mt-2 flex flex-wrap gap-2 text-sm">
          <Badge tone={w.checks.expertSumsOk ? 'ok' : 'bad'}>{w.checks.expertSumsOk ? t('✓ مجموع وزن‌های کلی هر خبره = ۱') : t('✗ مجموع وزن‌های یک خبره ۱ نیست')}</Badge>
          <Badge tone={w.checks.finalSumOk ? 'ok' : 'bad'}>{w.checks.finalSumOk ? t('✓ ΣWᵢ = ۱') : t('✗ ΣWᵢ ≠ ۱')}</Badge>
        </div>
      </Card>
    </div>
  );
}

function BriefTab() {
  const p = useProject();
  const fmt = useFmt();
  const go = useNav((s) => s.go);
  const w = useMemo(() => projectWeights(p), [p]);
  const rows = useMemo(() => round2Analysis(p), [p]);
  const retained = [...w.retainedParams].sort((a, b) => w.final[b] - w.final[a]);
  const send = () => {
    const weights = Object.fromEntries(w.retainedParams.map((id) => [id, w.final[id]]));
    const had = p.weighted.columns.length > 0;
    return edit(
      'ارسال وزن‌ها به بخش ب',
      (d) => {
        d.weighted.columns = w.retainedParams.map((id) => ({ paramId: id, weight: w.final[id] }));
        d.weighted.sentWeights = { at: new Date().toISOString(), weights };
      },
      {
        confirm: had
          ? { title: t('جایگزینی ستون‌های ماتریس وزن‌دار'), items: [t('ستون‌ها و وزن‌های فعلی ماتریس پیو وزن‌دار (از جمله ویرایش‌های دستی) با پارامترهای حفظ‌شده و Wᵢ فعلی جایگزین می‌شوند. امتیازهای واردشده برای پارامترهای باقی‌مانده حفظ می‌شوند.')], confirmLabel: t('جایگزین شود') }
          : undefined,
        preview: true,
      },
    ).then((ok) => ok && go('weighted'));
  };
  const briefHtml = () => {
    const r = new ReportBuilder(fmt, p.captions);
    r.h1('تفهیم‌نامه طراحی اگزواسکلتون');
    r.p(`${p.title} — ${fmt.date(new Date().toISOString())}`, 'meta');
    briefSection(r, p);
    return r.document('تفهیم‌نامه طراحی');
  };
  if (!rows.length || !respondents(p, 'r2').length) return <Empty>{t('پس از ورود پاسخ‌های دور دوم، تفهیم‌نامه طراحی ساخته می‌شود.')}</Empty>;
  return (
    <div className="space-y-4">
      <Card
        title={t('تفهیم‌نامه طراحی (Design Brief)')}
        actions={
          <>
            <Button icon="print" onClick={() => openReport(briefHtml(), 'design-brief.html', downloadText)}>
              {t('نمایش و چاپ')}
            </Button>
            <Button icon="refresh" variant="primary" disabled={!retained.length || !w.checks.finalSumOk} onClick={send}>
              {t('ارسال وزن‌ها به بخش ب')}
            </Button>
          </>
        }
      >
        {p.weighted.sentWeights && <p className="mb-2 text-xs text-muted">{t('آخرین ارسال به بخش ب: {date}', { date: fmt.date(p.weighted.sentWeights.at) })}</p>}
        <TableWrap>
          <table className="sticky-table w-full text-sm">
            <thead>
              <tr>
                <th className={th}>{t('رتبه')}</th>
                <th className={th}>{t('کد')}</th>
                <th className={th}>{t('پارامتر')}</th>
                <th className={th}>{t('گروه')}</th>
                <th className={th}>{t('الزام طراحی')}</th>
                <th className={th + ' text-center'}>Wᵢ</th>
                <th className={th + ' text-center'}>{t('٪')}</th>
                <th className={th + ' text-center'}>{t('IQR وزن')}</th>
              </tr>
            </thead>
            <tbody>
              {retained.map((id, i) => {
                const x = p.params.find((q) => q.id === id)!;
                return (
                  <tr key={id}>
                    <td className={td + ' text-center'}>{fmt.int(i + 1)}</td>
                    <td className={td + ' ltr'}>{x.code}</td>
                    <td className={td}>{x.name}</td>
                    <td className={td}>{p.groups.find((g) => g.id === x.groupId)?.name}</td>
                    <td className={td + ' text-xs'}>{x.requirement}</td>
                    <td className={td + ' text-center font-semibold tabular-nums'}>{fmt.num(w.final[id], 4)}</td>
                    <td className={td + ' text-center tabular-nums'}>{fmt.num(100 * w.final[id], 2)}</td>
                    <td className={td + ' text-center tabular-nums whitespace-nowrap'}>{fmt.num(w.agreement[id].iqr, 4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      </Card>
      {(['remove', 'none'] as const).map((s) => {
        const list = rows.filter((r) => r.consensus.status === s);
        return (
          <Card key={s} title={s === 'remove' ? t('پارامترهای حذف‌شده ({n})', { n: fmt.int(list.length) }) : t('پارامترهای فاقد اجماع ({n})', { n: fmt.int(list.length) })}>
            {list.length === 0 ? (
              <p className="text-sm text-muted">{t('موردی نیست.')}</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {list.map((r) => (
                  <Fragment key={r.param.id}>
                    <li>
                      <span className="ltr font-semibold">{r.param.code}</span> {r.param.name} —{' '}
                      <span className="text-muted">
                        {p.scale.bands.map((b, i) => `${b.label} ${fmt.pct(r.overall.percents[i])}`).join(t('، '))} (n={fmt.int(r.overall.n)})
                      </span>
                    </li>
                  </Fragment>
                ))}
              </ul>
            )}
          </Card>
        );
      })}
    </div>
  );
}

export function WeightsScreen() {
  const p = useProject();
  const fmt = useFmt();
  const [tab, setTab] = useState<'consensus' | 'weights' | 'brief'>('consensus');
  const report = () => {
    const r = new ReportBuilder(fmt, p.captions);
    r.h1('اجماع و وزن‌دهی پارامترها');
    r.p(`${p.title} — ${fmt.date(new Date().toISOString())}`, 'meta');
    consensusSection(r, p);
    weightsSection(r, p);
    briefSection(r, p);
    return r.document('اجماع و وزن‌ها');
  };
  return (
    <div className="space-y-4">
      <PageTitle
        title={t('اجماع و وزن‌ها')}
        subtitle={t('معیار اجماع ازپیش‌تعیین‌شده فقط روی امتیازهای دور دوم اعمال می‌شود. وزن‌ها تنها برای پارامترهای حفظ‌شده با روابط ۱ تا ۵ از توزیع سلسله‌مراتبی امتیاز محاسبه می‌شوند.')}
        actions={
          <Button icon="print" onClick={() => openReport(report(), 'consensus-weights.html', downloadText)}>
            {t('گزارش این مرحله')}
          </Button>
        }
      />
      <Tabs
        tabs={[
          { id: 'consensus', label: t('پنل و اجماع') },
          { id: 'weights', label: t('وزن‌ها (روابط ۱ تا ۵)') },
          { id: 'brief', label: t('تفهیم‌نامه طراحی') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'consensus' && <ConsensusTab />}
      {tab === 'weights' && <WeightsTab />}
      {tab === 'brief' && <BriefTab />}
    </div>
  );
}
