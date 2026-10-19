/**
 * Step 1 of the Excel cross-check (see README.md here): writes the worked-example and demo workbooks, plus a
 * "poisoned" copy of each in which every formula's cached value is replaced by −999. Only a real recalculation by
 * a spreadsheet program can restore those values, so comparing the recalculated copy with the app's own values
 * shows that the formulas in the workbook reproduce the app's results.
 */
import { it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import * as XLSX from 'xlsx';
import { buildDemoProject } from '../../src/demo/demoProject';
import { buildWorkedExample } from '../../src/demo/workedExample';
import { workbookBytes } from '../../src/io/excel';

const dir = (process.env.XLSX_VERIFY_DIR ?? 'tools/excel-verify/work') + '/';

it('writes the workbooks and their poisoned copies', () => {
  mkdirSync(dir, { recursive: true });
  for (const [name, b] of [['worked', buildWorkedExample()], ['demo', buildDemoProject()]] as const) {
    const bytes = workbookBytes(b.project);
    writeFileSync(dir + name + '.xlsx', bytes);
    const wb = XLSX.read(bytes, { type: 'array', cellFormula: true });
    for (const sn of wb.SheetNames) {
      const ws = wb.Sheets[sn];
      for (const k of Object.keys(ws)) {
        if (k[0] === '!') continue;
        const c = ws[k] as XLSX.CellObject;
        if (!c.f) continue;
        // SheetJS drops the _xlfn. prefix on read; without it LibreOffice shows #NAME? for QUARTILE.INC
        c.f = c.f.replace(/\bQUARTILE\.INC\(/g, '_xlfn.QUARTILE.INC(');
        c.v = -999;
        c.t = 'n';
        delete c.w;
      }
    }
    writeFileSync(dir + name + '-poison.xlsx', XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
  }
});
