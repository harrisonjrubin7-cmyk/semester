import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Isolated development workspaces.
 *
 * A task that may write gets its own git worktree on its own branch,
 * created from an exact commit, under the state directory. Workers write
 * only there; the policy controller refuses any write outside it. Nothing
 * here pushes, merges or touches the checkout the operator runs from.
 */
export interface Workspace { path: string; branch: string; baseCommit: string }

function git(cwd: string, args: string[]): string {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${(result.stderr || result.stdout).trim()}`);
  return result.stdout.trim();
}

export function createWorkspace(repositoryRoot: string, stateRoot: string, taskId: string, baseRef = 'HEAD'): Workspace {
  const baseCommit = git(repositoryRoot, ['rev-parse', '--verify', `${baseRef}^{commit}`]);
  const path = resolve(stateRoot, 'workspaces', taskId);
  const branch = `operator/${taskId}`;
  if (existsSync(path)) removeWorkspace(repositoryRoot, path, branch);
  mkdirSync(resolve(stateRoot, 'workspaces'), { recursive: true });
  git(repositoryRoot, ['worktree', 'add', '--detach', path, baseCommit]);
  git(path, ['checkout', '-B', branch]);
  return { path, branch, baseCommit };
}

export function removeWorkspace(repositoryRoot: string, path: string, branch?: string): void {
  if (existsSync(path)) {
    const result = spawnSync('git', ['worktree', 'remove', '--force', path], { cwd: repositoryRoot, encoding: 'utf8' });
    if (result.status !== 0) rmSync(path, { recursive: true, force: true });
  }
  spawnSync('git', ['worktree', 'prune'], { cwd: repositoryRoot });
  if (branch) spawnSync('git', ['branch', '-D', branch], { cwd: repositoryRoot });
}

export function workspaceDiff(path: string): { text: string; files: string[] } {
  git(path, ['add', '-A', '--intent-to-add']);
  const text = git(path, ['diff']);
  const files = git(path, ['diff', '--name-only']).split('\n').filter(Boolean);
  return { text, files };
}

export function workspaceHead(path: string): string { return git(path, ['rev-parse', 'HEAD']); }

export function isWorkspace(path: string): boolean { return existsSync(join(path, '.git')); }
