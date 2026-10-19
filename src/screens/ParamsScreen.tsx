/** Step 3 — semantic groups and parameters (the Phase 1 output table), with Excel/CSV import. */
import { useState } from 'react';
import { newId, type ParamOrigin, type ParamSource, type Parameter, type Project } from '../core';
import { edit } from '../app/edit';
import { useProject } from '../state/store';
import { downloadParamTemplate, parseParamRows, readRows, type ParsedParam } from '../io/sheets';
import { Modal, toast } from '../ui/dialogs';
import { useFmt } from '../ui/format';
import { Badge, Button, Callout, Card, Empty, FilePick, IconButton, PageTitle, Reorder, Select, TableWrap, TextArea, TextInput, td, th } from '../ui/kit';

const move = <T,>(arr: T[], i: number, j: number) => {
  const [x] = arr.splice(i, 1);
  arr.splice(j, 0, x);
};

const SOURCE_OPTIONS: { value: ParamSource; label: string }[] = [
  { value: 'literature', label: 'متون' },
  { value: 'patent', label: 'پتنت' },
  { value: 'both', label: 'هر دو' },
];
const ORIGIN_OPTIONS: { value: ParamOrigin; label: string }[] = [
  { value: 'initial', label: 'فهرست اولیه' },
  { value: 'round2', label: 'افزوده در دور دوم' },
];

const hasRatings = (p: Project, paramId: string) =>
  Object.values(p.responses.r1).some((r) => r.ratings[paramId] != null) || Object.values(p.responses.r2).some((r) => r.ratings[paramId] != null);

function GroupsCard() {
  const p = useProject();
  const fmt = useFmt();
  return (
    <Card
      title="گروه‌های معنایی"
      actions={
        <Button size="sm" icon="plus" onClick={() => edit('افزودن گروه معنایی', (d) => void d.groups.push({ id: newId('g_'), name: 'گروه جدید' }))}>
          افزودن گروه
        </Button>
      }
    >
      <p className="mb-3 text-sm text-muted">ترتیب گروه‌ها ترتیب نمایش در پرسش‌نامه و جدول‌هاست. توزیع ۱۰۰ امتیاز دور دوم ابتدا میان همین گروه‌ها انجام می‌شود.</p>
      <ul className="space-y-2">
        {p.groups.map((g, i) => {
          const n = p.params.filter((x) => x.groupId === g.id).length;
          return (
            <li key={g.id} className="flex items-center gap-2">
              <span className="w-6 text-center text-sm text-muted">{fmt.int(i + 1)}</span>
              <TextInput value={g.name} onChange={(v) => edit('نام گروه معنایی', (d) => void (d.groups[i].name = v))} className="max-w-sm" aria-label="نام گروه" />
              <Badge>{fmt.int(n)} پارامتر</Badge>
              <Reorder
                first={i === 0}
                last={i === p.groups.length - 1}
                onUp={() => edit('ترتیب گروه‌ها', (d) => move(d.groups, i, i - 1))}
                onDown={() => edit('ترتیب گروه‌ها', (d) => move(d.groups, i, i + 1))}
              />
              <IconButton
                icon="trash"
                tone="danger"
                label="حذف گروه"
                onClick={() => {
                  if (n > 0) return toast(`این گروه ${n} پارامتر دارد؛ ابتدا آن‌ها را به گروه دیگری منتقل یا حذف کنید.`, { tone: 'bad' });
                  edit('حذف گروه معنایی', (d) => void d.groups.splice(i, 1), { preview: true, undoToast: `گروه «${g.name}» حذف شد` });
                }}
              />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function ParamRow({ x, index, total }: { x: Parameter; index: number; total: number }) {
  const p = useProject();
  const codes = p.params.map((q) => q.code.trim());
  const dup = x.code.trim() !== '' && codes.indexOf(x.code.trim()) !== codes.lastIndexOf(x.code.trim());
  const set = (label: string, f: (q: Parameter) => void, preview = false) =>
    edit(label, (d) => f(d.params.find((q) => q.id === x.id) as Parameter), { preview });
  return (
    <tr className="align-top">
      <td className={td + ' w-24'}>
        <TextInput ltr value={x.code} onChange={(v) => set('کد پارامتر', (q) => void (q.code = v))} aria-label="کد" className={dup ? 'border-bad' : ''} />
        {dup && <span className="text-xs text-bad">تکراری</span>}
      </td>
      <td className={td + ' min-w-48'}>
        <TextArea rows={2} value={x.name} onChange={(v) => set('نام پارامتر', (q) => void (q.name = v))} aria-label="نام پارامتر" />
      </td>
      <td className={td + ' min-w-56'}>
        <TextArea rows={2} value={x.requirement} onChange={(v) => set('الزام طراحی', (q) => void (q.requirement = v))} aria-label="الزام طراحی" />
      </td>
      <td className={td + ' min-w-56'}>
        <TextArea rows={2} value={x.explanation} onChange={(v) => set('توضیح پارامتر', (q) => void (q.explanation = v))} aria-label="توضیح" />
      </td>
      <td className={td + ' w-32'}>
        <TextInput value={x.range} onChange={(v) => set('محدوده عددی', (q) => void (q.range = v))} aria-label="محدوده عددی" />
      </td>
      <td className={td + ' w-28'}>
        <Select value={x.source} onChange={(v) => set('منبع پارامتر', (q) => void (q.source = v))} options={SOURCE_OPTIONS} aria-label="منبع" className="min-w-24" />
      </td>
      <td className={td + ' w-36'}>
        <Select value={x.groupId} onChange={(v) => set('گروه پارامتر', (q) => void (q.groupId = v), true)} options={p.groups.map((g) => ({ value: g.id, label: g.name }))} aria-label="گروه معنایی" className="min-w-36" />
        <Select value={x.origin} onChange={(v) => set('منشأ پارامتر', (q) => void (q.origin = v), true)} options={ORIGIN_OPTIONS} className="mt-1 min-w-36" aria-label="منشأ" />
      </td>
      <td className={td + ' whitespace-nowrap'}>
        <Reorder
          first={index === 0}
          last={index === total - 1}
          onUp={() =>
            edit('ترتیب پارامترها', (d) => {
              const ids = d.params.filter((q) => q.groupId === x.groupId).map((q) => q.id);
              const a = d.params.findIndex((q) => q.id === x.id);
              const b = d.params.findIndex((q) => q.id === ids[index - 1]);
              move(d.params, a, b);
            })
          }
          onDown={() =>
            edit('ترتیب پارامترها', (d) => {
              const ids = d.params.filter((q) => q.groupId === x.groupId).map((q) => q.id);
              const a = d.params.findIndex((q) => q.id === x.id);
              const b = d.params.findIndex((q) => q.id === ids[index + 1]);
              move(d.params, a, b);
            })
          }
        />
        <IconButton
          icon="trash"
          tone="danger"
          label="حذف پارامتر"
          onClick={() =>
            edit(
              'حذف پارامتر',
              (d) => {
                d.params = d.params.filter((q) => q.id !== x.id);
                for (const c of d.candidates) if (c.paramId === x.id) c.paramId = null;
                d.weighted.columns = d.weighted.columns.filter((c) => c.paramId !== x.id);
                if (d.screening.paramIds) d.screening.paramIds = d.screening.paramIds.filter((id) => id !== x.id);
              },
              {
                preview: true,
                confirm: hasRatings(p, x.id) ? { title: `حذف پارامتر ${x.code}`, items: ['امتیازهای ثبت‌شده برای این پارامتر دیگر در تحلیل‌ها شمرده نمی‌شوند.'], confirmLabel: 'حذف' } : undefined,
                undoToast: `پارامتر ${x.code} حذف شد`,
              },
            )
          }
        />
      </td>
    </tr>
  );
}

function ImportDialog({ rows, onClose }: { rows: ParsedParam[]; onClose: () => void }) {
  const p = useProject();
  const fmt = useFmt();
  const bad = rows.filter((r) => r.problems.length);
  const newGroups = [...new Set(rows.map((r) => r.group).filter((g) => g && !p.groups.some((x) => x.name === g)))];
  const existing = rows.filter((r) => p.params.some((x) => x.code === r.code));
  const run = async (mode: 'append' | 'replace') => {
    const ok = await edit(
      mode === 'replace' ? 'جایگزینی فهرست پارامترها از فایل' : 'افزودن پارامترها از فایل',
      (d) => {
        for (const name of newGroups) d.groups.push({ id: newId('g_'), name });
        const groupId = (name: string) => d.groups.find((g) => g.name === name)!.id;
        const incoming = rows
          .filter((r) => !r.problems.length)
          .map<Parameter>((r) => ({
            id: newId('p_'),
            code: r.code,
            name: r.name,
            groupId: groupId(r.group),
            requirement: r.requirement,
            explanation: r.explanation,
            range: r.range,
            source: r.source,
            origin: 'initial',
          }));
        if (mode === 'replace') d.params = incoming;
        else {
          // Same code → update the existing parameter (keeps its id, so collected ratings stay attached).
          for (const n of incoming) {
            const cur = d.params.find((x) => x.code === n.code);
            if (cur) Object.assign(cur, { ...n, id: cur.id, origin: cur.origin });
            else d.params.push(n);
          }
        }
      },
      { preview: true, detail: `${rows.length - bad.length} ردیف` },
    );
    if (ok) {
      toast(`${fmt.int(rows.length - bad.length)} پارامتر وارد شد.`);
      onClose();
    }
  };
  return (
    <Modal
      open
      wide
      title="پیش‌نمایش ورود پارامترها"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>انصراف</Button>
          <Button onClick={() => run('replace')} variant="danger" disabled={rows.length === bad.length}>
            جایگزینی کل فهرست
          </Button>
          <Button onClick={() => run('append')} variant="primary" disabled={rows.length === bad.length}>
            افزودن / به‌روزرسانی (بر اساس کد)
          </Button>
        </>
      }
    >
      <div className="mb-3 space-y-2 text-sm">
        <div>
          {fmt.int(rows.length)} ردیف خوانده شد؛ {fmt.int(rows.length - bad.length)} ردیف سالم.
        </div>
        {newGroups.length > 0 && <Callout tone="accent">گروه‌های جدید ساخته می‌شوند: {newGroups.join('، ')}</Callout>}
        {existing.length > 0 && <Callout tone="neutral">{fmt.int(existing.length)} کد در فهرست فعلی هست؛ در حالت «افزودن» آن پارامترها به‌روز می‌شوند و امتیازهای ثبت‌شده‌شان می‌ماند.</Callout>}
        {bad.length > 0 && <Callout tone="warn">{fmt.int(bad.length)} ردیف مشکل دارد و وارد نمی‌شود.</Callout>}
      </div>
      <TableWrap maxHeight="45vh">
        <table className="sticky-table w-full text-sm">
          <thead>
            <tr>
              {['ردیف', 'کد', 'نام', 'گروه', 'الزام طراحی', 'منبع', 'مشکل'].map((h) => (
                <th key={h} className={th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.row} className={r.problems.length ? 'bg-bad-soft' : undefined}>
                <td className={td}>{fmt.int(r.row)}</td>
                <td className={td + ' ltr'}>{r.code}</td>
                <td className={td}>{r.name}</td>
                <td className={td}>{r.group}</td>
                <td className={td + ' text-xs'}>{r.requirement}</td>
                <td className={td}>{SOURCE_OPTIONS.find((s) => s.value === r.source)?.label}</td>
                <td className={td + ' text-xs text-bad'}>{r.problems.join('؛ ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Modal>
  );
}

export function ParamsScreen() {
  const p = useProject();
  const fmt = useFmt();
  const [imported, setImported] = useState<ParsedParam[] | null>(null);
  const addParam = (groupId: string) =>
    edit('افزودن پارامتر', (d) => {
      const n = d.params.length + 1;
      let code = `P${String(n).padStart(2, '0')}`;
      for (let k = n; d.params.some((x) => x.code === code); k++) code = `P${String(k + 1).padStart(2, '0')}`;
      d.params.push({ id: newId('p_'), code, name: '', groupId, requirement: '', explanation: '', range: '', source: 'literature', origin: 'initial' });
    });
  return (
    <div className="space-y-5">
      <PageTitle
        title="گروه‌های معنایی و پارامترها"
        subtitle="خروجی فاز اکتشاف: برای هر پارامتر گروه معنایی، تعریف، الزام طراحی متناظر، محدوده عددی گزارش‌شده و منبع (متون، پتنت یا هر دو). این جدول پرسش‌نامه دور اول را می‌سازد."
        actions={
          <>
            <Button icon="download" onClick={downloadParamTemplate}>
              الگوی Excel
            </Button>
            <FilePick
              accept=".xlsx,.xls,.csv"
              onFiles={async ([f]) => {
                try {
                  const { params, missingColumns } = parseParamRows(await readRows(f));
                  if (missingColumns.length) return toast(`ستون‌های لازم پیدا نشد: ${missingColumns.join('، ')}`, { tone: 'bad' });
                  if (!params.length) return toast('ردیفی برای ورود پیدا نشد.', { tone: 'bad' });
                  setImported(params);
                } catch {
                  toast('خواندن فایل ممکن نشد.', { tone: 'bad' });
                }
              }}
            >
              ورود از Excel / CSV
            </FilePick>
          </>
        }
      />
      <GroupsCard />
      {p.groups.map((g) => {
        const list = p.params.filter((x) => x.groupId === g.id);
        return (
          <Card
            key={g.id}
            title={
              <span>
                {g.name} <span className="text-sm font-normal text-muted">({fmt.int(list.length)})</span>
              </span>
            }
            actions={
              <Button size="sm" icon="plus" onClick={() => addParam(g.id)}>
                پارامتر
              </Button>
            }
          >
            {list.length === 0 ? (
              <Empty>این گروه هنوز پارامتری ندارد.</Empty>
            ) : (
              <TableWrap>
                <table className="sticky-table w-full text-sm">
                  <thead>
                    <tr>
                      <th className={th}>کد</th>
                      <th className={th}>نام پارامتر</th>
                      <th className={th}>الزام طراحی</th>
                      <th className={th}>توضیح مختصر</th>
                      <th className={th}>محدوده عددی</th>
                      <th className={th}>منبع</th>
                      <th className={th}>گروه / منشأ</th>
                      <th className={th} />
                    </tr>
                  </thead>
                  <tbody>
                    {list.map((x, i) => (
                      <ParamRow key={x.id} x={x} index={i} total={list.length} />
                    ))}
                  </tbody>
                </table>
              </TableWrap>
            )}
          </Card>
        );
      })}
      {p.params.some((x) => !p.groups.some((g) => g.id === x.groupId)) && (
        <Callout tone="bad">برخی پارامترها به گروهی تعلق دارند که دیگر وجود ندارد؛ گروه آن‌ها را از فهرست بالا تعیین کنید.</Callout>
      )}
      {imported && <ImportDialog rows={imported} onClose={() => setImported(null)} />}
    </div>
  );
}
