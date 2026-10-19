#!/usr/bin/env bash
# Independent check of the Excel workbook's formulas with LibreOffice (headless). Needs: soffice, python3 + openpyxl.
set -euo pipefail
cd "$(dirname "$0")/../.."
D="$PWD/tools/excel-verify/work"
rm -rf "$D" && mkdir -p "$D/profile/user" "$D/out"
cp tools/excel-verify/profile.xcu "$D/profile/user/registrymodifications.xcu"
XLSX_VERIFY_DIR="$D" npx vitest run -c tools/excel-verify/vitest.config.ts
soffice -env:UserInstallation="file://$D/profile" --headless --convert-to xlsx --outdir "$D/out" \
  "$D/worked-poison.xlsx" "$D/demo-poison.xlsx" >/dev/null 2>&1
python3 -I tools/excel-verify/compare.py "$D"
