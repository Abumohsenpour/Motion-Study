/** Generating the experts' offline files and downloading them one by one or as a ZIP. */
import { strToU8, zipSync } from 'fflate';
import type { Id, RoundKey } from '../../core';
import { downloadBlob, downloadText } from '../../io/download';
import { questionnaireData, questionnaireFileName, questionnaireHtml } from '../../questionnaire/build';
import { usePrefs } from '../../state/prefs';
import { useStore } from '../../state/store';
import { makeFmt } from '../../ui/format';

function build(expertId: Id, kind: RoundKey) {
  const p = useStore.getState().project!;
  const digits = usePrefs.getState().digits;
  const fmt = makeFmt(digits);
  const s = p.settings.schedule[kind];
  const deadline = s.extendedTo ?? s.deadline;
  const data = questionnaireData(p, expertId, kind, { digits, deadlineText: deadline ? fmt.date(deadline) : '' });
  return { name: questionnaireFileName(data.expertCode, kind), html: questionnaireHtml(data) };
}

/** Marks invited experts (status "invited" with today's date) unless they already have a later status. */
function markInvited(ids: Id[], kind: RoundKey) {
  const today = new Date().toISOString().slice(0, 10);
  useStore.getState().apply(
    kind === 'r1' ? 'تولید فایل پرسش‌نامه دور اول' : kind === 'r2' ? 'تولید فایل پرسش‌نامه دور دوم' : 'تولید فایل امتیازدهی ماتریس وزن‌دار',
    (d) => {
      for (const e of d.experts) if (ids.includes(e.id) && e.status[kind].state === 'none') e.status[kind] = { state: 'invited', date: today };
    },
  );
}

export function downloadQuestionnaire(expertId: Id, kind: RoundKey) {
  const f = build(expertId, kind);
  downloadText(f.html, f.name, 'text/html');
  markInvited([expertId], kind);
}

export function downloadAllQuestionnaires(expertIds: Id[], kind: RoundKey) {
  const files: Record<string, Uint8Array> = {};
  for (const id of expertIds) {
    const f = build(id, kind);
    files[f.name] = strToU8(f.html);
  }
  const zip = zipSync(files, { level: 6 });
  downloadBlob(new Blob([zip as BlobPart], { type: 'application/zip' }), `questionnaires_${kind === 'r1' ? 'round1' : kind === 'r2' ? 'round2' : 'pugh'}.zip`);
  markInvited(expertIds, kind);
}
