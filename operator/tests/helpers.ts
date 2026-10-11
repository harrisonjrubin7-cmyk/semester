import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PolicySet } from '../types.ts';

export function tempDir(prefix = 'operator-'): string { return mkdtempSync(join(tmpdir(), prefix)); }

export function git(cwd: string, ...args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8', env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@example.com', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@example.com' } });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

/** A tiny repository with a check script, so the runtime can be exercised without the real tree. */
export function tempRepository(): string {
  const root = tempDir('operator-repo-');
  git(root, 'init', '-q', '-b', 'main');
  mkdirSync(join(root, 'packages/fixture'), { recursive: true });
  mkdirSync(join(root, 'docs'), { recursive: true });
  writeFileSync(join(root, 'README.md'), '# fixture\n');
  writeFileSync(join(root, 'packages/fixture/index.ts'), 'export const answer = 41;\n');
  writeFileSync(join(root, 'check.mjs'), 'import { readFileSync } from "node:fs"; const text = readFileSync("packages/fixture/index.ts", "utf8"); process.exit(text.includes("42") ? 0 : 1);\n');
  writeFileSync(join(root, '.env'), 'SECRET_TOKEN=sk-live-abcdefghijklmnopqrstuvwxyz0123456789\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'fixture');
  return root;
}

export const testPolicy: PolicySet = {
  version: 1,
  protectedPaths: ['policy/**', '.github/**', '.env', '**/.env'],
  protectedReads: ['.env', '**/.env'],
  commands: {
    'fixture:check': { argv: ['node', 'check.mjs'], cwd: '.', timeoutMs: 20000 },
    'fixture:fail': { argv: ['node', '-e', 'process.exit(3)'], cwd: '.', timeoutMs: 20000 },
  },
  approvalRequiredFrom: 'high',
  approvalEnvironments: ['staging', 'production'],
};
