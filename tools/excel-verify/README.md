# Excel formula cross-check

The Excel workbook the app exports carries live formulas (for example relations ۱ to ۸ step by step) together
with the values the app computed. This check shows that the formulas, recalculated by an independent spreadsheet
program, give the same numbers as the app.

```
npm run verify:excel
```

What it does:

1. `write-workbooks.test.ts` writes the workbooks of the worked example and of the demo project, plus a
   "poisoned" copy of each in which every cached formula value is replaced by −999.
2. LibreOffice (headless, with a profile set to always recalculate on load) opens each poisoned copy and saves
   it again, which recalculates every formula.
3. `compare.py` compares each formula cell of the recalculated copy with the value the app wrote. A difference
   larger than 1e-9 (relative) counts as a mismatch, and the script exits with an error.

Needs `soffice` (LibreOffice), `python3` and the `openpyxl` package. Working files go to `work/` (git-ignored).
