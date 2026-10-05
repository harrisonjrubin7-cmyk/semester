import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkContractFiles, type ContractFile } from './contractfiles';

const root = join(import.meta.dirname, '../../../..');
const dir = join(root, 'contracts');

const good = {
  tenantId: 'vandy', effectiveFrom: '2026-07-01', effectiveTo: null, modules: [], prohibited: [],
  ai: { providers: [], sources: 'institution_only', annualTokenBudget: null },
  regions: ['us'], adminMfa: true, support: { tier: 'standard', escalation: null },
};
const file = (name: string, c: unknown = good): ContractFile => ({ name, text: typeof c === 'string' ? c : JSON.stringify(c) });

describe('the contracts kept in the repository', () => {
  it('are all sound, each named for its tenant', () => {
    const files = readdirSync(dir).map((name) => ({ name, text: readFileSync(join(dir, name), 'utf8') }));
    expect(checkContractFiles(files)).toEqual([]);
  });

  it('are written by the owner alone: CODEOWNERS routes the directory to him, and to nobody else', () => {
    const owners = readFileSync(join(root, '.github', 'CODEOWNERS'), 'utf8');
    const line = owners.split('\n').find((l) => /^\/contracts\/\s/.test(l));
    expect(line, 'CODEOWNERS has no line for /contracts/').toBeDefined();
    expect(line!.trim().split(/\s+/).slice(1)).toEqual(['@harrisonjrubin7-cmyk']);
  });

  it('say who writes them and that none is recorded', () => {
    const readme = readFileSync(join(dir, 'README.md'), 'utf8');
    expect(readme).toContain('Harrison Rubin');
    expect(readme).toContain('Empty today');
  });
});

describe('the check, on files handed to it', () => {
  it('accepts a sound contract and ignores the README', () => {
    expect(checkContractFiles([file('vandy.json'), { name: 'README.md', text: '# x' }])).toEqual([]);
  });

  it('refuses a file that is not JSON, not a contract, or not named like one', () => {
    expect(checkContractFiles([file('vandy.json', '{not json')])).toEqual(['vandy.json: not valid JSON.']);
    expect(checkContractFiles([file('vandy.json', [])])).toEqual(['vandy.json: The contract is not an object.']);
    expect(checkContractFiles([file('Vandy.json')])[0]).toMatch(/lower case/);
    expect(checkContractFiles([file('vandy.yaml')])[0]).toMatch(/lower case/);
  });

  it('refuses a contract that widens what the platform closes, without repairing it', () => {
    const r = checkContractFiles([file('vandy.json', { ...good, modules: ['not.a.flag'] })]);
    expect(r).toEqual(['vandy.json: not.a.flag is not a registered flag.']);
  });

  it('refuses a file that binds a different tenant from the one it is named for', () => {
    expect(checkContractFiles([file('rice.json')])).toEqual(['rice.json: binds tenant "vandy", so it must be vandy.json.']);
  });

  it('refuses two files for one tenant', () => {
    const r = checkContractFiles([file('vandy.json'), file('vandy-old.json')]);
    expect(r.some((m) => /already has a contract in vandy\.json/.test(m))).toBe(true);
  });
});
