import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { checkRegistry, validateComponentDefinition, type ComponentDefinition } from './registry.ts';

const REPO = new URL('../../../', import.meta.url).pathname;
const REGISTRY_DIR = join(REPO, 'docs/control-plane/components');
const SUFFIX = '.component.json';

/** Every way a registry directory can be wrong, as sentences a reviewer can act on. */
function problemsIn(dir: string, repo: string): string[] {
  const out: string[] = [];
  const definitions: ComponentDefinition[] = [];
  for (const name of readdirSync(dir).filter((n) => n !== 'README.md').sort()) {
    if (!name.endsWith(SUFFIX)) {
      out.push(`${name}: a registry file is named <componentId>${SUFFIX}`);
      continue;
    }
    let json: unknown;
    try {
      json = JSON.parse(readFileSync(join(dir, name), 'utf8'));
    } catch {
      out.push(`${name}: not valid JSON`);
      continue;
    }
    const verdict = validateComponentDefinition(json);
    if (!verdict.ok) {
      out.push(...verdict.errors.map((e) => `${name}: ${e}`));
      continue;
    }
    const d = verdict.definition;
    if (name !== `${d.componentId}${SUFFIX}`) out.push(`${name}: componentId is ${d.componentId}`);
    if (!existsSync(join(repo, d.implementation.repositoryRef))) out.push(`${name}: implementation.repositoryRef ${d.implementation.repositoryRef} is not a path in this repository`);
    definitions.push(d);
  }
  out.push(...checkRegistry(definitions).map((p) => `${p.code} ${p.componentId}: ${p.detail}`));
  return out;
}

const good = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  componentId: 'fixture.alpha',
  version: '1',
  domain: 'fixture',
  owner: { teamId: 'fixture_team', supportQueueId: 'fixture_queue' },
  lifecycle: 'development',
  implementation: { repositoryRef: 'packages/institution/src/registry.ts', revision: 'fixture-rev' },
  contracts: [],
  dependencies: [],
  authority: [],
  controls: ['audit_capture'],
  recovery: { runbookRef: 'fixture://runbook', failureBehavior: 'deny_protected_action' },
  ...over,
});

const scratch: string[] = [];
function registryOf(files: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), 'registry-'));
  scratch.push(dir);
  mkdirSync(dir, { recursive: true });
  for (const [name, body] of Object.entries(files)) writeFileSync(join(dir, name), body);
  return dir;
}
afterAll(() => scratch.forEach((d) => rmSync(d, { recursive: true, force: true })));

describe('the checked-in component registry', () => {
  it('is clean as it stands', () => {
    expect(problemsIn(REGISTRY_DIR, REPO)).toEqual([]);
  });
});

describe('the gate over a registry directory can fail (controls)', () => {
  it('accepts a well-formed definition whose path exists', () => {
    const dir = registryOf({ [`fixture.alpha${SUFFIX}`]: JSON.stringify(good()) });
    expect(problemsIn(dir, REPO)).toEqual([]);
  });

  it('refuses a file that is not named for its component', () => {
    const dir = registryOf({ [`other.name${SUFFIX}`]: JSON.stringify(good()) });
    expect(problemsIn(dir, REPO)).toEqual([`other.name${SUFFIX}: componentId is fixture.alpha`]);
  });

  it('refuses a repository path that does not exist', () => {
    const dir = registryOf({ [`fixture.alpha${SUFFIX}`]: JSON.stringify(good({ implementation: { repositoryRef: 'nowhere/at/all.ts', revision: 'r' } })) });
    expect(problemsIn(dir, REPO)).toHaveLength(1);
    expect(problemsIn(dir, REPO)[0]).toContain('is not a path in this repository');
  });

  it('refuses malformed JSON, a bad shape and a stray file', () => {
    const dir = registryOf({ [`a.broken${SUFFIX}`]: '{', [`b.shape${SUFFIX}`]: JSON.stringify(good({ lifecycle: 'live' })), 'notes.txt': 'x' });
    const found = problemsIn(dir, REPO);
    expect(found).toContain(`a.broken${SUFFIX}: not valid JSON`);
    expect(found.some((p) => p.startsWith(`b.shape${SUFFIX}: $.lifecycle`))).toBe(true);
    expect(found).toContain(`notes.txt: a registry file is named <componentId>${SUFFIX}`);
  });

  it('refuses a dependency on a component nobody registered', () => {
    const dir = registryOf({ [`fixture.alpha${SUFFIX}`]: JSON.stringify(good({ dependencies: [{ componentId: 'fixture.missing', kind: 'synchronous', failureBehavior: 'block' }] })) });
    expect(problemsIn(dir, REPO).some((p) => p.startsWith('UNKNOWN_DEPENDENCY fixture.alpha'))).toBe(true);
  });
});
