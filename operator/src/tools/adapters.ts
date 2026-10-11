import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import type { EvidenceItem, PolicyContext, RiskLevel, ToolAction, ToolName } from '../../types.ts';
import type { AuditLog } from '../control/audit.ts';
import type { RunLimiter } from '../control/limits.ts';
import type { PolicyController } from '../control/policy.ts';
import { payloadHash, sha256 } from '../store/hash.ts';
import { redactString } from '../store/redact.ts';
import { workspaceDiff } from './workspace.ts';

/**
 * Narrow tool adapters. Each one does exactly one thing, asks the policy
 * controller first, spends a tool call on the limiter, and records the
 * decision as evidence. There is no generic shell: `run_check` executes
 * only an allowlisted argv, without a shell, with a timeout.
 */
export class ToolDenied extends Error {
  readonly tool: ToolName;
  readonly target: string;
  readonly code: string;
  constructor(tool: ToolName, target: string, code: string, reason: string) {
    super(`${tool} ${target} denied (${code}): ${reason}`);
    this.tool = tool; this.target = target; this.code = code;
  }
}

export interface Toolbox {
  readFile(path: string): string;
  listFiles(dir: string, maxEntries?: number): string[];
  search(dir: string, pattern: RegExp, maxMatches?: number): Array<{ path: string; line: number; text: string }>;
  writeFile(path: string, content: string): EvidenceItem;
  runCheck(key: string, cwd?: string): EvidenceItem & { kind: 'command' };
  gitDiff(): EvidenceItem & { kind: 'diff'; text: string };
  readonly evidence: EvidenceItem[];
}

const MAX_READ_BYTES = 512 * 1024;

export function createToolbox(policy: PolicyController, context: PolicyContext, limiter: RunLimiter, audit: AuditLog, onDenied?: (evidence: EvidenceItem) => void): Toolbox {
  const evidence: EvidenceItem[] = [];
  const base = context.workspaceRoot || context.repositoryRoot;

  function gate(action: ToolAction): void {
    const spent = limiter.consume('tool');
    if (!spent.ok) throw new ToolDenied(action.tool, action.target, spent.code, spent.reason);
    const decision = policy.evaluate(action, context);
    // Records name the target relative to the repository, so evidence reads the same on any machine.
    const shown = recorded(action.target);
    const item: EvidenceItem = { kind: 'decision', label: `${action.tool}:${shown}`, tool: action.tool, target: shown, allowed: decision.allowed, code: decision.code };
    evidence.push(item);
    audit.record('policy.decision', context.agentId, { tool: action.tool, target: shown, code: decision.code, allowed: decision.allowed, requiresApproval: decision.requiresApproval }, context.taskId);
    if (!decision.allowed) { onDenied?.(item); throw new ToolDenied(action.tool, action.target, decision.code, decision.reason); }
  }

  const absolute = (path: string) => resolve(base, path);
  // A directory grant is not a file grant: every file a walker reaches is checked against the protected reads, and a protected one is neither listed nor searched.
  const skipped: string[] = [];
  const protectedRead = (full: string) => { const hit = policy.protectedRead(full, context); if (hit) skipped.push(relative(base, full)); return hit; };
  const recorded = (target: string) => { if (!target.startsWith('/')) return target; const rel = relative(context.repositoryRoot, target); if (rel === '') return '.'; return rel.startsWith('..') ? target : rel; };
  const risk: RiskLevel = 'low';
  const noteSkipped = (tool: ToolName) => { if (!skipped.length) return; evidence.push({ kind: 'note', label: `${tool}:protected_reads_skipped`, detail: `${skipped.length} protected file(s) were not ${tool === 'search' ? 'searched' : 'listed'}: ${skipped.slice(0, 5).join(', ')}${skipped.length > 5 ? ', …' : ''}` }); skipped.length = 0; };

  return {
    evidence,
    readFile(path) {
      gate({ tool: 'read_file', target: absolute(path), risk });
      // Read first, then measure what was read: a size check before the read would be a check on a file that can change in between.
      const bytes = readFileSync(absolute(path));
      if (bytes.byteLength > MAX_READ_BYTES) throw new ToolDenied('read_file', path, 'file_too_large', `${bytes.byteLength} bytes exceeds ${MAX_READ_BYTES}.`);
      return bytes.toString('utf8');
    },
    listFiles(dir, maxEntries = 500) {
      gate({ tool: 'list_files', target: absolute(dir), risk });
      const out: string[] = [];
      const walk = (current: string) => {
        if (out.length >= maxEntries) return;
        for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
          if (entry.name === 'node_modules' || entry.name === '.git' || out.length >= maxEntries) continue;
          const full = join(current, entry.name);
          if (entry.isDirectory()) walk(full); else if (!protectedRead(full)) out.push(relative(base, full));
        }
      };
      walk(absolute(dir));
      noteSkipped('list_files');
      return out;
    },
    search(dir, pattern, maxMatches = 200) {
      gate({ tool: 'search', target: absolute(dir), risk });
      const matches: Array<{ path: string; line: number; text: string }> = [];
      const walk = (current: string) => {
        for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
          if (matches.length >= maxMatches) return;
          if (entry.name === 'node_modules' || entry.name === '.git') continue;
          const full = join(current, entry.name);
          if (entry.isDirectory()) { walk(full); continue; }
          if (protectedRead(full)) continue;
          const bytes = readFileSync(full);
          if (bytes.byteLength > MAX_READ_BYTES) continue;
          bytes.toString('utf8').split('\n').forEach((text, index) => { if (matches.length < maxMatches && pattern.test(text)) matches.push({ path: relative(base, full), line: index + 1, text: redactString(text.slice(0, 200)) }); });
        }
      };
      walk(absolute(dir));
      noteSkipped('search');
      return matches;
    },
    writeFile(path, content) {
      const target = absolute(path);
      gate({ tool: 'write_file', target, risk: 'medium', payloadHash: payloadHash({ path, content }) });
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, content, 'utf8');
      const item: EvidenceItem = { kind: 'file', label: `wrote ${path}`, path: relative(base, target), sha256: sha256(content), bytes: Buffer.byteLength(content) };
      evidence.push(item);
      return item;
    },
    runCheck(key, cwd) {
      gate({ tool: 'run_check', target: key, risk: 'low' });
      const command = policy.policy.commands[key]!;
      const runIn = resolve(cwd ?? base, command.cwd);
      const result = spawnSync(command.argv[0]!, command.argv.slice(1), { cwd: runIn, encoding: 'utf8', timeout: command.timeoutMs, env: minimalEnv(), shell: false, maxBuffer: 16 * 1024 * 1024 });
      // A missing working directory or executable surfaces as ENOENT from spawn itself; no separate existence check, so nothing can change between check and use.
      if (result.error && (result.error as NodeJS.ErrnoException).code === 'ENOENT') throw new ToolDenied('run_check', key, 'cwd_or_executable_missing', `${command.argv[0]} in ${runIn}: ${result.error.message}`);
      const stdout = result.stdout ?? '';
      const stderr = result.stderr ?? '';
      const exitCode = result.status ?? (result.error ? 124 : 1);
      const tail = redactString(`${stdout}\n${stderr}`.trim().split('\n').slice(-12).join('\n'));
      const item: EvidenceItem & { kind: 'command' } = { kind: 'command', label: key, command: command.argv.join(' '), cwd: relative(context.repositoryRoot, runIn) || '.', exitCode, stdoutSha256: sha256(stdout), stderrSha256: sha256(stderr), tail };
      evidence.push(item);
      audit.record('check.ran', context.agentId, { key, exitCode, timedOut: result.error?.name === 'Error' && /ETIMEDOUT|timeout/i.test(result.error.message) }, context.taskId);
      return item;
    },
    gitDiff() {
      if (!context.workspaceRoot) throw new ToolDenied('git_diff', '', 'no_workspace', 'This task has no workspace.');
      gate({ tool: 'git_diff', target: context.workspaceRoot, risk });
      const diff = workspaceDiff(context.workspaceRoot);
      const item = { kind: 'diff' as const, label: 'workspace diff', sha256: sha256(diff.text), files: diff.files, bytes: Buffer.byteLength(diff.text), text: diff.text };
      evidence.push({ kind: 'diff', label: item.label, sha256: item.sha256, files: item.files, bytes: item.bytes });
      return item;
    },
  };
}

/** Checks run with a minimal environment: no proxy credentials, no API keys, no inherited secrets. */
function minimalEnv(): NodeJS.ProcessEnv {
  const keep = ['PATH', 'HOME', 'LANG', 'TZ', 'NODE_OPTIONS', 'CI'];
  const env: NodeJS.ProcessEnv = {};
  for (const key of keep) if (process.env[key] !== undefined) env[key] = process.env[key];
  env.SEMESTER_OPERATOR = '1';
  return env;
}
