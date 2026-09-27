import { obj, textValue, useDeviceLibrary } from '../../lib/device-library';
import { DATA_BUDGET, readDataProjects, type DataProject } from '../../lib/toolkit/data';
import { blankDeclaration, type Declaration } from '../../lib/toolkit/disclosure';
import { USES, type Use } from '../../lib/toolkit/policy';
import { readProjects, type Project } from '../../lib/toolkit/research';
import { readWorkspaces, type Workspace } from '../../lib/toolkit/templates';

/**
 * Where the toolkit keeps the student's work: this device, under keys of its
 * own, through `useDeviceLibrary` — the store that refuses to overwrite a
 * record it cannot read. None of it is in the synced term.
 *
 * Datasets get a key of their own because they are the only large thing here,
 * and a 2 MB CSV should not be rewritten every time a stage note changes.
 */

/*
 * Keyed by account, as Family, Pathway, Career and Athletics are. A shared
 * laptop is ordinary on a campus, and a toolkit keyed only by device would
 * show the next student who signs in the last one's research, datasets and
 * AI-use declaration. `device` is the key for nobody signed in.
 */
export const toolkitKey = (accountId?: string) => `semester.toolkit.v1:${accountId || 'device'}`;
export const toolkitDataKey = (accountId?: string) => `semester.toolkit-data.v1:${accountId || 'device'}`;

export interface ToolkitStore {
  hidden: string[];
  showLess: boolean;
  workspaces: Workspace[];
  research: Project[];
  declaration: Declaration;
}

export const EMPTY: ToolkitStore = { hidden: [], showLess: false, workspaces: [], research: [], declaration: blankDeclaration() };

const USE_IDS = new Set<string>(USES.map(([u]) => u));

function readDeclaration(v: unknown): Declaration {
  const base = blankDeclaration();
  if (!obj(v)) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof Declaration)[]) if (typeof base[key] === 'string' && textValue(v[key], 20_000)) out[key] = v[key];
  out.uses = Array.isArray(v.uses) ? v.uses.filter((u): u is Use => typeof u === 'string' && USE_IDS.has(u)) : [];
  out.inputTier = ['T0', 'T1', 'T2', 'T3'].includes(v.inputTier as string) ? v.inputTier : 'T2';
  out.attested = v.attested === true;
  return out as unknown as Declaration;
}

export function readToolkit(v: unknown): ToolkitStore {
  if (!obj(v)) throw new Error('The toolkit record is not an object.');
  return {
    hidden: Array.isArray(v.hidden) ? v.hidden.filter((x): x is string => textValue(x, 120)) : [],
    showLess: v.showLess === true,
    workspaces: readWorkspaces(v.workspaces ?? []),
    research: readProjects(v.research ?? []),
    declaration: readDeclaration(v.declaration),
  };
}

/*
 * Budgets for the toolkit's two keys, together well inside the origin's
 * localStorage quota so Semester's other keys always have room. See
 * `DATA_BUDGET` in lib/toolkit/data.ts for why this matters.
 */
export const TOOLKIT_BUDGET = 750_000;

export const useToolkit = (accountId?: string) => useDeviceLibrary(toolkitKey(accountId), readToolkit, EMPTY, TOOLKIT_BUDGET);
/* A module constant, not a literal: `useDeviceLibrary` keys its read on `empty`,
   and a fresh `[]` each render re-reads and re-renders without end. */
const NO_DATA: DataProject[] = [];
export const useToolkitData = (accountId?: string) =>
  useDeviceLibrary<DataProject[]>(toolkitDataKey(accountId), readDataProjects, NO_DATA, DATA_BUDGET);

export const newId = () => crypto.randomUUID();
