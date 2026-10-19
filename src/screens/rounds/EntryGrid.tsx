/**
 * Fast keyboard-friendly manual entry: experts × parameters.
 * Type a number for a rating; x, ق or ؟ for «توانایی قضاوت ندارم»; Delete/Backspace clears.
 * Arrow keys and Enter move between cells.
 */
import { useRef, useState, type KeyboardEvent } from 'react';
import { CJ, allocationTotals, paramsOfRound, type Allocation, type DelphiResponse, type Id, type Project, type RatingValue } from '../../core';
import { useProject, useStore } from '../../state/store';
import { useFmt } from '../../ui/format';
import { Modal } from '../../ui/dialogs';
import { Badge, Button, Checkbox, DomainChip, NumberInput, TableWrap, TextArea, cx } from '../../ui/kit';

const FA = '۰۱۲۳۴۵۶۷۸۹';

function emptyResponse(expertId: Id, round: 'r1' | 'r2'): DelphiResponse {
  return {
    expertId,
    round,
    ratings: {},
    openTexts: {},
    allocation: round === 'r2' ? { groupPoints: {}, paramPoints: {} } : null,
    consent: { given: false, at: null },
    source: 'manual',
    receivedAt: new Date().toISOString(),
  };
}

/** Applies a change to an expert's response, creating it if needed (source becomes "manual"). */
export function editResponse(round: 'r1' | 'r2', expertId: Id, f: (r: DelphiResponse) => void, code: string) {
  useStore.getState().apply(
    round === 'r1' ? 'ورود دستی پاسخ‌های دور اول' : 'ورود دستی پاسخ‌های دور دوم',
    (d) => {
      const r = (d.responses[round][expertId] ??= emptyResponse(expertId, round)) as DelphiResponse;
      f(r);
      const e = d.experts.find((x) => x.id === expertId);
      if (e && e.status[round].state !== 'responded' && Object.values(r.ratings).some((v) => v !== null))
        e.status[round] = { state: 'responded', date: new Date().toISOString().slice(0, 10) };
    },
    { detail: code },
  );
}

function parseKey(s: string): RatingValue | undefined {
  const t = s.trim().replace(/[۰-۹]/g, (c) => String(FA.indexOf(c)));
  if (t === '') return null;
  if (/^(x|ق|؟|\?|cj)$/i.test(t)) return CJ;
  const n = Number(t);
  return Number.isInteger(n) ? n : undefined;
}

function Cell({
  value,
  min,
  max,
  onSet,
  onNav,
  id,
  label,
}: {
  value: RatingValue | undefined;
  min: number;
  max: number;
  onSet: (v: RatingValue) => void;
  onNav: (dr: number, dc: number) => void;
  id: string;
  label: string;
}) {
  const fmt = useFmt();
  const [text, setText] = useState<string | null>(null);
  const shown = text ?? (value === CJ ? '؟' : typeof value === 'number' ? fmt.int(value) : '');
  const invalid = typeof value === 'number' && (value < min || value > max || !Number.isInteger(value));
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
      value={shown}
      onFocus={(e) => e.target.select()}
      onBlur={() => setText(null)}
      onKeyDown={onKey}
      onChange={(e) => {
        const raw = e.target.value;
        setText(raw);
        const v = parseKey(raw);
        if (v === undefined) return;
        if (typeof v === 'number' && (v < min || v > max)) return;
        onSet(v);
        // single-digit scales: jump to the next cell after one keystroke
        if (typeof v === 'number' && max < 10) {
          setText(null);
          onNav(0, 1);
        } else if (v === CJ) {
          setText(null);
          onNav(0, 1);
        }
      }}
      className={cx(
        'h-8 w-9 rounded border border-line bg-surface text-center text-sm tabular-nums focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30',
        value === CJ && 'bg-surface-2 text-muted',
        invalid && 'border-bad bg-bad-soft',
      )}
      dir="ltr"
      inputMode="numeric"
    />
  );
}

function AllocationEditor({ p, expertId, onClose }: { p: Project; expertId: Id; onClose: () => void }) {
  const fmt = useFmt();
  const e = p.experts.find((x) => x.id === expertId)!;
  const r = p.responses.r2[expertId];
  const a: Allocation = r?.allocation ?? { groupPoints: {}, paramPoints: {} };
  const t = allocationTotals(p, a);
  const set = (f: (al: Allocation) => void) =>
    editResponse('r2', expertId, (resp) => {
      resp.allocation ??= { groupPoints: {}, paramPoints: {} };
      f(resp.allocation);
    }, e.code);
  const tot = (v: number) => (
    <Badge tone={Math.abs(v - 100) < 1e-9 ? 'ok' : 'warn'}>
      مجموع {fmt.auto(v, 2)} {Math.abs(v - 100) < 1e-9 ? '✓' : '(نه ۱۰۰)'}
    </Badge>
  );
  return (
    <Modal open wide title={`توزیع امتیاز — ${e.code}`} onClose={onClose} footer={<Button onClick={onClose}>بستن</Button>}>
      <p className="mb-3 text-sm text-muted">مجموع غیر از ۱۰۰ فقط هشدار است؛ روابط ۱ و ۲ امتیازها را نرمال می‌کنند. خانه خالی در سطحی که عدد دیگری دارد صفر شمرده می‌شود.</p>
      <div className="mb-4 rounded-lg border border-line p-3">
        <div className="mb-2 flex items-center gap-2 font-semibold">گروه‌های معنایی {tot(t.groupTotal)}</div>
        <div className="grid gap-2 md:grid-cols-3">
          {p.groups.map((g) => (
            <label key={g.id} className="flex items-center gap-2 text-sm">
              <span className="flex-1">{g.name}</span>
              <span className="w-20 shrink-0">
                <NumberInput min={0} value={a.groupPoints[g.id] ?? null} onChange={(v) => set((al) => void (al.groupPoints[g.id] = v))} aria-label={`امتیاز ${g.name}`} />
              </span>
            </label>
          ))}
        </div>
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        {p.groups.map((g) => {
          const ps = paramsOfRound(p, 'r2').filter((x) => x.groupId === g.id);
          if (!ps.length) return null;
          return (
            <div key={g.id} className="rounded-lg border border-line p-3">
              <div className="mb-2 flex items-center gap-2 font-semibold">
                {g.name} {tot(t.perGroup[g.id])}
              </div>
              {ps.map((x) => (
                <label key={x.id} className="flex items-center gap-2 py-0.5 text-sm">
                  <span className="ltr w-14 text-xs text-muted">{x.code}</span>
                  <span className="flex-1">{x.name}</span>
                  <span className="w-20 shrink-0">
                    <NumberInput min={0} value={a.paramPoints[x.id] ?? null} onChange={(v) => set((al) => void (al.paramPoints[x.id] = v))} aria-label={`امتیاز ${x.code}`} />
                  </span>
                </label>
              ))}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

function OpenTextEditor({ p, expertId, onClose }: { p: Project; expertId: Id; onClose: () => void }) {
  const e = p.experts.find((x) => x.id === expertId)!;
  const r = p.responses.r1[expertId];
  return (
    <Modal open wide title={`پاسخ‌های باز — ${e.code}`} onClose={onClose} footer={<Button onClick={onClose}>بستن</Button>}>
      <div className="space-y-3">
        {p.groups.map((g) => (
          <label key={g.id} className="block">
            <span className="mb-1 block text-sm font-medium">{g.name}</span>
            <TextArea
              rows={2}
              value={r?.openTexts[g.id] ?? ''}
              onChange={(v) => editResponse('r1', expertId, (resp) => void (resp.openTexts[g.id] = v), e.code)}
              aria-label={`پاسخ باز ${g.name}`}
            />
          </label>
        ))}
      </div>
    </Modal>
  );
}

export function EntryGrid({ round, expertIds }: { round: 'r1' | 'r2'; expertIds: Id[] }) {
  const p = useProject();
  const fmt = useFmt();
  const params = paramsOfRound(p, round);
  const gridId = useRef('g' + Math.random().toString(36).slice(2, 7)).current;
  const [alloc, setAlloc] = useState<Id | null>(null);
  const [openTx, setOpenTx] = useState<Id | null>(null);
  const focus = (r: number, c: number) => document.getElementById(`${gridId}-${r}-${c}`)?.focus();
  const groupsUsed = p.groups.map((g) => ({ g, n: params.filter((x) => x.groupId === g.id).length })).filter((x) => x.n > 0);
  return (
    <div>
      <p className="mb-2 text-sm text-muted">
        عدد {fmt.int(p.scale.min)} تا {fmt.int(p.scale.max)} = امتیاز؛ x یا ق یا ؟ = «{p.scale.cannotJudgeLabel}»؛ Delete = پاک‌کردن. کلیدهای جهت‌نما و Enter بین خانه‌ها جابه‌جا می‌کنند.
      </p>
      <TableWrap maxHeight="68vh">
        <table className="sticky-table border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky-col border-b border-line px-2 py-1 text-right" rowSpan={2}>
                خبره
              </th>
              {groupsUsed.map(({ g, n }) => (
                <th key={g.id} colSpan={n} className="border-b border-l border-line px-1 py-1 text-center text-xs font-semibold text-muted">
                  {g.name}
                </th>
              ))}
              <th className="border-b border-line px-2 text-xs" rowSpan={2}>
                رضایت
              </th>
              <th className="border-b border-line px-2 text-xs" rowSpan={2}>
                پاسخ‌ها
              </th>
              <th className="border-b border-line px-2 text-xs" rowSpan={2}>
                {round === 'r1' ? 'پاسخ باز' : 'توزیع امتیاز'}
              </th>
            </tr>
            <tr>
              {groupsUsed.flatMap(({ g }) =>
                params
                  .filter((x) => x.groupId === g.id)
                  .map((x) => (
                    <th key={x.id} className="border-b border-line px-0.5 py-1 text-center text-[11px] font-medium" title={`${x.code}: ${x.name}`}>
                      <span className="ltr">{x.code}</span>
                      {x.origin === 'round2' && <span className="block text-[10px] text-accent">جدید</span>}
                    </th>
                  )),
              )}
            </tr>
          </thead>
          <tbody>
            {expertIds.map((eid, ri) => {
              const e = p.experts.find((x) => x.id === eid)!;
              const r = p.responses[round][eid];
              const orderedParams = groupsUsed.flatMap(({ g }) => params.filter((x) => x.groupId === g.id));
              const answered = orderedParams.filter((x) => r?.ratings[x.id] != null).length;
              return (
                <tr key={eid}>
                  <td className="sticky-col border-b border-line px-2 py-0.5 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <DomainChip domain={p.domains.find((d) => d.id === e.domainId)} />
                      <span className="ltr font-medium">{e.code}</span>
                    </span>
                  </td>
                  {orderedParams.map((x, ci) => (
                    <td key={x.id} className="border-b border-line/60 px-0.5 py-0.5 text-center">
                      <Cell
                        id={`${gridId}-${ri}-${ci}`}
                        label={`${e.code} — ${x.code}`}
                        value={r?.ratings[x.id]}
                        min={p.scale.min}
                        max={p.scale.max}
                        onSet={(v) => {
                          if (v === CJ && !p.scale.allowCannotJudge) return;
                          editResponse(round, eid, (resp) => void (resp.ratings[x.id] = v), e.code);
                        }}
                        onNav={(dr, dc) => {
                          const nr = ri + dr;
                          let nc = ci + dc;
                          if (nc >= orderedParams.length) nc = orderedParams.length - 1;
                          if (nc < 0) nc = 0;
                          if (nr >= 0 && nr < expertIds.length) focus(nr, nc);
                        }}
                      />
                    </td>
                  ))}
                  <td className="border-b border-line px-2 text-center">
                    <Checkbox
                      checked={!!r?.consent.given}
                      onChange={(v) =>
                        editResponse(round, eid, (resp) => {
                          resp.consent = { given: v, at: v ? new Date().toISOString() : null };
                        }, e.code)
                      }
                      label={<span className="sr-only">رضایت {e.code}</span>}
                    />
                  </td>
                  <td className="border-b border-line px-2 text-center text-xs whitespace-nowrap text-muted">
                    {fmt.int(answered)}/{fmt.int(orderedParams.length)}
                  </td>
                  <td className="border-b border-line px-2 text-center">
                    {round === 'r1' ? (
                      <Button size="sm" variant="ghost" onClick={() => setOpenTx(eid)}>
                        {Object.values(r?.openTexts ?? {}).some((t) => t.trim()) ? 'دارد ✎' : 'افزودن'}
                      </Button>
                    ) : (
                      <Button size="sm" variant="ghost" onClick={() => setAlloc(eid)}>
                        {r?.allocation && Object.values(r.allocation.groupPoints).some((v) => v != null) ? 'دارد ✎' : 'افزودن'}
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
      {alloc && <AllocationEditor p={p} expertId={alloc} onClose={() => setAlloc(null)} />}
      {openTx && <OpenTextEditor p={p} expertId={openTx} onClose={() => setOpenTx(null)} />}
    </div>
  );
}
