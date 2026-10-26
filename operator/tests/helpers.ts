import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { PolicySet } from '../types.ts';
import type { ModelPort, ModelRequest, ModelResponse } from '../src/runtime/model.ts';
import type { ReleaseAdapter, ReleaseRequest } from '../src/runtime/release.ts';
import type { SendAdapter, SendRequest, SendResult } from '../src/runtime/send.ts';

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

/**
 * A scripted model: each entry is the next reply, as text or as a function
 * of the request. It records every request so a test can assert what the
 * model was told. It is a test double, never a port the runtime constructs.
 */
export function scriptedModel(script: Array<string | object | ((request: ModelRequest, turn: number) => string | object)>, costUsd?: number): ModelPort & { requests: ModelRequest[] } {
  const requests: ModelRequest[] = [];
  return {
    name: 'scripted', requests,
    async respond(request): Promise<ModelResponse> {
      requests.push({ system: request.system, messages: request.messages.map((m) => ({ ...m })) });
      const turn = requests.length;
      const entry = script[Math.min(turn, script.length) - 1];
      if (entry === undefined) throw new Error('scripted model has no reply left');
      const reply = typeof entry === 'function' ? entry(request, turn) : entry;
      return { text: typeof reply === 'string' ? reply : JSON.stringify(reply), inputTokens: 10, outputTokens: 5, costUsd };
    },
  };
}

/** A recording release adapter: remembers every request and answers with a reference, or throws when told to fail. */
export function recordingRelease(options: { fail?: boolean } = {}): ReleaseAdapter & { requests: ReleaseRequest[] } {
  const requests: ReleaseRequest[] = [];
  return {
    name: 'recording', requests,
    async release(request) {
      requests.push(request);
      if (options.fail) throw new Error('provider returned 502 after accepting the deploy');
      return { reference: `deploy-${requests.length}`, detail: `${request.target}@${request.artifactHash.slice(0, 8)}` };
    },
  };
}

export function recordingSend(options: { fail?: boolean; sends?: boolean } = {}): SendAdapter & { requests: SendRequest[] } {
  const requests: SendRequest[] = [];
  const perform = async (request: SendRequest): Promise<SendResult> => {
    requests.push(request);
    if (options.fail) throw new Error('provider returned 502 after accepting the message');
    return { reference: `${request.action}-${requests.length}`, detail: `${request.channel}:${request.recipient}@${request.contentHash.slice(0, 8)}` };
  };
  return { name: 'recording', requests, supports: { draft: true, send: options.sends === true }, draft: perform, send: perform };
}
