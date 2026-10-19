"""
Step 2 of the Excel cross-check: for every formula cell, compares the value the app wrote (cached in
<name>.xlsx) with the value LibreOffice recalculated from the formula (out/<name>-poison.xlsx).
Usage: python3 compare.py <work dir>. Exits with status 1 if any cell differs.
"""
import sys, openpyxl
D = sys.argv[1]
failed = False
for name in ['worked', 'demo']:
    truth = openpyxl.load_workbook(f'{D}/{name}.xlsx', data_only=True)
    forms = openpyxl.load_workbook(f'{D}/{name}.xlsx', data_only=False)
    recalc = openpyxl.load_workbook(f'{D}/out/{name}-poison.xlsx', data_only=True)
    total = bad = 0
    issues = []
    for ws in forms.worksheets:
        t = truth[ws.title]; r = recalc[ws.title]
        for row in ws.iter_rows():
            for c in row:
                if isinstance(c.value, str) and c.value.startswith('='):
                    total += 1
                    tv = t[c.coordinate].value; rv = r[c.coordinate].value
                    ok = False
                    if isinstance(tv, (int, float)) and isinstance(rv, (int, float)):
                        ok = abs(tv - rv) <= 1e-9 * max(1, abs(tv))
                    else:
                        ok = (tv if tv is not None else '') == (rv if rv is not None else '')
                    if not ok:
                        bad += 1
                        if len(issues) < 25: issues.append((ws.title, c.coordinate, c.value[:90], tv, rv))
    print(name, 'formula cells:', total, 'mismatches:', bad)
    for i in issues: print('  ', i)
    failed = failed or bad > 0 or total == 0
sys.exit(1 if failed else 0)
