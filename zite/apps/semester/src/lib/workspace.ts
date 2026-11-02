import { createContext, useContext } from 'react';
import type { GetWorkspaceOutputType } from 'zitejs/api';

export type Membership = GetWorkspaceOutputType['memberships'][0];
export type WorkspaceCtx = {
  membership: Membership;
  role: string;
  setRole: (r: string) => void;
  refresh: () => void;
};
export const WorkspaceContext = createContext<WorkspaceCtx | null>(null);
export const useWorkspace = () => {
  const c = useContext(WorkspaceContext);
  if (!c) throw new Error('No workspace');
  return c;
};
