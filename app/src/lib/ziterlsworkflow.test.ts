import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = join(import.meta.dirname, '../../..');
const workflowPath = join(root, '.github/workflows/zite-rls-verifier.yml');
const readWorkflow = () => readFileSync(workflowPath, 'utf8');

function failures(workflow: string): string[] {
  const required = [
    ['manual exact-head dispatch', /^\s{2}workflow_dispatch:/m],
    ['verifier path filter', /'zite\/docs\/execution\/rls\/\*\*'/],
    ['self path filter', /'\.github\/workflows\/zite-rls-verifier\.yml'/],
    ['read-only token', /^permissions:\n\s+contents: read/m],
    ['PostgreSQL 17 service', /image: postgres:17\b/],
    ['Redis service', /image: redis:7\.4-alpine\b/],
    ['no generated lock', /npm install --ignore-scripts --package-lock=false\n\s+test ! -e package-lock\.json/],
    ['all SQL migrations', /migration_006\.sql[\s\S]*migration_007_registrar\.sql[\s\S]*migration_008_registrar_doc\.sql[\s\S]*migration_009_tuition\.sql[\s\S]*migration_010_audit_outbox\.sql[\s\S]*migration_011_files\.sql/],
    ['SQL isolation checks', /bash test\.sh 127\.0\.0\.1 5432/],
    ['TypeScript check', /npm run typecheck/],
    ['executable test suite', /run: npm test/],
  ] as const;
  return required.filter(([, pattern]) => !pattern.test(workflow)).map(([name]) => name);
}

describe('the standalone Zite RLS verifier workflow', () => {
  it('fails closed over its synthetic PostgreSQL and Redis compatibility boundary', () => {
    expect(failures(readWorkflow())).toEqual([]);
  });

  it.each([
    ['database service', 'image: postgres:17', 'image: postgres:16'],
    ['Redis service', 'image: redis:7.4-alpine', 'image: redis:7-alpine'],
    ['lock boundary', 'npm install --ignore-scripts --package-lock=false', 'npm install'],
    ['SQL isolation suite', 'bash test.sh 127.0.0.1 5432', 'true'],
    ['typecheck', 'npm run typecheck', 'true'],
    ['tests', 'run: npm test', 'run: echo skipped'],
  ])('rejects removal of the %s', (_name, held, replacement) => {
    expect(failures(readWorkflow().replace(held, replacement))).not.toEqual([]);
  });
});
