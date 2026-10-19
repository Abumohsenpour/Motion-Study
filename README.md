# Delphi + Pugh research tool

A desktop-browser application for the two phases of the thesis «طراحی اگزواسکلتون غیرفعال ارگونومیک پشتیبان
پیش‌بند سربی برای جراحی درون‌عروقی مبتنی بر مدل الماس دوگانه»:

- **Part A — Define phase:** a two-round modified Delphi with the consensus rules of the proposal and hierarchical
  point-allocation weights (relations ۱ to ۵).
- **Part B — Develop phase:** Pugh screening (+ / − / S, two runs) and the weighted Pugh matrix (relations ۶ to ۸)
  with sensitivity analysis.

The interface is Persian and right-to-left. Everything runs offline in the browser, and the data stays on the
researcher's computer. `SPEC.md` holds every formula, rule and hand-calculated example. `DECISIONS.md` lists every
conflict with the proposal and every choice made where the proposal is silent.

## Using it

A step-by-step user guide in Persian, with screenshots of every step, is in `docs/delphi-pugh-user-guide-fa.docx`.

The ready-made offline file is `release/delphi-pugh-offline.html`. Open it in Chrome, Edge or Firefox by
double-clicking; no internet and no installation are needed. Projects are saved automatically in the browser of
that computer (IndexedDB). Use **فایل پروژه (.json)** on the outputs screen as a backup and to move a project to
another computer. The identity key file (expert names) is a separate download; keep it apart from the project file.

Two sample projects can be opened from the start screen:

- **نمونه حل‌شده دستی:** the small worked example of `SPEC.md` (fixtures F1–F4). Every number on its screens can be
  checked against the hand calculation.
- **نمونه حل‌شده و امتیازدهی‌شده (داده فرضی):** a complete study on the thesis topic with hypothetical data, for
  presenting the method (for example at the proposal defence). It has 15 experts in 3 domains, 5 semantic groups,
  25 initial parameters plus one added from the round-1 open answers, and 5 concepts. All ten steps are filled in
  and every result is computed. Opening it again from the start screen restores the original, so changes made while
  rehearsing never carry over.

## Building from source

Requires Node.js 22.12 or newer.

```
npm install
npm run dev            # development server at http://localhost:5173
npm test               # all unit tests (Vitest)
npm run typecheck      # TypeScript strict check
npm run build          # regular build in dist/
npm run build:single   # one self-contained HTML file in dist-single/index.html
npm run verify:excel   # recalculates the exported workbooks in LibreOffice and compares (see tools/excel-verify)
npm run test:manual    # types the whole worked example into the app by hand and checks the results (see tools/e2e)
```

After `npm run build:single`, copy `dist-single/index.html` to `release/delphi-pugh-offline.html` to update the
ready-made file.

## How the code is organised

| Folder | Contents |
|---|---|
| `src/core/` | All calculations, as pure functions with no user-interface code. `stats.ts` holds quartiles (Hyndman–Fan type 7, identical to Excel `QUARTILE.INC`). `delphi/` holds band percentages, consensus, candidate parameters and weights (relations ۱–۵). `pugh/` holds screening, the weighted matrix (relations ۶–۸) and sensitivity. `project/` applies these to a whole project. |
| `src/core/__tests__/` | Unit tests, including the hand-calculated fixtures F1–F5 from `SPEC.md`. |
| `src/state/` | The project store with undo/redo and the change log, and automatic saving to IndexedDB. |
| `src/screens/`, `src/app/`, `src/ui/` | The ten steps of the interface and its shared components. |
| `src/questionnaire/` | The personal offline questionnaire files sent to experts (consent page, progress, draft saving, checksummed response file). |
| `src/io/` | Excel/CSV import and export, project and identity files, response-file import, anonymity scan. |
| `src/report/`, `src/charts/` | The printable thesis report with numbered captions, and the SVG charts. |
| `src/demo/` | The two sample projects. |
| `tools/excel-verify/` | Independent check of the Excel formulas with LibreOffice. |

## Verification

- **Unit tests.** `npm test` runs 98 tests. They cover every relation, threshold and rule, the hand-calculated
  fixtures, edge cases (ties, missing data, all-zero allocations, cannot-judge answers, withdrawals), response-file
  checksums, questionnaire privacy and blinding, and the anonymity of every output.
- **Worked example in the interface.** The worked example reproduces the hand-calculated values on screen:
  - final weights 0.2198, 0.2177, 0.2438 and 0.3188;
  - weighted scores 3.367, 3.633 and 3.300;
  - break-even changes of +133.3 % and −57.1 %.
- **Manual entry.** `npm run test:manual` starts the offline file in Chromium with the network off, creates an
  empty project and types every value of the worked example through the screens: experts, groups and parameters,
  both rounds' ratings, consent, open answers, coding and candidates, point allocations, concepts, screening votes
  of three raters in two runs, weighted-matrix columns, weights and scores. It then checks the hand-calculated
  results on screen, saves the project file and compares it with the worked example value by value. The last run
  passed all 18 on-screen checks and the file comparison.
- **Excel formulas.** The exported workbook carries live formulas next to the app's values.
  `npm run verify:excel` erases every cached value, has LibreOffice recalculate the workbook, and compares the two.
  The last run found 0 differences in 872 (worked example) and 5,633 (demo) formula cells.
- **Offline and privacy.** The single-file build was opened from `file://` with networking disabled in Chromium.
  It made no network requests, and the bundled Vazirmatn font, downloads and saving all worked. The anonymity scan
  on the outputs screen builds every output and searches it for each expert's name, contact and notes.

## Libraries

All bundled locally; nothing is loaded from the internet at run time.

| Library | Version | Use |
|---|---|---|
| React | 19.3 | user interface |
| TypeScript | 5.9 | language (strict mode) |
| Vite | 8.3 | build; `vite-plugin-singlefile` 2.3 for the one-file build |
| Tailwind CSS | 4.3 | styling |
| Zustand 5.0 + Immer 11.1 | | project state, undo/redo |
| Dexie | 4.4 | storage in IndexedDB |
| SheetJS (`xlsx`) | 0.18.5 | Excel and CSV reading and writing (see D-64) |
| fflate | 0.8 | ZIP files |
| Vazirmatn | 33.0 | Persian font |
| Vitest | 5.0 | unit tests |
