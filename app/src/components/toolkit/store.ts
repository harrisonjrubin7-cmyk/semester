import { obj, textValue, useDeviceLibrary } from '../../lib/device-library';
import { readProjects, type Project } from '../../lib/toolkit/research';
import { readWorkspaces, type Workspace } from '../../lib/toolkit/templates';

/**
 * Where the toolkit keeps the student's work: this device, under keys of its
 * own, through `useDeviceLibrary` — the store that refuses to overwrite a
 * record it cannot read. None of it is in the synced term.
 */

export const TOOLKIT_KEY = 'semester.toolkit.v1';

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

export const useToolkit = () => useDeviceLibrary(TOOLKIT_KEY, readToolkit, EMPTY);

export const newId = () => crypto.randomUUID();
