import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../../..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const workflow = read('.github/workflows/course-engine.yml');
const manifest = read('course-engine/apps/api/pyproject.toml');
const lock = read('course-engine/apps/api/uv.lock');
const apiImage = read('course-engine/apps/api/Dockerfile');
const workerImage = read('course-engine/apps/worker/Dockerfile');
const readme = read('course-engine/README.md');

function workflowProblems(source: string): string[] {
  const problems: string[] = [];
  if (!/python3 -m pip install --disable-pip-version-check uv==0\.13\.6/.test(source)) problems.push('uv is not pinned');
  if (!/uv sync --locked --extra dev\n\s+git diff --exit-code -- uv\.lock/.test(source)) problems.push('the lock is not installed and drift checked');
  if (!/uv run --locked --extra dev ruff check/.test(source)) problems.push('lint can resolve outside the lock');
  if (!/uv run --locked --extra dev pytest -q/.test(source)) problems.push('tests can resolve outside the lock');
  if (/pip install[^\n]*-e '\.\[dev\]'/.test(source)) problems.push('the mutable editable install remains');
  return problems;
}

describe('Course Engine Python resolver lock', () => {
  it('commits a Python 3.12 uv graph with hashes for registry artifacts', () => {
    expect(lock).toMatch(/^version = 1$/m);
    expect(lock).toMatch(/^requires-python = ">=3\.12"$/m);
    expect(lock.match(/^\[\[package\]\]$/gm)?.length ?? 0).toBeGreaterThan(80);
    expect(lock).toContain('name = "course-engine-api"');

    const registryPackages = lock.split('[[package]]').filter((entry) => entry.includes('registry = "https://pypi.org/simple"'));
    expect(registryPackages.length).toBeGreaterThan(80);
    expect(registryPackages.every((entry) => /hash = "sha256:[a-f0-9]{64}"/.test(entry))).toBe(true);
  });

  it('locks every direct production and test dependency named by the manifest', () => {
    const projectDependencies = manifest.split('[build-system]')[0];
    const declarations = [...projectDependencies.matchAll(/"([a-z0-9-]+)(?:\[[^\]]+\])?>=/gi)].map((match) => match[1].toLowerCase());
    expect(declarations.length).toBeGreaterThan(20);
    for (const name of declarations) expect(lock, `${name} is absent from uv.lock`).toContain(`name = "${name}"`);
  });

  it('installs and executes the exact graph in both database jobs', () => {
    expect(workflowProblems(workflow)).toEqual([]);
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('matrix:\n        database: [sqlite, postgres]');
  });

  it('builds both locked candidate images without publishing them', () => {
    expect(workflow).toContain('image: [api, worker]');
    expect(workflow).toContain('docker build --file "course-engine/apps/${{ matrix.image }}/Dockerfile"');
    expect(workflow).not.toMatch(/docker push|push:\s*true/);
  });

  it.each([
    ['mutable install', workflow.replace('uv sync --locked --extra dev', "python -m pip install -e '.[dev]'"), 'the lock is not installed and drift checked'],
    ['unpinned uv', workflow.replace('uv==0.13.6', 'uv'), 'uv is not pinned'],
    ['unlocked tests', workflow.replace('uv run --locked --extra dev pytest -q', 'uv run pytest -q'), 'tests can resolve outside the lock'],
  ])('rejects %s', (_name, source, message) => {
    expect(workflowProblems(source)).toContain(message);
  });

  it.each([
    ['API', apiImage],
    ['worker', workerImage],
  ])('builds the %s image from the committed production graph', (_name, source) => {
    expect(source).toContain('uv==0.13.6');
    expect(source).toContain('uv sync --locked --no-dev --no-editable');
    expect(source).toContain('ENV PATH="/app/.venv/bin:$PATH"');
    expect(source).not.toMatch(/RUN pip install --no-cache-dir \.$/m);
  });

  it('documents the same frozen developer install', () => {
    expect(readme).toContain('python3.12 -m pip install uv==0.13.6');
    expect(readme).toContain('uv sync --locked --extra dev');
    expect(readme).not.toContain("pip install -e '.[dev]'");
  });
});
