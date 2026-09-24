import {
  createWorkspace,
  restoreWorkspace,
  type FlightRole,
  type FlightWorkspace,
  type TenantId,
} from "./flight-plan";

export interface FlightStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export type FlightStorageRead = {
  status: "available" | "unavailable" | "rejected" | "restored";
  workspace: FlightWorkspace;
};

export function flightStorageKey(
  tenant: TenantId,
  role: FlightRole,
  personId: string,
): string {
  return `semester.flight-plan.v1.${tenant}.${role}.${personId}`;
}

export function readFlightWorkspace(
  storage: FlightStorage,
  tenant: TenantId,
  role: FlightRole,
  personId: string,
): FlightStorageRead {
  const fallback = createWorkspace(tenant, role);
  let raw: string | null;
  try {
    raw = storage.getItem(flightStorageKey(tenant, role, personId));
  } catch {
    return { status: "unavailable", workspace: fallback };
  }
  if (raw === null) return { status: "available", workspace: fallback };
  const workspace = restoreWorkspace(raw, tenant, role);
  return workspace
    ? { status: "restored", workspace }
    : { status: "rejected", workspace: fallback };
}

export function writeFlightWorkspace(
  storage: FlightStorage,
  personId: string,
  workspace: FlightWorkspace,
): { status: "available" | "unavailable" } {
  try {
    storage.setItem(
      flightStorageKey(workspace.tenant, workspace.role, personId),
      JSON.stringify(workspace),
    );
    return { status: "available" };
  } catch {
    return { status: "unavailable" };
  }
}
