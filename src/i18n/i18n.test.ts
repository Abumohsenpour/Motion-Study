/** Every text passed to t(...) / tr(lang, ...) in the code must have an English entry. */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EN } from './en';
import { tr } from './index';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    if (statSync(p).isDirectory()) return n === 'i18n' || n === '__tests__' ? [] : files(p);
    return /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
  });
}

describe('English interface texts', () => {
  it('exist for every text used in the code', () => {
    const missing = new Set<string>();
    // t('…'), t("…"), t(`…`) without ${} — and tr(lang, '…')
    const re = /\b(?:t|tr|T)\(\s*(?:[a-zA-Z_.]+\s*,\s*)?(['"`])((?:\\.|(?!\1)[^\\])*)\1/g;
    for (const f of files('src')) {
      const src = readFileSync(f, 'utf8');
      for (const m of src.matchAll(re)) {
        const key = m[2].replace(/\\(['"`\\])/g, '$1').replace(/\\n/g, '\n');
        if (!/[؀-ۿ]/.test(key) || key.includes('${')) continue;
        if (!(key in EN)) missing.add(`${f}: ${key}`);
      }
    }
    expect([...missing]).toEqual([]);
  });

  it('keep the placeholders of the Persian text', () => {
    const bad = Object.entries(EN).filter(([fa, en]) => {
      const a = [...fa.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
      const b = [...en.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join();
      return a !== b;
    });
    expect(bad).toEqual([]);
  });

  it('fills placeholders and falls back to Persian', () => {
    expect(tr('fa', '{n} خبره', { n: 3 })).toBe('3 خبره');
    expect(tr('en', 'متنی که ترجمه ندارد')).toBe('متنی که ترجمه ندارد');
  });
});
