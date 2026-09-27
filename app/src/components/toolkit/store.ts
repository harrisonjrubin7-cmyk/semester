import { obj, textValue, useDeviceLibrary } from '../../lib/device-library';
import { DATA_BUDGET, readDataProjects, type DataProject } from '../../lib/toolkit/data';
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

export const TOOLKIT_KEY = 'semester.toolkit.v1';
export const TOOLKIT_DATA_KEY = 'semester.toolkit-data.v1';

export interface ToolkitStore {
  hidden: string[];
  showLess: boolean;
  workspaces: Workspace[];
  research: Project[];
}

export const EMPTY: ToolkitStore = { hidden: [], showLess: false, workspaces: [], research: [] };

export function readToolkit(v: unknown): ToolkitStore {
  if (!obj(v)) throw new Error('The toolkit record is not an object.');
  return {
    hidden: Array.isArray(v.hidden) ? v.hidden.filter((x): x is string => textValue(x, 120)) : [],
    showLess: v.showLess === true,
    workspaces: readWorkspaces(v.workspaces ?? []),
    research: readProjects(v.research ?? []),
  };
}

/*
 * Budgets for the toolkit's two keys, together well inside the origin's
 * localStorage quota so Semester's other keys always have room. See
 * `DATA_BUDGET` in lib/toolkit/data.ts for why this matters.
 */
export const TOOLKIT_BUDGET = 750_000;

export const useToolkit = () => useDeviceLibrary(TOOLKIT_KEY, readToolkit, EMPTY, TOOLKIT_BUDGET);
/* A module constant, not a literal: `useDeviceLibrary` keys its read on `empty`,
   and a fresh `[]` each render re-reads and re-renders without end. */
const NO_DATA: DataProject[] = [];
export const useToolkitData = () => useDeviceLibrary<DataProject[]>(TOOLKIT_DATA_KEY, readDataProjects, NO_DATA, DATA_BUDGET);

export const newId = () => crypto.randomUUID();
