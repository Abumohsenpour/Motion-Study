/**
 * Panel minimum (proposal ۸–۴ ج ۶ and و) ۲ الف: «رعایت حداقل نهایی پنل (۹ نفر، با دست‌کم ۳ نفر از هر حوزه)
 * پیش از تحلیل دور دوم بررسی می‌شود»). Checked on round-2 respondents. It warns; it never blocks (DECISIONS D-25).
 */
import type { Id } from '../types';

export interface PanelRule {
  minTotal: number;
  minPerDomain: number;
}

export interface PanelCheck {
  total: number;
  perDomain: Record<Id, number>;
  totalOk: boolean;
  domainOk: Record<Id, boolean>;
  ok: boolean;
}

export function panelMinimumCheck(
  respondentDomainIds: readonly Id[],
  domains: readonly { id: Id }[],
  rule: PanelRule,
): PanelCheck {
  const perDomain = Object.fromEntries(domains.map((d) => [d.id, respondentDomainIds.filter((x) => x === d.id).length]));
  const totalOk = respondentDomainIds.length >= rule.minTotal;
  const domainOk = Object.fromEntries(domains.map((d) => [d.id, perDomain[d.id] >= rule.minPerDomain]));
  return {
    total: respondentDomainIds.length,
    perDomain,
    totalOk,
    domainOk,
    ok: totalOk && Object.values(domainOk).every(Boolean),
  };
}
