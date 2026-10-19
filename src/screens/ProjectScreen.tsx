/** Step 1 — project & settings: title, rating scale, consensus rule, panel, schedule, Part B, consent, files. */
import { useState } from 'react';
import {
  consensusHelper,
  newId,
  respondents,
  validateScale,
  validateThresholds,
  type ConsensusThresholds,
  type RoundKey,
  type Settings,
} from '../core';
import { edit } from '../app/edit';
import { settingsDeviations } from '../app/deviations';
import { useProject, useStore } from '../state/store';
import { parseIdentityKey, serializeIdentityKey, serializeProject } from '../io/projectFile';
import { downloadText, safeFileName, stamp } from '../io/download';
import { confirmDialog, toast } from '../ui/dialogs';
import { useFmt } from '../ui/format';
import { Button, Callout, Card, Checkbox, DateInput, Field, FilePick, IconButton, NumberInput, PageTitle, TableWrap, TextArea, TextInput, td, th } from '../ui/kit';

type SettingsDraft = (s: Settings) => void;
const setSettings = (label: string, f: SettingsDraft, preview = false) => edit(label, (d) => f(d.settings as Settings), { preview });

function ScaleCard() {
  const p = useProject();
  const fmt = useFmt();
  const s = p.scale;
  const problems = validateScale(s);
  return (
    <Card title="مقیاس امتیازدهی اهمیت (دلفی)">
      <p className="mb-3 text-sm text-muted">
        پیش‌فرض طرح: مقیاس ۹ درجه‌ای با سه طبقه ۱ تا ۳ «کم‌اهمیت»، ۴ تا ۶ «مهم اما نه حیاتی» و ۷ تا ۹ «حیاتی». قاعده اجماع فقط طبقه اول (پایین) و آخر (بالا) را می‌خواند.
      </p>
      <div className="grid max-w-md grid-cols-2 gap-3">
        <Field label="کمینه مقیاس">
          <NumberInput value={s.min} integer lazy onChange={(v) => v !== null && edit('تغییر کمینه مقیاس', (d) => void (d.scale.min = v), { preview: true })} />
        </Field>
        <Field label="بیشینه مقیاس">
          <NumberInput value={s.max} integer lazy onChange={(v) => v !== null && edit('تغییر بیشینه مقیاس', (d) => void (d.scale.max = v), { preview: true })} />
        </Field>
      </div>
      <TableWrap>
        <table className="mt-3 w-full text-sm">
          <thead>
            <tr>
              <th className={th}>طبقه</th>
              <th className={th}>برچسب</th>
              <th className={th}>از</th>
              <th className={th}>تا</th>
              <th className={th} />
            </tr>
          </thead>
          <tbody>
            {s.bands.map((b, i) => (
              <tr key={b.id}>
                <td className={td}>{i === 0 ? 'پایین' : i === s.bands.length - 1 ? 'بالا' : `میانی ${fmt.int(i)}`}</td>
                <td className={td}>
                  <TextInput value={b.label} onChange={(v) => edit('تغییر برچسب طبقه', (d) => void (d.scale.bands[i].label = v))} aria-label="برچسب طبقه" />
                </td>
                <td className={td + ' w-24'}>
                  <NumberInput value={b.from} integer lazy onChange={(v) => v !== null && edit('تغییر مرز طبقه', (d) => void (d.scale.bands[i].from = v), { preview: true })} aria-label="شروع طبقه" />
                </td>
                <td className={td + ' w-24'}>
                  <NumberInput value={b.to} integer lazy onChange={(v) => v !== null && edit('تغییر مرز طبقه', (d) => void (d.scale.bands[i].to = v), { preview: true })} aria-label="پایان طبقه" />
                </td>
                <td className={td + ' w-10'}>
                  <IconButton
                    icon="trash"
                    tone="danger"
                    label="حذف طبقه"
                    disabled={s.bands.length <= 2}
                    onClick={() => edit('حذف طبقه مقیاس', (d) => void d.scale.bands.splice(i, 1), { preview: true })}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Button
          size="sm"
          icon="plus"
          onClick={() =>
            edit('افزودن طبقه مقیاس', (d) => {
              const last = d.scale.bands[d.scale.bands.length - 1];
              d.scale.bands.push({ id: newId('b_'), label: 'طبقه جدید', from: last.to + 1, to: last.to + 1 });
            })
          }
        >
          افزودن طبقه
        </Button>
        <Checkbox
          checked={s.allowCannotJudge}
          onChange={(v) => edit('گزینه توانایی قضاوت ندارم', (d) => void (d.scale.allowCannotJudge = v), { preview: true })}
          label="گزینه «توانایی قضاوت ندارم» (پاسخ نامعتبر؛ از مخرج حذف می‌شود)"
        />
      </div>
      {s.allowCannotJudge && (
        <Field label="برچسب گزینه" className="mt-2 max-w-sm">
          <TextInput value={s.cannotJudgeLabel} onChange={(v) => edit('برچسب توانایی قضاوت ندارم', (d) => void (d.scale.cannotJudgeLabel = v))} />
        </Field>
      )}
      {problems.length > 0 && (
        <Callout tone="bad" className="mt-3" title="مقیاس معتبر نیست">
          طبقه‌ها باید به‌ترتیب، پیوسته و بدون هم‌پوشانی باشند و کل دامنه {fmt.int(s.min)} تا {fmt.int(s.max)} را بپوشانند؛ دست‌کم دو طبقه لازم است.
        </Callout>
      )}
    </Card>
  );
}

function ConsensusCard() {
  const p = useProject();
  const fmt = useFmt();
  const c = p.settings.consensus;
  const nDefault = respondents(p, 'r2').length || p.experts.filter((e) => e.active).length || p.settings.panel.target;
  const [n, setN] = useState<number | null>(null);
  const nn = n ?? nDefault;
  const h = consensusHelper(nn, c);
  const problems = validateThresholds(c);
  const set = (k: keyof ConsensusThresholds) => (v: number | null) =>
    v !== null && setSettings('تغییر آستانه اجماع', (s) => void (s.consensus[k] = v), true);
  const top = p.scale.bands[p.scale.bands.length - 1];
  const bottom = p.scale.bands[0];
  const range = (b: typeof top) => `${fmt.int(b.from)} تا ${fmt.int(b.to)}`;
  return (
    <Card title="معیار اجماع (روی امتیازهای دور دوم)">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-line p-3">
          <div className="mb-2 font-semibold">اجماع بر حفظ</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`حداقل ٪ در طبقه بالا (${range(top)})`}>
              <NumberInput value={c.retainTopMin} min={0} max={100} lazy onChange={set('retainTopMin')} />
            </Field>
            <Field label={`حداکثر ٪ در طبقه پایین (${range(bottom)})`}>
              <NumberInput value={c.retainBottomMax} min={0} max={100} lazy onChange={set('retainBottomMax')} />
            </Field>
          </div>
        </div>
        <div className="rounded-lg border border-line p-3">
          <div className="mb-2 font-semibold">اجماع بر حذف</div>
          <div className="grid grid-cols-2 gap-3">
            <Field label={`حداقل ٪ در طبقه پایین (${range(bottom)})`}>
              <NumberInput value={c.removeBottomMin} min={0} max={100} lazy onChange={set('removeBottomMin')} />
            </Field>
            <Field label={`حداکثر ٪ در طبقه بالا (${range(top)})`}>
              <NumberInput value={c.removeTopMax} min={0} max={100} lazy onChange={set('removeTopMax')} />
            </Field>
          </div>
        </div>
      </div>
      <p className="mt-2 text-sm text-muted">سایر حالت‌ها «فاقد اجماع» است. درصدها روی پاسخ‌های معتبر است؛ مقایسه با حساب عدد صحیح انجام می‌شود (count×۱۰۰ ≥ آستانه×n). میانه و دامنه بین چارکی فقط توصیفی‌اند.</p>
      <div className="mt-3 rounded-lg bg-surface-2 p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span>با n =</span>
          <NumberInput value={nn} integer min={1} max={999} onChange={(v) => setN(v)} className="w-20" aria-label="تعداد پاسخ معتبر" />
          <span>پاسخ معتبر:</span>
        </div>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          <li>
            حفظ: دست‌کم <b>{fmt.int(h.retainMinTop)}</b> پاسخ در طبقه بالا و حداکثر <b>{fmt.int(h.retainMaxBottom)}</b> پاسخ در طبقه پایین
          </li>
          <li>
            حذف: دست‌کم <b>{fmt.int(h.removeMinBottom)}</b> پاسخ در طبقه پایین و حداکثر <b>{fmt.int(h.removeMaxTop)}</b> پاسخ در طبقه بالا
          </li>
        </ul>
      </div>
      {problems.length > 0 && (
        <Callout tone="bad" className="mt-3" title="آستانه‌ها با هم تعارض دارند">
          با این مقادیر یک پارامتر می‌تواند هم‌زمان معیار حفظ و حذف را داشته باشد (یا مقداری خارج از ۰ تا ۱۰۰ است). چنین پارامتری «فاقد اجماع (تعارض معیارها)» گزارش می‌شود.
        </Callout>
      )}
      <div className="mt-4 max-w-xs">
        <Field label="آستانه افزودن پارامتر جدید از پاسخ‌های باز (٪ پاسخ‌دهندگان دور اول)">
          <NumberInput value={p.settings.candidatePct} min={0} max={100} lazy onChange={(v) => v !== null && setSettings('آستانه پارامتر جدید', (s) => void (s.candidatePct = v), true)} />
        </Field>
      </div>
    </Card>
  );
}

function PanelCard() {
  const p = useProject();
  const pn = p.settings.panel;
  const num = (label: string, k: keyof typeof pn) => (
    <Field label={label}>
      <NumberInput value={pn[k]} integer min={0} onChange={(v) => v !== null && setSettings('تنظیم اندازه پنل', (s) => void (s.panel[k] = v))} />
    </Field>
  );
  return (
    <Card title="اندازه پنل">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        {num('هدف کل', 'target')}
        {num('هدف هر حوزه', 'targetPerDomain')}
        {num('دامنه قابل‌پذیرش: از', 'acceptableMin')}
        {num('تا', 'acceptableMax')}
        {num('حداقل نهایی کل', 'minTotal')}
        {num('حداقل هر حوزه', 'minPerDomain')}
      </div>
      <p className="mt-2 text-sm text-muted">طبق طرح: هدف ۱۵ نفر (۵ نفر از هر حوزه)، دامنه ۱۲ تا ۱۸، حداقل نهایی پس از افت ۹ نفر با دست‌کم ۳ نفر از هر حوزه؛ پیش از تحلیل دور دوم بررسی و در صورت عدم رعایت هشدار داده می‌شود.</p>
    </Card>
  );
}

function ScheduleCard() {
  const p = useProject();
  const fmt = useFmt();
  const rounds: { k: RoundKey; t: string }[] = [
    { k: 'r1', t: 'دور اول دلفی' },
    { k: 'r2', t: 'دور دوم دلفی' },
    { k: 'pugh', t: 'امتیازدهی ماتریس وزن‌دار' },
  ];
  const addDays = (iso: string, n: number) => new Date(Date.parse(iso + 'T12:00:00') + n * 86400000).toISOString().slice(0, 10);
  return (
    <Card title="زمان‌بندی دورها">
      <p className="mb-3 text-sm text-muted">مهلت پاسخ هر دور دو تا سه هفته با ارسال یادآور است و در صورت نیاز تمدید می‌شود.</p>
      <div className="space-y-4">
        {rounds.map(({ k, t }) => {
          const sc = p.settings.schedule[k];
          const set = (f: (x: typeof sc) => void) => setSettings('زمان‌بندی', (s) => f(s.schedule[k]));
          return (
            <div key={k} className="rounded-lg border border-line p-3">
              <div className="mb-2 font-semibold">{t}</div>
              <div className="flex flex-wrap items-end gap-4">
                <Field label="شروع">
                  <DateInput value={sc.opens} onChange={(v) => set((x) => void (x.opens = v))} />
                </Field>
                <Field label="مهلت">
                  <DateInput value={sc.deadline} onChange={(v) => set((x) => void (x.deadline = v))} />
                </Field>
                {sc.opens && (
                  <span className="flex gap-1 pb-1">
                    <Button size="sm" onClick={() => set((x) => void (x.deadline = addDays(sc.opens!, 14)))}>
                      +۲ هفته
                    </Button>
                    <Button size="sm" onClick={() => set((x) => void (x.deadline = addDays(sc.opens!, 21)))}>
                      +۳ هفته
                    </Button>
                  </span>
                )}
                <Field label="تمدید تا">
                  <DateInput value={sc.extendedTo} onChange={(v) => set((x) => void (x.extendedTo = v))} />
                </Field>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
                <span className="text-muted">یادآورها:</span>
                {sc.reminders.map((r, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <DateInput value={r} onChange={(v) => set((x) => (v ? void (x.reminders[i] = v) : void x.reminders.splice(i, 1)))} />
                    <IconButton icon="x" label="حذف یادآور" onClick={() => set((x) => void x.reminders.splice(i, 1))} />
                  </span>
                ))}
                <Button size="sm" icon="plus" onClick={() => set((x) => void x.reminders.push(sc.deadline ? addDays(sc.deadline, -3) : new Date().toISOString().slice(0, 10)))}>
                  یادآور
                </Button>
              </div>
              {sc.deadline && <div className="mt-1 text-xs text-muted">مهلت: {fmt.date(sc.extendedTo ?? sc.deadline)}</div>}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function PartBCard() {
  const p = useProject();
  const st = p.settings;
  const fmt = useFmt();
  return (
    <Card title="تنظیمات بخش ب (انتخاب کانسپت)">
      <div className="grid gap-3 md:grid-cols-5">
        {st.valueLabels.map((l, i) => (
          <Field key={i} label={`مقیاس ارزش — ${fmt.int(i + 1)}`}>
            <TextInput value={l} onChange={(v) => setSettings('برچسب مقیاس ارزش', (s) => void (s.valueLabels[i] = v))} />
          </Field>
        ))}
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <Field label="آستانه تحلیل حساسیت (٪ دامنه مقیاس)" hint="طبق طرح ۱۰٪ (یعنی ۰٫۴ روی ۱ تا ۵)">
          <NumberInput value={st.sensitivity.pctOfRange} min={0} max={100} lazy onChange={(v) => v !== null && setSettings('آستانه حساسیت', (s) => void (s.sensitivity.pctOfRange = v), true)} />
        </Field>
        <Field label="تغییر هر وزن (٪)" hint="طبق طرح ۲۰٪ افزایش و ۲۰٪ کاهش">
          <NumberInput value={st.sensitivity.step * 100} min={1} max={100} lazy onChange={(v) => v !== null && setSettings('گام حساسیت', (s) => void (s.sensitivity.step = v / 100), true)} />
        </Field>
        <Field label="حداکثر کانسپت راه‌یافته" hint="طبق طرح ۴">
          <NumberInput value={st.maxForward} integer min={1} lazy onChange={(v) => v !== null && setSettings('حداکثر کانسپت', (s) => void (s.maxForward = v), true)} />
        </Field>
        <Field label="حداقل کانسپت راه‌یافته" hint="طبق طرح ۲">
          <NumberInput value={st.minForward} integer min={1} lazy onChange={(v) => v !== null && setSettings('حداقل کانسپت', (s) => void (s.minForward = v), true)} />
        </Field>
      </div>
      <Checkbox
        className="mt-3"
        checked={st.sensitivity.alwaysRun}
        onChange={(v) => setSettings('اجرای همیشگی تحلیل حساسیت', (s) => void (s.sensitivity.alwaysRun = v))}
        label="تحلیل حساسیت همیشه اجرا شود (اگر شرط طرح برقرار نباشد، با برچسب «تکمیلی» گزارش می‌شود)"
      />
    </Card>
  );
}

function ConsentCard() {
  const p = useProject();
  const fmt = useFmt();
  return (
    <Card title="متن رضایت آگاهانه و توصیف پنل">
      <p className="mb-2 text-sm text-muted">در ابتدای هر فایل پرسش‌نامه و پیش از نمایش پرسش‌ها نمایش داده می‌شود؛ پرسش‌ها پس از انتخاب «موافقم» دیده می‌شوند.</p>
      <TextArea value={p.settings.consentText} rows={8} onChange={(v) => setSettings('متن رضایت آگاهانه', (s) => void (s.consentText = v))} aria-label="متن رضایت" />
      <Field label="مرزهای دامنه سابقه کار برای توصیف پنل (سال، با ویرگول)" className="mt-3 max-w-md" hint={`دامنه‌ها: ${['<' + (p.settings.experienceEdges[0] ?? ''), ...p.settings.experienceEdges.map((e, i, a) => (i < a.length - 1 ? `${e}–${a[i + 1] - 1}` : `≥${e}`))].map(fmt.digits).join('، ')}`}>
        <TextInput
          ltr
          value={p.settings.experienceEdges.join(', ')}
          onChange={(v) => {
            const edges = v
              .split(/[,،\s]+/)
              .map((x) => Number(x.replace(/[۰-۹]/g, (c) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))))
              .filter((x) => Number.isFinite(x) && x > 0);
            if (edges.length && edges.every((x, i) => i === 0 || x > edges[i - 1])) setSettings('دامنه‌های سابقه کار', (s) => void (s.experienceEdges = edges));
          }}
        />
      </Field>
    </Card>
  );
}

function FilesCard() {
  const p = useProject();
  const identities = useStore((s) => s.identities);
  return (
    <Card title="فایل پروژه و کلید هویت">
      <p className="mb-3 text-sm text-muted">
        فایل پروژه (.json) همه داده‌ها و تنظیمات را دارد به‌جز نام، اطلاعات تماس و یادداشت‌های خبرگان. این‌ها طبق ملاحظات اخلاقی طرح در «فایل کلید هویت» جداگانه نگهداری می‌شوند. برای پشتیبان‌گیری کامل هر دو فایل را نگه دارید.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button icon="download" variant="primary" onClick={() => downloadText(serializeProject(p), `${safeFileName(p.title)}_${stamp()}.json`)}>
          خروجی فایل پروژه (.json)
        </Button>
        <Button icon="download" onClick={() => downloadText(serializeIdentityKey(p, identities), `${safeFileName(p.title)}_identity-key_${stamp()}.json`)}>
          خروجی فایل کلید هویت
        </Button>
        <FilePick
          accept=".json,application/json"
          onFiles={async ([f]) => {
            const r = parseIdentityKey(await f.text(), p);
            if (r.error || !r.identities) return toast('این فایل، فایل کلید هویت معتبر نیست.', { tone: 'bad' });
            const ok = await confirmDialog({
              title: 'بارگذاری کلید هویت',
              items: [
                `${r.matched} خبره تطبیق یافت`,
                ...(r.unmatched ? [`${r.unmatched} ردیف بدون خبره متناظر (نادیده گرفته می‌شود)`] : []),
                ...(r.otherProject ? ['هشدار: این کلید برای پروژه دیگری ساخته شده است (تطبیق با کد خبره انجام شد).'] : []),
              ],
              confirmLabel: 'جایگزینی نام‌ها',
            });
            if (ok.ok) useStore.getState().replaceIdentities({ ...useStore.getState().identities, ...r.identities });
          }}
        >
          بارگذاری فایل کلید هویت
        </FilePick>
      </div>
    </Card>
  );
}

function ChangeLogCard() {
  const p = useProject();
  const fmt = useFmt();
  const dev = settingsDeviations(p);
  const [all, setAll] = useState(false);
  const rows = [...p.changeLog].reverse();
  return (
    <Card title="دفتر تغییرات پس از شروع گردآوری داده">
      {p.settingsSnapshot ? (
        <p className="mb-2 text-sm text-muted">تنظیمات در {fmt.date(p.settingsSnapshot.at)} (ورود نخستین پاسخ دور اول) ثبت و مبنای مقایسه قرار گرفت.</p>
      ) : (
        <p className="mb-2 text-sm text-muted">هنوز پاسخی ثبت نشده است؛ ثبت تغییرات با ورود نخستین پاسخ دور اول آغاز می‌شود.</p>
      )}
      {dev.length > 0 && (
        <Callout tone="warn" className="mb-3" title="تغییر معیارها پس از شروع گردآوری داده (در گزارش پایان‌نامه اعلام می‌شود)">
          <ul className="list-disc ps-5">
            {dev.map((d) => (
              <li key={d}>{fmt.digits(d)}</li>
            ))}
          </ul>
        </Callout>
      )}
      {rows.length > 0 && (
        <TableWrap maxHeight="40vh">
          <table className="sticky-table w-full text-sm">
            <thead>
              <tr>
                <th className={th}>زمان</th>
                <th className={th}>تغییر</th>
                <th className={th}>جزئیات</th>
                <th className={th}>دلیل</th>
              </tr>
            </thead>
            <tbody>
              {(all ? rows : rows.slice(0, 30)).map((r) => (
                <tr key={r.id}>
                  <td className={td + ' whitespace-nowrap text-xs text-muted'}>
                    {fmt.date(r.at)} {fmt.digits(new Date(r.at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))}
                  </td>
                  <td className={td}>{r.action}</td>
                  <td className={td + ' text-xs text-muted'}>{r.detail}</td>
                  <td className={td + ' text-xs'}>{r.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableWrap>
      )}
      {rows.length > 30 && (
        <Button size="sm" className="mt-2" onClick={() => setAll(!all)}>
          {all ? 'نمایش کمتر' : `نمایش همه (${fmt.int(rows.length)})`}
        </Button>
      )}
    </Card>
  );
}

export function ProjectScreen() {
  const p = useProject();
  return (
    <div className="space-y-5">
      <PageTitle title="پروژه و تنظیمات" subtitle="همه مقادیر پیش‌فرض از طرح پژوهش گرفته شده‌اند و در هر زمان قابل ویرایش‌اند. اگر تغییری روی داده‌های واردشده اثر بگذارد، پیش از اعمال، اثر آن نمایش داده می‌شود." />
      <Card title="عنوان پروژه">
        <TextInput value={p.title} onChange={(v) => edit('عنوان پروژه', (d) => void (d.title = v))} aria-label="عنوان پروژه" />
      </Card>
      <ScaleCard />
      <ConsensusCard />
      <PanelCard />
      <ScheduleCard />
      <PartBCard />
      <ConsentCard />
      <FilesCard />
      <ChangeLogCard />
    </div>
  );
}
