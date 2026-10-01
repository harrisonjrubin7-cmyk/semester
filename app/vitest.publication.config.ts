import { defineConfig } from 'vitest/config';

/** Explicit external-artifact verification; missing files still fail. */
export default defineConfig({ test: { include: ['scripts/rollout-publication.test.ts'] } });
