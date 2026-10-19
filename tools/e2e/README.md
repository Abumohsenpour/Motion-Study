# Manual-entry test

Shows that a researcher can type every piece of data into the app by hand, with no file import, and get the
results the method prescribes.

```
npm run test:manual
```

What it does:

1. Builds the single offline file (`dist-single/index.html`).
2. `manual-entry.cjs` opens that file in Chromium with the network switched off and creates an empty project.
   Through the screens, it types the whole worked example of `SPEC.md` § 6:
   - 10 experts with names, years and activity;
   - 3 groups and 6 parameters;
   - both rounds' ratings, including «توانایی قضاوت ندارم» and one missing answer, with consent;
   - two open answers, coded into candidates and merged as synonyms, plus a reasoned decision;
   - four point allocations;
   - 5 concepts, the datum, and the votes of three raters in both screening runs;
   - two weighted-matrix columns with hand-typed weights, and the scores of six experts.

   Along the way it checks that the screens show the hand-calculated results: consensus, the four final weights,
   the forwarded concepts, the three weighted scores and the break-even values. It also runs the anonymity check,
   saves the project file and Excel workbook, and finally accepts a candidate to check that it becomes a new
   round-2 parameter.
3. `check-manual.test.ts` opens the saved project file. It checks that its data equal the worked example value by
   value, and that its results equal the hand calculation to 12 decimal places.

Screenshots of every step and the downloaded files go to `work/` (git-ignored). The script finds Chromium through
Playwright; set `CHROMIUM_PATH` to use a specific browser binary.
