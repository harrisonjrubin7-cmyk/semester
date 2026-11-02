import { useDeviceLibrary } from '../../lib/device-library';
import { DATA_BUDGET, readDataProjects, type DataProject } from '../../lib/toolkit/data';
import {
  EMPTY,
  TOOLKIT_BUDGET,
  readToolkit,
  toolkitDataKey,
  toolkitKey,
} from '../../lib/toolkit/store';

export { EMPTY, TOOLKIT_BUDGET, readToolkit, toolkitDataKey, toolkitKey } from '../../lib/toolkit/store';
export type { ToolkitStore } from '../../lib/toolkit/store';

/**
 * Where the toolkit keeps the student's work: this device, under keys of its
 * own, through `useDeviceLibrary` — the store that refuses to overwrite a
 * record it cannot read. None of it is in the synced term.
 *
 * Datasets get a key of their own because they are the only large thing here,
 * and a 2 MB CSV should not be rewritten every time a stage note changes.
 */

export const useToolkit = (accountId?: string) => useDeviceLibrary(toolkitKey(accountId), readToolkit, EMPTY, TOOLKIT_BUDGET);
/* A module constant, not a literal: `useDeviceLibrary` keys its read on `empty`,
   and a fresh `[]` each render re-reads and re-renders without end. */
const NO_DATA: DataProject[] = [];
export const useToolkitData = (accountId?: string) =>
  useDeviceLibrary<DataProject[]>(toolkitDataKey(accountId), readDataProjects, NO_DATA, DATA_BUDGET);

export const newId = () => crypto.randomUUID();
