import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { packageRoot } from './registry-io.ts';

function option(name: string): string | undefined {
  const index = process.argv.indexOf(`--${name}`);
  return index < 0 ? undefined : process.argv[index + 1];
}

const key = option('key');
const name = option('name');
const owner = option('owner');
const synthetic = process.argv.includes('--synthetic');
const keyPattern = /^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/;

if (!key || !keyPattern.test(key) || !name?.trim() || !owner?.trim()) {
  console.error('Usage: npm run tenant:create -- --key <stable-key> --name <display-name> --owner <owner> --synthetic');
  process.exitCode = 2;
} else if (!synthetic) {
  console.error('Tenant creation is registry-only and requires --synthetic. Production provisioning and activation require external approvals and evidence.');
  process.exitCode = 2;
} else {
  const record = {
    key: `tenant.${key}`,
    name: name.trim(),
    owner: owner.trim(),
    status: 'designed',
    synthetic: true,
    activation: 'not_activated',
    evidence: ['packages/platform-control/registry/tenants'],
  };
  const path = resolve(packageRoot, 'registry', 'tenants', `${key}.json`);
  try {
    await writeFile(path, `${JSON.stringify(record, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    console.log(JSON.stringify({ created: record.key, path, activation: record.activation }, null, 2));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      console.error(`Tenant registry record already exists: ${path}`);
      process.exitCode = 1;
    } else throw error;
  }
}
