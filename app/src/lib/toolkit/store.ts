import { obj, textValue } from '../device-library';
import { blankDeclaration, type Declaration } from './disclosure';
import { USES, type Use } from './policy';
import { readProjects, type Project } from './research';
import { readWorkspaces, type Workspace } from './templates';

/*
 * The Toolkit schema and account-scoped keys live below components so backup
 * validation can reuse the exact readers without making lib depend on React.
 */
export const TOOLKIT_PREFIX = 'semester.toolkit.v1';
export const TOOLKIT_DATA_PREFIX = 'semester.toolkit-data.v1';
export const toolkitKey = (accountId?: string) => `${TOOLKIT_PREFIX}:${accountId || 'device'}`;
export const toolkitDataKey = (accountId?: string) => `${TOOLKIT_DATA_PREFIX}:${accountId || 'device'}`;

export interface ToolkitStore {
  hidden: string[];
  showLess: boolean;
  workspaces: Workspace[];
  research: Project[];
  declaration: Declaration;
}

export const EMPTY: ToolkitStore = { hidden: [], showLess: false, workspaces: [], research: [], declaration: blankDeclaration() };

const USE_IDS = new Set<string>(USES.map(([use]) => use));

function readDeclaration(value: unknown): Declaration {
  const base = blankDeclaration();
  if (!obj(value)) return base;
  const out = { ...base } as Record<string, unknown>;
  for (const key of Object.keys(base) as (keyof Declaration)[]) {
    if (typeof base[key] === 'string' && textValue(value[key], 20_000)) out[key] = value[key];
  }
  out.uses = Array.isArray(value.uses) ? value.uses.filter((use): use is Use => typeof use === 'string' && USE_IDS.has(use)) : [];
  out.inputTier = ['T0', 'T1', 'T2', 'T3'].includes(value.inputTier as string) ? value.inputTier : 'T2';
  out.attested = value.attested === true;
  return out as unknown as Declaration;
}

export function readToolkit(value: unknown): ToolkitStore {
  if (!obj(value)) throw new Error('The toolkit record is not an object.');
  return {
    hidden: Array.isArray(value.hidden) ? value.hidden.filter((entry): entry is string => textValue(entry, 120)) : [],
    showLess: value.showLess === true,
    workspaces: readWorkspaces(value.workspaces ?? []),
    research: readProjects(value.research ?? []),
    declaration: readDeclaration(value.declaration),
  };
}

export const TOOLKIT_BUDGET = 750_000;
