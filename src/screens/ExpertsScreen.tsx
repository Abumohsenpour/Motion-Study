/**
 * Step 2 — domains and experts. Names, contact details and notes are the researcher's private data: they are
 * shown only on this screen and stored apart from the project (DECISIONS C1). Everything else uses codes.
 */
import { Fragment, useState } from 'react';
import { inclusionWarnings, newExpert, newId, nextExpertCode, PALETTE, type Expert, type Project, type RoundKey, type RoundState } from '../core';
import { edit } from '../app/edit';
import { useProject, useStore } from '../state/store';
import { usePrefs } from '../state/prefs';
import { toast } from '../ui/dialogs';
import { useFmt } from '../ui/format';
import {
  Badge,
  Button,
  Callout,
  Card,
  Checkbox,
  ColorPicker,
  DateInput,
  DomainChip,
  Field,
  IconButton,
  NumberInput,
  PageTitle,
  Reorder,
  Select,
  TableWrap,
  TextArea,
  TextInput,
  td,
  th,
} from '../ui/kit';

const move = <T,>(arr: T[], i: number, j: number) => {
  const [x] = arr.splice(i, 1);
  arr.splice(j, 0, x);
};

const STATE_LABEL: Record<RoundState, string> = {
  none: '—',
  invited: 'دعوت‌شده',
  consented: 'رضایت داده',
  responded: 'پاسخ داده',
  withdrew: 'انصراف',
};
const ROUND_LABEL: Record<RoundKey, string> = { r1: 'دور اول', r2: 'دور دوم', pugh: 'ماتریس وزن‌دار' };

function DomainsCard() {
  const p = useProject();
  return (
    <Card
      title="حوزه‌های تخصصی"
      actions={
        <Button
          size="sm"
          icon="plus"
          onClick={() =>
            edit('افزودن حوزه', (d) => {
              const used = new Set(d.domains.map((x) => x.color.toLowerCase()));
              d.domains.push({
                id: newId('d_'),
                name: 'حوزه جدید',
                shortLabel: 'ح',
                color: PALETTE.find((c) => !used.has(c.toLowerCase())) ?? PALETTE[3],
                inclusionCriteria: '',
                minYears: null,
              });
            })
          }
        >
          افزودن حوزه
        </Button>
      }
    >
      <p className="mb-3 text-sm text-muted">رنگ هر حوزه در نمودارها و جدول‌ها همراه با برچسب کوتاه آن نمایش داده می‌شود تا رنگ تنها نشانه نباشد. پالت پیش‌فرض برای کوررنگی ایمن است.</p>
      <div className="space-y-3">
        {p.domains.map((dm, i) => {
          const n = p.experts.filter((e) => e.domainId === dm.id).length;
          return (
            <div key={dm.id} className="rounded-lg border border-line p-3">
              <div className="flex flex-wrap items-end gap-3">
                <DomainChip domain={dm} />
                <Field label="نام حوزه" className="min-w-64 flex-1">
                  <TextInput value={dm.name} onChange={(v) => edit('نام حوزه', (d) => void (d.domains[i].name = v))} />
                </Field>
                <Field label="برچسب کوتاه" className="w-24">
                  <TextInput value={dm.shortLabel} onChange={(v) => edit('برچسب کوتاه حوزه', (d) => void (d.domains[i].shortLabel = v.slice(0, 3)))} />
                </Field>
                <Field label="رنگ">
                  <ColorPicker value={dm.color} onChange={(v) => edit('رنگ حوزه', (d) => void (d.domains[i].color = v))} />
                </Field>
                <span className="ms-auto flex items-center">
                  <Reorder
                    first={i === 0}
                    last={i === p.domains.length - 1}
                    onUp={() => edit('ترتیب حوزه‌ها', (d) => move(d.domains, i, i - 1))}
                    onDown={() => edit('ترتیب حوزه‌ها', (d) => move(d.domains, i, i + 1))}
                  />
                  <IconButton
                    icon="trash"
                    tone="danger"
                    label="حذف حوزه"
                    onClick={() => {
                      if (n > 0) return toast(`این حوزه ${n} خبره دارد؛ ابتدا آن‌ها را به حوزه دیگری منتقل یا حذف کنید.`, { tone: 'bad' });
                      edit('حذف حوزه', (d) => void d.domains.splice(i, 1), { undoToast: `حوزه «${dm.name}» حذف شد` });
                    }}
                  />
                </span>
              </div>
              <div className="mt-2 grid gap-3 md:grid-cols-[1fr_10rem]">
                <Field label="معیار ورود خبرگان این حوزه">
                  <TextArea rows={2} value={dm.inclusionCriteria} onChange={(v) => edit('معیار ورود حوزه', (d) => void (d.domains[i].inclusionCriteria = v))} />
                </Field>
                <Field label="حداقل سال تجربه (اختیاری)" hint="خبره کمتر از آن هشدار می‌گیرد">
                  <NumberInput value={dm.minYears} min={0} onChange={(v) => edit('حداقل سال تجربه حوزه', (d) => void (d.domains[i].minYears = v))} />
                </Field>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PanelProgress() {
  const p = useProject();
  const fmt = useFmt();
  const pn = p.settings.panel;
  const active = p.experts.filter((e) => e.active && !e.excludeAllData);
  const inRange = active.length >= pn.acceptableMin && active.length <= pn.acceptableMax;
  return (
    <Card title="ترکیب پنل (خبرگان فعال)">
      <div className="grid gap-3 md:grid-cols-4">
        {p.domains.map((dm) => {
          const n = active.filter((e) => e.domainId === dm.id).length;
          const pct = Math.min(100, (100 * n) / Math.max(1, pn.targetPerDomain));
          return (
            <div key={dm.id} className="rounded-lg border border-line p-3">
              <div className="flex items-center justify-between gap-2 text-sm">
                <DomainChip domain={dm} withName />
              </div>
              <div className="mt-2 h-2 rounded bg-surface-2">
                <div className="h-2 rounded" style={{ width: `${pct}%`, background: dm.color }} />
              </div>
              <div className="mt-1 text-xs text-muted">
                {fmt.int(n)} از هدف {fmt.int(pn.targetPerDomain)} — حداقل {fmt.int(pn.minPerDomain)}{' '}
                {n < pn.minPerDomain ? <Badge tone="bad">کمتر از حداقل</Badge> : n >= pn.targetPerDomain ? <Badge tone="ok">کامل</Badge> : null}
              </div>
            </div>
          );
        })}
        <div className="rounded-lg border border-line p-3 text-sm">
          <div className="font-semibold">کل پنل: {fmt.int(active.length)}</div>
          <div className="text-xs text-muted">
            هدف {fmt.int(pn.target)}، دامنه {fmt.int(pn.acceptableMin)}–{fmt.int(pn.acceptableMax)}، حداقل {fmt.int(pn.minTotal)}
          </div>
          <div className="mt-1">{inRange ? <Badge tone="ok">در دامنه قابل‌پذیرش</Badge> : <Badge tone="warn">خارج از دامنه قابل‌پذیرش</Badge>}</div>
        </div>
      </div>
    </Card>
  );
}

function hasData(p: Project, id: string) {
  return !!p.responses.r1[id] || !!p.responses.r2[id] || !!p.weighted.scores[id];
}

/** Removes an expert and everything recorded for them. */
function deleteExpert(d: Project, id: string) {
  d.experts = d.experts.filter((e) => e.id !== id);
  delete d.responses.r1[id];
  delete d.responses.r2[id];
  delete d.weighted.scores[id];
  delete d.weighted.blinding[id];
  for (const k of Object.keys(d.codings)) if (k.startsWith(id + '|')) delete d.codings[k];
  if (d.r2Invited) d.r2Invited = d.r2Invited.filter((x) => x !== id);
  if (d.weighted.raterIds) d.weighted.raterIds = d.weighted.raterIds.filter((x) => x !== id);
}

function ExpertDetail({ e, i }: { e: Expert; i: number }) {
  const p = useProject();
  const ident = useStore((s) => s.identities[e.id]);
  const setIdentity = useStore((s) => s.setIdentity);
  const showNames = usePrefs((s) => s.showNames);
  const set = (label: string, f: (x: Expert) => void, preview = false) => edit(label, (d) => f(d.experts[i] as Expert), { preview });
  return (
    <div className="grid gap-4 bg-surface-2/60 p-3 md:grid-cols-3">
      <div className="space-y-2">
        <Field label="اطلاعات تماس (خصوصی)">
          {showNames ? <TextInput value={ident?.contact ?? ''} onChange={(v) => setIdentity(e.id, { contact: v })} /> : <span className="text-sm text-muted">پنهان</span>}
        </Field>
        <Field label="یادداشت (خصوصی)">
          {showNames ? <TextArea rows={2} value={ident?.notes ?? ''} onChange={(v) => setIdentity(e.id, { notes: v })} /> : <span className="text-sm text-muted">پنهان</span>}
        </Field>
      </div>
      <div className="space-y-2">
        <Field label="تاریخ رضایت">
          <DateInput value={e.consentDate} onChange={(v) => set('تاریخ رضایت', (x) => void (x.consentDate = v))} />
        </Field>
        <Field label="معیار ورود">
          <Select
            value={e.inclusionMet === null ? 'unk' : e.inclusionMet ? 'yes' : 'no'}
            onChange={(v) => set('معیار ورود خبره', (x) => void (x.inclusionMet = v === 'unk' ? null : v === 'yes'))}
            options={[
              { value: 'unk', label: 'بررسی نشده' },
              { value: 'yes', label: 'معیارهای ورود احراز شد' },
              { value: 'no', label: 'احراز نشد' },
            ]}
          />
        </Field>
        {p.domains.find((x) => x.id === e.domainId)?.inclusionCriteria && (
          <p className="text-xs text-muted">معیار حوزه: {p.domains.find((x) => x.id === e.domainId)!.inclusionCriteria}</p>
        )}
      </div>
      <div className="space-y-2">
        {(['r1', 'r2', 'pugh'] as RoundKey[]).map((k) => (
          <div key={k} className="flex flex-wrap items-center gap-2">
            <span className="w-28 text-sm text-muted">{ROUND_LABEL[k]}</span>
            <Select
              value={e.status[k].state}
              onChange={(v) =>
                set(`وضعیت ${ROUND_LABEL[k]}`, (x) => {
                  x.status[k] = { state: v, date: x.status[k].date ?? new Date().toISOString().slice(0, 10) };
                }, true)
              }
              options={(Object.keys(STATE_LABEL) as RoundState[]).map((s) => ({ value: s, label: STATE_LABEL[s] }))}
              className="w-32"
              aria-label={`وضعیت ${ROUND_LABEL[k]}`}
            />
            <DateInput value={e.status[k].date} onChange={(v) => set(`تاریخ وضعیت ${ROUND_LABEL[k]}`, (x) => void (x.status[k].date = v))} />
          </div>
        ))}
        <Checkbox
          checked={e.excludeAllData}
          onChange={(v) => set('مخالفت با استفاده از پاسخ‌های قبلی', (x) => void (x.excludeAllData = v), true)}
          label="انصراف داده و با استفاده از پاسخ‌های قبلی مخالف است (همه داده‌هایش از تحلیل‌ها حذف می‌شود)"
        />
      </div>
    </div>
  );
}

function ExpertsCard() {
  const p = useProject();
  const fmt = useFmt();
  const identities = useStore((s) => s.identities);
  const setIdentity = useStore((s) => s.setIdentity);
  const { showNames, setShowNames } = usePrefs();
  const [open, setOpen] = useState<string | null>(null);
  const warnings = inclusionWarnings(p);
  const codes = p.experts.map((e) => e.code.trim());
  const activities = [...new Set(['بالینی', 'دانشگاهی', 'صنعتی', 'پژوهشی', ...p.experts.map((e) => e.activityType).filter(Boolean)])];

  const add = (domainId: string) =>
    edit('افزودن خبره', (d) => {
      const code = nextExpertCode(
        d.experts.map((e) => e.code),
        d.expertCodeCounter,
      );
      d.expertCodeCounter = Number(code.slice(1));
      d.experts.push(newExpert(code, domainId));
    });

  return (
    <Card
      title={`خبرگان (${fmt.int(p.experts.length)})`}
      actions={
        <>
          <Button size="sm" icon={showNames ? 'eyeOff' : 'eye'} onClick={() => setShowNames(!showNames)}>
            {showNames ? 'پنهان‌کردن نام‌ها' : 'نمایش نام‌ها'}
          </Button>
          {p.domains.map((dm) => (
            <Button key={dm.id} size="sm" icon="plus" onClick={() => add(dm.id)}>
              {dm.shortLabel}
            </Button>
          ))}
        </>
      }
    >
      <p className="mb-3 text-sm text-muted">
        نام‌ها فقط در همین فهرست خصوصی پژوهشگر دیده می‌شوند و در هیچ خروجی دیگری نمی‌آیند؛ همه خروجی‌ها فقط کد خبره را دارند. دکمه‌های + خبره جدیدی در حوزه مربوط می‌سازند.
      </p>
      {p.domains.length === 0 && <Callout tone="warn">ابتدا دست‌کم یک حوزه تعریف کنید.</Callout>}
      {p.experts.length > 0 && (
        <TableWrap>
          <table className="sticky-table w-full text-sm">
            <thead>
              <tr>
                <th className={th}>کد</th>
                <th className={th}>نام (خصوصی)</th>
                <th className={th}>حوزه</th>
                <th className={th}>سال تجربه</th>
                <th className={th}>نوع فعالیت</th>
                <th className={th}>وضعیت دورها</th>
                <th className={th}>فعال</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {p.experts.map((e, i) => {
                const dup = codes.indexOf(e.code.trim()) !== i;
                const warn = warnings.filter((w) => w.expertId === e.id);
                return (
                  <Fragment key={e.id}>
                    <tr className={e.excludeAllData ? 'opacity-60' : undefined}>
                      <td className={td + ' w-24'}>
                        <TextInput ltr value={e.code} onChange={(v) => edit('کد خبره', (d) => void (d.experts[i].code = v.trim()))} aria-label="کد خبره" className={dup ? 'border-bad' : ''} />
                        {dup && <span className="text-xs text-bad">تکراری</span>}
                      </td>
                      <td className={td + ' min-w-44'}>
                        {showNames ? (
                          <TextInput value={identities[e.id]?.name ?? ''} onChange={(v) => setIdentity(e.id, { name: v })} aria-label="نام خبره" />
                        ) : (
                          <span className="text-muted">••••</span>
                        )}
                      </td>
                      <td className={td}>
                        <Select
                          value={e.domainId}
                          onChange={(v) => edit('تغییر حوزه خبره', (d) => void (d.experts[i].domainId = v), { preview: true })}
                          options={p.domains.map((dm) => ({ value: dm.id, label: `${dm.shortLabel} — ${dm.name}` }))}
                          className="min-w-40"
                          aria-label="حوزه"
                        />
                      </td>
                      <td className={td + ' w-24'}>
                        <NumberInput value={e.yearsExperience} min={0} onChange={(v) => edit('سال تجربه', (d) => void (d.experts[i].yearsExperience = v))} aria-label="سال تجربه" />
                      </td>
                      <td className={td + ' w-36'}>
                        <input
                          list="activity-types"
                          value={e.activityType}
                          onChange={(ev) => edit('نوع فعالیت', (d) => void (d.experts[i].activityType = ev.target.value))}
                          className="w-full rounded-md border border-line bg-surface px-2 py-1 text-sm"
                          aria-label="نوع فعالیت"
                        />
                      </td>
                      <td className={td}>
                        <span className="flex flex-wrap gap-1">
                          {(['r1', 'r2', 'pugh'] as RoundKey[]).map((k) => (
                            <Badge key={k} tone={e.status[k].state === 'responded' ? 'ok' : e.status[k].state === 'withdrew' ? 'bad' : 'neutral'}>
                              {k === 'r1' ? '۱' : k === 'r2' ? '۲' : 'پ'}: {STATE_LABEL[e.status[k].state]}
                            </Badge>
                          ))}
                          {e.excludeAllData && <Badge tone="bad">داده حذف</Badge>}
                          {warn.length > 0 && (
                            <Badge tone="warn">
                              {warn.map((w) => (w.reason === 'below-min-years' ? 'کمتر از حداقل سال تجربه' : 'معیار ورود احراز نشد')).join('، ')}
                            </Badge>
                          )}
                        </span>
                      </td>
                      <td className={td}>
                        <Checkbox checked={e.active} onChange={(v) => edit('فعال/غیرفعال‌کردن خبره', (d) => void (d.experts[i].active = v))} label={<span className="sr-only">فعال</span>} />
                      </td>
                      <td className={td + ' whitespace-nowrap'}>
                        <Button size="sm" variant="ghost" onClick={() => setOpen(open === e.id ? null : e.id)} aria-expanded={open === e.id}>
                          جزئیات
                        </Button>
                        <Reorder
                          first={i === 0}
                          last={i === p.experts.length - 1}
                          onUp={() => edit('ترتیب خبرگان', (d) => move(d.experts, i, i - 1))}
                          onDown={() => edit('ترتیب خبرگان', (d) => move(d.experts, i, i + 1))}
                        />
                        <IconButton
                          icon="trash"
                          tone="danger"
                          label="حذف خبره"
                          onClick={() =>
                            edit('حذف خبره', (d) => deleteExpert(d as Project, e.id), {
                              preview: true,
                              confirm: hasData(p, e.id)
                                ? { title: `حذف خبره ${e.code}`, items: ['همه پاسخ‌ها و امتیازهای این خبره نیز حذف می‌شود. برای نگه‌داشتن داده، به‌جای حذف «غیرفعال» کنید.'], confirmLabel: 'حذف' }
                                : undefined,
                              undoToast: `خبره ${e.code} حذف شد`,
                            })
                          }
                        />
                      </td>
                    </tr>
                    {open === e.id && (
                      <tr>
                        <td colSpan={8} className="border-b border-line p-0">
                          <ExpertDetail e={e} i={i} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </TableWrap>
      )}
      <datalist id="activity-types">
        {activities.map((a) => (
          <option key={a} value={a} />
        ))}
      </datalist>
    </Card>
  );
}

export function ExpertsScreen() {
  return (
    <div className="space-y-5">
      <PageTitle
        title="خبرگان و حوزه‌ها"
        subtitle="پنل از سه حوزه تخصصی تشکیل می‌شود (قابل تغییر). کد ناشناس هر خبره (E01، E02، …) خودکار ساخته می‌شود و تنها شناسه‌ای است که در خروجی‌ها و فایل‌های خبرگان می‌آید."
      />
      <DomainsCard />
      <PanelProgress />
      <ExpertsCard />
    </div>
  );
}
