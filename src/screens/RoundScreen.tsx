/**
 * Steps 4 and 6 — collecting round-1 and round-2 answers:
 * personal offline questionnaire files (main route), manual entry, and spreadsheet import.
 */
import { useState } from 'react';
import { candidateRows, paramsOfRound, r2Invitees, respondents, type Id, type Project } from '../core';
import { edit } from '../app/edit';
import { useNav } from '../app/nav';
import { t } from '../i18n';
import { prepareFileImports, prepareSheetImport, downloadResponseTemplate, type ImportItem } from '../io/responses';
import { useProject } from '../state/store';
import { toast } from '../ui/dialogs';
import { useFmt } from '../ui/format';
import { Badge, Button, Callout, Card, Checkbox, DomainChip, FilePick, IconButton, PageTitle, TableWrap, Tabs, td, th } from '../ui/kit';
import { EntryGrid } from './rounds/EntryGrid';
import { ImportDialog } from './rounds/ImportDialog';
import { downloadAllQuestionnaires, downloadQuestionnaire } from './rounds/files';

type Round = 'r1' | 'r2';

/** Experts listed for a round: invitees plus anyone with a stored response. */
export function roundExperts(p: Project, round: Round): Id[] {
  const base =
    round === 'r1'
      ? p.experts.filter((e) => (e.active && e.status.r1.state !== 'withdrew') || p.responses.r1[e.id]).map((e) => e.id)
      : [...new Set([...r2Invitees(p), ...Object.keys(p.responses.r2)])];
  return p.experts.map((e) => e.id).filter((id) => base.includes(id));
}

function R2Invitees() {
  const p = useProject();
  const fmt = useFmt();
  const inv = new Set(r2Invitees(p));
  const r1 = new Set(respondents(p, 'r1').map((e) => e.id));
  return (
    <Card
      title={t('دعوت‌شدگان دور دوم')}
      actions={
        p.r2Invited && (
          <Button size="sm" onClick={() => edit('بازگشت دعوت دور دوم به پیش‌فرض', (d) => void (d.r2Invited = null))}>
            {t('بازگشت به پیش‌فرض')}
          </Button>
        )
      }
    >
      <p className="mb-2 text-sm text-muted">
        {t('پیش‌فرض: پاسخ‌دهندگان دور اول که انصراف نداده‌اند ({n} نفر).', { n: fmt.int(inv.size) })} {p.r2Invited ? t('فهرست دستی تنظیم شده است.') : ''}
      </p>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {p.experts.map((e) => (
          <Checkbox
            key={e.id}
            checked={inv.has(e.id)}
            onChange={(v) =>
              edit('دعوت‌شدگان دور دوم', (d) => {
                const cur = new Set(d.r2Invited ?? r2Invitees(p));
                if (v) cur.add(e.id);
                else cur.delete(e.id);
                d.r2Invited = p.experts.map((x) => x.id).filter((id) => cur.has(id));
              })
            }
            label={
              <span className="inline-flex items-center gap-1">
                <DomainChip domain={p.domains.find((d) => d.id === e.domainId)} />
                <span className="ltr">{e.code}</span>
                {!r1.has(e.id) && <span className="text-xs text-muted">{t('(بدون پاسخ دور ۱)')}</span>}
              </span>
            }
          />
        ))}
      </div>
    </Card>
  );
}

function FilesTab({ round }: { round: Round }) {
  const p = useProject();
  const fmt = useFmt();
  const ids = roundExperts(p, round);
  const params = paramsOfRound(p, round);
  const [items, setItems] = useState<ImportItem[] | null>(null);
  const canGenerate = params.length > 0 && p.groups.length > 0;
  return (
    <div className="space-y-4">
      {round === 'r2' && <R2Invitees />}
      <Card
        title={t('فایل‌های پرسش‌نامه و دریافت پاسخ ({n} خبره)', { n: fmt.int(ids.length) })}
        actions={
          <>
            <Button icon="download" variant="primary" disabled={!canGenerate || !ids.length} onClick={() => downloadAllQuestionnaires(ids, round)}>
              {t('دانلود همه پرسش‌نامه‌ها (ZIP)')}
            </Button>
            <FilePick accept=".json,application/json" multiple onFiles={async (files) => setItems(await prepareFileImports(files, p, round))}>
              {t('ورود فایل‌های پاسخ')} <span className="ltr">(.json)</span>
            </FilePick>
          </>
        }
      >
        <p className="mb-3 text-sm text-muted">
          {t('برای هر خبره یک فایل HTML آفلاین ساخته می‌شود که با کد او شخصی شده است. خبره فایل را در هر مرورگری باز می‌کند، رضایت می‌دهد، پاسخ می‌دهد و «ذخیره پاسخ» را می‌زند؛ فایل کوچکی مانند')}{' '}
          <span className="ltr">E07_{round === 'r1' ? 'round1' : 'round2'}.json</span> {t('ذخیره می‌شود که آن را برای شما ایمیل می‌کند. پیش‌نویس پاسخ‌ها در خود فایل نگه داشته می‌شود.')}
          {round === 'r2' && ' ' + t('فایل دور دوم برای هر خبره بازخورد کنترل‌شده شخصی دارد: توزیع پاسخ‌های پنل در دور اول به تفکیک حوزه و فقط امتیاز خود او.')}
        </p>
        {!canGenerate && <Callout tone="warn">{t('ابتدا گروه‌ها و پارامترها را تعریف کنید.')}</Callout>}
        <TableWrap>
          <table className="sticky-table w-full text-sm">
            <thead>
              <tr>
                <th className={th}>{t('کد')}</th>
                <th className={th}>{t('حوزه')}</th>
                <th className={th}>{t('وضعیت')}</th>
                <th className={th}>{t('پاسخ دریافت‌شده')}</th>
                <th className={th}>{t('رضایت')}</th>
                <th className={th} />
              </tr>
            </thead>
            <tbody>
              {ids.map((id) => {
                const e = p.experts.find((x) => x.id === id)!;
                const r = p.responses[round][id];
                const answered = r ? params.filter((x) => r.ratings[x.id] != null).length : 0;
                const st = e.status[round];
                return (
                  <tr key={id} className={e.excludeAllData ? 'opacity-60' : undefined}>
                    <td className={td + ' ltr font-medium'}>{e.code}</td>
                    <td className={td}>
                      <DomainChip domain={p.domains.find((d) => d.id === e.domainId)} withName />
                    </td>
                    <td className={td}>
                      <Badge tone={st.state === 'responded' ? 'ok' : st.state === 'withdrew' ? 'bad' : st.state === 'none' ? 'neutral' : 'accent'}>
                        {{ none: t('فایل ساخته نشده'), invited: t('دعوت‌شده'), consented: t('رضایت داده'), responded: t('پاسخ داده'), withdrew: t('انصراف داده') }[st.state]}
                      </Badge>{' '}
                      <span className="text-xs text-muted">{st.date ? fmt.date(st.date) : ''}</span>
                    </td>
                    <td className={td}>
                      {r ? (
                        <span className="text-xs">
                          {t('{a} از {b}', { a: fmt.int(answered), b: fmt.int(params.length) })} — {{ file: t('فایل'), manual: t('ورود دستی'), sheet: t('صفحه‌گسترده') }[r.source]} — {fmt.date(r.receivedAt)}
                          {round === 'r2' && !r.allocation && <Badge tone="warn" className="ms-1">{t('بدون توزیع امتیاز')}</Badge>}
                        </span>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </td>
                    <td className={td}>{r ? r.consent.given ? <Badge tone="ok">{t('ثبت شده')}</Badge> : <Badge tone="warn">{t('ثبت نشده')}</Badge> : null}</td>
                    <td className={td + ' whitespace-nowrap'}>
                      <Button size="sm" icon="download" disabled={!canGenerate} onClick={() => downloadQuestionnaire(id, round)}>
                        {t('پرسش‌نامه')}
                      </Button>
                      {r && (
                        <IconButton
                          icon="trash"
                          tone="danger"
                          label={t('حذف پاسخ‌نامه')}
                          onClick={() =>
                            edit(
                              'حذف پاسخ‌نامه',
                              (d) => {
                                delete d.responses[round][id];
                                const x = d.experts.find((q) => q.id === id)!;
                                if (x.status[round].state === 'responded') x.status[round] = { state: 'invited', date: x.status[round].date };
                              },
                              { preview: true, confirm: { title: t('حذف پاسخ‌نامه {code}', { code: e.code }), confirmLabel: t('حذف') }, undoToast: t('پاسخ‌نامه {code} حذف شد', { code: e.code }) },
                            )
                          }
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
      {items && <ImportDialog items={items} label={round === 'r1' ? 'ورود پاسخ‌های دور اول از فایل' : 'ورود پاسخ‌های دور دوم از فایل'} onClose={() => setItems(null)} />}
    </div>
  );
}

function SheetTab({ round }: { round: Round }) {
  const p = useProject();
  const [res, setRes] = useState<{ items: ImportItem[]; problems: string[] } | null>(null);
  return (
    <Card title={t('ورود از Excel / CSV')}>
      <p className="mb-3 text-sm text-muted">
        {t('اگر پاسخ‌ها را با ابزار فرم آنلاین یا در Excel گردآوری کرده‌اید، آن‌ها را در قالب الگو (یک ردیف برای هر خبره و یک ستون برای هر کد پارامتر) وارد کنید. پیش از ورود، پیش‌نمایش و تفاوت‌ها نمایش داده می‌شود.')}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button icon="download" onClick={() => downloadResponseTemplate(p, round, roundExperts(p, round))}>
          {t('دانلود الگو (با پاسخ‌های فعلی)')}
        </Button>
        <FilePick
          accept=".xlsx,.xls,.csv"
          onFiles={async ([f]) => {
            try {
              setRes(await prepareSheetImport(f, p, round));
            } catch {
              toast(t('خواندن فایل ممکن نشد.'), { tone: 'bad' });
            }
          }}
        >
          {t('ورود فایل')}
        </FilePick>
      </div>
      {res && <ImportDialog items={res.items} notes={res.problems} label={round === 'r1' ? 'ورود پاسخ‌های دور اول از صفحه‌گسترده' : 'ورود پاسخ‌های دور دوم از صفحه‌گسترده'} onClose={() => setRes(null)} />}
    </Card>
  );
}

export function RoundScreen({ round }: { round: Round }) {
  const p = useProject();
  const fmt = useFmt();
  const go = useNav((s) => s.go);
  const [tab, setTab] = useState<'files' | 'manual' | 'sheet'>('files');
  const params = paramsOfRound(p, round);
  const nResp = respondents(p, round).length;
  const pendingCandidates = round === 'r2' ? candidateRows(p).filter((r) => r.add && !r.candidate.paramId) : [];
  const newParams = p.params.filter((x) => x.origin === 'round2');
  const sched = p.settings.schedule[round];
  return (
    <div className="space-y-4">
      <PageTitle
        title={round === 'r1' ? t('دور اول') : t('دور دوم')}
        subtitle={
          round === 'r1'
            ? t('هر پارامتر همراه با الزام طراحی، توضیح مختصر و محدوده عددی روی مقیاس امتیازدهی ارزیابی می‌شود. در پایان هر گروه معنایی یک پرسش باز برای پیشنهاد پارامتر جدید یا توضیح هست.')
            : t('بازامتیازدهی همه پارامترهای دور اول به همراه پارامترهای جدید، با بازخورد کنترل‌شده شخصی؛ و توزیع سلسله‌مراتبی ۱۰۰ امتیاز برای وزن‌دهی.')
        }
      />
      <div className="flex flex-wrap gap-2 text-sm">
        <Badge>{t('{n} پارامتر', { n: fmt.int(params.length) })}</Badge>
        {round === 'r2' && <Badge tone="accent">{t('{n} پارامتر جدید', { n: fmt.int(newParams.length) })}</Badge>}
        <Badge tone="ok">{t('{n} پاسخ‌دهنده', { n: fmt.int(nResp) })}</Badge>
        {(sched.extendedTo ?? sched.deadline) && <Badge>{t('مهلت: {date}', { date: fmt.date(sched.extendedTo ?? sched.deadline) })}</Badge>}
      </div>
      {pendingCandidates.length > 0 && (
        <Callout tone="warn" title={t('پارامترهای جدید تأییدشده هنوز ساخته نشده‌اند')}>
          {t('{n} پارامتر نامزد به آستانه رسیده ولی هنوز به فهرست اضافه نشده است.', { n: fmt.int(pendingCandidates.length) })}{' '}
          <button type="button" className="font-semibold text-accent underline" onClick={() => go('analysis1')}>
            {t('رفتن به تحلیل دور اول')}
          </button>
        </Callout>
      )}
      <Tabs
        tabs={[
          { id: 'files', label: t('فایل‌ها و دریافت پاسخ') },
          { id: 'manual', label: t('ورود دستی') },
          { id: 'sheet', label: t('ورود از Excel / CSV') },
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 'files' && <FilesTab round={round} />}
      {tab === 'manual' && (
        <Card title={t('ورود دستی پاسخ‌ها')}>
          <EntryGrid round={round} expertIds={roundExperts(p, round)} />
        </Card>
      )}
      {tab === 'sheet' && <SheetTab round={round} />}
    </div>
  );
}

export const Round1Screen = () => <RoundScreen round="r1" />;
export const Round2Screen = () => <RoundScreen round="r2" />;
