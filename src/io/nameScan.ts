/**
 * Anonymity check: generates every output and searches it for each expert's private name and contact details.
 * Build request "Done" criterion: no expert name appears in any output except the researcher's private list.
 */
import { strFromU8, unzipSync } from 'fflate';
import type { ExpertIdentity, Id, Project } from '../core';
import { chartCatalog } from '../charts/catalog';
import { questionnaireData, questionnaireHtml } from '../questionnaire/build';
import { thesisReport } from '../report/thesisReport';
import { round1ReportHtml } from '../report/round1Report';
import { thankYouHtml } from '../report/thankYou';
import type { Fmt } from '../ui/format';
import { serializeProject } from './projectFile';
import { sheetsAsCsv, workbookBytes } from './excel';

export interface ScanResult {
  outputs: number;
  terms: number;
  hits: { output: string; term: string }[];
}

export function scanOutputsForNames(p: Project, identities: Record<Id, ExpertIdentity>, fmt: Fmt): ScanResult {
  const terms = Object.values(identities)
    .flatMap((i) => [i.name, i.contact, i.notes])
    .map((t) => t.trim())
    .filter((t) => t.length >= 3);
  const outputs: [string, string][] = [];
  outputs.push(['فایل پروژه (.json)', serializeProject(p)]);
  outputs.push(['گزارش پایان‌نامه', thesisReport(p, fmt).html]);
  outputs.push(['گزارش دور اول', round1ReportHtml(p, fmt)]);
  outputs.push(['خلاصه تشکر', thankYouHtml(p, fmt, null)]);
  for (const [name, csv] of Object.entries(sheetsAsCsv(p))) outputs.push([`CSV ${name}`, csv]);
  // the xlsx itself (all XML parts, including shared strings)
  const parts = unzipSync(workbookBytes(p));
  outputs.push(['Excel (.xlsx)', Object.values(parts).map((u) => strFromU8(u)).join('\n')]);
  for (const c of chartCatalog(p, fmt)) outputs.push([`نمودار ${c.title}`, c.svg]);
  for (const e of p.experts) {
    for (const kind of ['r1', 'r2', 'pugh'] as const) {
      try {
        outputs.push([`فایل ${e.code} ${kind}`, questionnaireHtml(questionnaireData(p, e.id, kind, { digits: fmt.mode, deadlineText: '' }))]);
      } catch {
        /* e.g. no blinding key yet */
      }
    }
    outputs.push([`تشکر ${e.code}`, thankYouHtml(p, fmt, e.id)]);
  }
  const hits: ScanResult['hits'] = [];
  // embedded fonts and images are base64 data URLs; strip them so a short term cannot match by chance
  for (const [output, raw] of outputs) {
    const text = raw.replace(/data:[a-z]+\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/gi, '');
    for (const term of terms) if (text.includes(term)) hits.push({ output, term });
  }
  return { outputs: outputs.length, terms: terms.length, hits };
}
