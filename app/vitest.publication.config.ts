import { defineConfig } from 'vitest/config';

process.env.SEMESTER_PUBLICATION_REQUIRED = '1';

/** Explicit external-artifact verification; missing files still fail. */
export default defineConfig({ test: { include: ['scripts/rollout-publication.test.ts'] } });
