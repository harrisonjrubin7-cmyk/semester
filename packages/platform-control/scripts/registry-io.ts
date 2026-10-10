import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { RegistrySnapshot } from '../types.ts';

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

export async function loadRegistry(): Promise<RegistrySnapshot> {
  const [capabilities, systems, roles, screens, workflows, integrations, controls, documents, tenants, backlog, manifests, workspaces] = await Promise.all([
    loadGroup<RegistrySnapshot['capabilities'][number]>('capabilities'), loadGroup<RegistrySnapshot['systems'][number]>('systems'),
    loadGroup<RegistrySnapshot['roles'][number]>('roles'), loadGroup<RegistrySnapshot['screens'][number]>('screens'),
    loadGroup<RegistrySnapshot['workflows'][number]>('workflows'), loadGroup<RegistrySnapshot['integrations'][number]>('integrations'),
    loadGroup<RegistrySnapshot['controls'][number]>('controls'), loadGroup<RegistrySnapshot['documents'][number]>('documents'),
    loadGroup<RegistrySnapshot['tenants'][number]>('tenants'), loadGroup<RegistrySnapshot['backlog'][number]>('backlog'),
    loadGroup<NonNullable<RegistrySnapshot['manifests']>[number]>('manifests'), loadGroup<NonNullable<RegistrySnapshot['workspaces']>[number]>('workspaces'),
  ]);
  return { capabilities, systems, roles, screens, workflows, integrations, controls, documents, tenants, backlog, manifests, workspaces };
}

export async function writeGenerated(name: string, value: unknown): Promise<void> {
  const directory = resolve(packageRoot, 'generated');
  await mkdir(directory, { recursive: true });
  await writeFile(resolve(directory, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
