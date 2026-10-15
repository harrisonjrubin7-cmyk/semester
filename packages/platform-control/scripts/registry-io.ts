import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { InceptionSnapshot, RegistrySnapshot } from '../types.ts';

export const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const repositoryRoot = resolve(packageRoot, '../..');

async function loadGroup<T>(group: string): Promise<T[]> {
  const directory = resolve(packageRoot, 'registry', group);
  const names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  const output: T[] = [];
  for (const name of names) {
    const value: unknown = JSON.parse(await readFile(resolve(directory, name), 'utf8'));
    if (Array.isArray(value)) output.push(...value as T[]);
    else output.push(value as T);
  }
  return output;
}

/**
 * The event catalog, read from its source rather than imported: this package
 * compiles under `--experimental-strip-types` without a build of
 * `packages/institution`, and the keys are what the registry needs. A key is
 * a quoted `domain.name` on its own line of the `EVENT_TYPES` literal.
 */
export async function loadEventCatalog(): Promise<string[]> {
  const source = await readFile(resolve(repositoryRoot, 'packages/institution/src/events.ts'), 'utf8');
  const start = source.indexOf('export const EVENT_TYPES = {');
  const end = source.indexOf('} as const satisfies Record<string, EventSpec>;', start);
  if (start < 0 || end < 0) return [];
  const keys = new Set<string>();
  for (const match of source.slice(start, end).matchAll(/^\s*'([a-z_]+\.[a-z_]+)':\s*spec\(/gm)) keys.add(match[1]);
  return [...keys].sort();
}

async function loadInception(): Promise<InceptionSnapshot> {
  const [operating_systems, authority, events, permissions, journeys, screen_contracts, adapters, cadence, service_levels, evidence_pack, lifecycle, workstreams, event_catalog] = await Promise.all([
    loadGroup<InceptionSnapshot['operating_systems'][number]>('operating_systems'), loadGroup<InceptionSnapshot['authority'][number]>('authority'),
    loadGroup<InceptionSnapshot['events'][number]>('events'), loadGroup<InceptionSnapshot['permissions'][number]>('permissions'),
    loadGroup<InceptionSnapshot['journeys'][number]>('journeys'), loadGroup<InceptionSnapshot['screen_contracts'][number]>('screen_contracts'),
    loadGroup<InceptionSnapshot['adapters'][number]>('adapters'), loadGroup<InceptionSnapshot['cadence'][number]>('cadence'),
    loadGroup<InceptionSnapshot['service_levels'][number]>('service_levels'), loadGroup<InceptionSnapshot['evidence_pack'][number]>('evidence_pack'),
    loadGroup<InceptionSnapshot['lifecycle'][number]>('lifecycle'), loadGroup<InceptionSnapshot['workstreams'][number]>('workstreams'),
    loadEventCatalog(),
  ]);
  return { operating_systems, authority, events, permissions, journeys, screen_contracts, adapters, cadence, service_levels, evidence_pack, lifecycle, workstreams, event_catalog };
}

export async function loadRegistry(): Promise<RegistrySnapshot> {
  const [capabilities, systems, roles, screens, workflows, integrations, controls, documents, tenants, backlog, manifests, workspaces, inception] = await Promise.all([
    loadGroup<RegistrySnapshot['capabilities'][number]>('capabilities'), loadGroup<RegistrySnapshot['systems'][number]>('systems'),
    loadGroup<RegistrySnapshot['roles'][number]>('roles'), loadGroup<RegistrySnapshot['screens'][number]>('screens'),
    loadGroup<RegistrySnapshot['workflows'][number]>('workflows'), loadGroup<RegistrySnapshot['integrations'][number]>('integrations'),
    loadGroup<RegistrySnapshot['controls'][number]>('controls'), loadGroup<RegistrySnapshot['documents'][number]>('documents'),
    loadGroup<RegistrySnapshot['tenants'][number]>('tenants'), loadGroup<RegistrySnapshot['backlog'][number]>('backlog'),
    loadGroup<NonNullable<RegistrySnapshot['manifests']>[number]>('manifests'), loadGroup<NonNullable<RegistrySnapshot['workspaces']>[number]>('workspaces'),
    loadInception(),
  ]);
  return { capabilities, systems, roles, screens, workflows, integrations, controls, documents, tenants, backlog, manifests, workspaces, inception };
}

export async function writeGenerated(name: string, value: unknown): Promise<void> {
  await writeGeneratedText(name, `${JSON.stringify(value, null, 2)}\n`);
}

export async function writeGeneratedText(name: string, text: string): Promise<void> {
  const directory = resolve(packageRoot, 'generated');
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, name), text, 'utf8');
}
