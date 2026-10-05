import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { FlightRole, FlightWorkspace, TenantId } from '../../lib/flight-plan';
import {
  readFlightWorkspace,
  writeFlightWorkspace,
  type FlightStorage,
  type FlightStorageRead,
} from '../../lib/flight-plan-storage';

interface FlightPlanContextValue {
  workspace: FlightWorkspace;
  storageStatus: FlightStorageRead['status'];
  updateWorkspace: (change: (current: FlightWorkspace) => FlightWorkspace) => void;
}

const FlightPlanContext = createContext<FlightPlanContextValue | null>(null);

export function FlightPlanProvider({
  tenant,
  role,
  personId,
  storage = window.localStorage,
  children,
}: {
  tenant: TenantId;
  role: FlightRole;
  personId: string;
  storage?: FlightStorage;
  children: ReactNode;
}) {
  const [snapshot, setSnapshot] = useState(() => {
    const read = readFlightWorkspace(storage, tenant, role, personId);
    return { workspace: read.workspace, storageStatus: read.status };
  });

  const updateWorkspace = useCallback(
    (change: (current: FlightWorkspace) => FlightWorkspace) => {
      setSnapshot((current) => {
        const workspace = change(current.workspace);
        const saved = writeFlightWorkspace(storage, personId, workspace);
        return { workspace, storageStatus: saved.status };
      });
    },
    [personId, storage],
  );

  return (
    <FlightPlanContext.Provider
      value={{
        workspace: snapshot.workspace,
        storageStatus: snapshot.storageStatus,
        updateWorkspace,
      }}
    >
      {children}
    </FlightPlanContext.Provider>
  );
}

export function useFlightPlan(): FlightPlanContextValue {
  const value = useContext(FlightPlanContext);
  if (!value) throw new Error('Flight Plan context is unavailable');
  return value;
}
