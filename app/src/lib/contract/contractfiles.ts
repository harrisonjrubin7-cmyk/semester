import { readContract } from './tenantcontract';

/**
 * The contracts kept in `contracts/`, one JSON file each, named for the tenant
 * they bind. This reads them the way the platform would and returns what is
 * wrong, never repairing: a file that is not exactly a contract is a finding.
 * Pure, so a test can hand it files and a planted defect can be seen to fail.
 */
export interface ContractFile { name: string; text: string }

export function checkContractFiles(files: readonly ContractFile[]): string[] {
  const problems: string[] = [];
  const seen = new Map<string, string>();
  for (const { name, text } of files) {
    if (name === 'README.md') continue;
    if (!/^[a-z0-9][a-z0-9-]*\.json$/.test(name)) { problems.push(`${name}: a contract is <tenant id>.json, lower case.`); continue; }
    let raw: unknown;
    try { raw = JSON.parse(text); } catch { problems.push(`${name}: not valid JSON.`); continue; }
    const read = readContract(raw);
    if ('error' in read) { problems.push(`${name}: ${read.error}`); continue; }
    const { tenantId } = read.contract;
    if (`${tenantId}.json` !== name) problems.push(`${name}: binds tenant "${tenantId}", so it must be ${tenantId}.json.`);
    const other = seen.get(tenantId);
    if (other) problems.push(`${name}: tenant "${tenantId}" already has a contract in ${other}.`);
    else seen.set(tenantId, name);
  }
  return problems;
}
