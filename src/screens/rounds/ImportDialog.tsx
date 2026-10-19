/** Preview of response files / spreadsheet rows before they are imported. */
import { useState } from 'react';
import type { ImportItem } from '../../io/responses';
import { useStore } from '../../state/store';
import { Modal, toast } from '../../ui/dialogs';
import { useFmt } from '../../ui/format';
import { Badge, Button, Callout, Checkbox, TableWrap, td, th } from '../../ui/kit';

export function ImportDialog({ items, notes, label, onClose }: { items: ImportItem[]; notes?: string[]; label: string; onClose: () => void }) {
  const fmt = useFmt();
  const [sel, setSel] = useState<Set<string>>(() => new Set(items.filter((i) => i.apply && i.defaultSelected).map((i) => i.key)));
  const dupExperts = items
    .filter((i) => i.expertId && sel.has(i.key))
    .map((i) => i.expertId)
    .filter((id, k, a) => a.indexOf(id) !== k);
  const run = () => {
    const chosen = items.filter((i) => sel.has(i.key) && i.apply);
    if (!chosen.length) return onClose();
    const today = new Date().toISOString().slice(0, 10);
    useStore.getState().apply(
      label,
      (d) => {
        for (const i of chosen) i.apply!(d, today);
      },
      { detail: chosen.map((i) => `${i.expertCode}${i.replaces ? ' (جایگزینی)' : ''}`).join('، ') },
    );
    toast(`${fmt.int(chosen.length)} پاسخ‌نامه وارد شد.`);
    onClose();
  };
  return (
    <Modal
      open
      wide
      title="پیش‌نمایش ورود پاسخ‌ها"
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>انصراف</Button>
          <Button variant="primary" onClick={run} disabled={sel.size === 0}>
            ورود {fmt.int(sel.size)} مورد انتخاب‌شده
          </Button>
        </>
      }
    >
      {notes?.map((n) => (
        <Callout key={n} tone="warn" className="mb-2">
          {n}
        </Callout>
      ))}
      {dupExperts.length > 0 && (
        <Callout tone="warn" className="mb-2">
          برای یک خبره بیش از یک فایل انتخاب شده است؛ آخرین مورد جایگزین قبلی می‌شود.
        </Callout>
      )}
      <TableWrap maxHeight="55vh">
        <table className="sticky-table w-full text-sm">
          <thead>
            <tr>
              <th className={th} />
              <th className={th}>فایل / ردیف</th>
              <th className={th}>خبره</th>
              <th className={th}>وضعیت</th>
              <th className={th}>پاسخ‌ها</th>
              <th className={th}>بررسی</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.key} className={!i.apply ? 'bg-bad-soft/60' : undefined}>
                <td className={td}>
                  <Checkbox
                    checked={sel.has(i.key)}
                    onChange={(v) =>
                      setSel((s) => {
                        const n = new Set(s);
                        if (v && i.apply) n.add(i.key);
                        else n.delete(i.key);
                        return n;
                      })
                    }
                    label={<span className="sr-only">انتخاب</span>}
                  />
                </td>
                <td className={td + ' text-xs ltr'}>{i.fileName}</td>
                <td className={td + ' ltr'}>{i.expertCode}</td>
                <td className={td}>
                  {!i.apply ? (
                    <Badge tone="bad">قابل ورود نیست</Badge>
                  ) : i.replaces ? (
                    <Badge tone="warn">جایگزینی — {fmt.int(i.changed)} پاسخ متفاوت</Badge>
                  ) : (
                    <Badge tone="ok">جدید</Badge>
                  )}
                </td>
                <td className={td}>{i.total ? `${fmt.int(i.answered)} از ${fmt.int(i.total)}` : '—'}</td>
                <td className={td + ' text-xs'}>
                  {i.problems.map((x) => (
                    <div key={x} className="text-bad">
                      {x}
                    </div>
                  ))}
                  {i.warnings.map((x) => (
                    <div key={x} className="text-warn">
                      {x}
                    </div>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </TableWrap>
    </Modal>
  );
}
