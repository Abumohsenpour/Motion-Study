// Separate config so the workbook writer runs only on demand (`npm run verify:excel`), never with `npm test`.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['tools/excel-verify/*.test.ts'] },
});
