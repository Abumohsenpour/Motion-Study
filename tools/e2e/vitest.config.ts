// Separate config so this check runs only after manual-entry.cjs (`npm run test:manual`), never with `npm test`.
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { environment: 'node', include: ['tools/e2e/*.test.ts'] },
});
