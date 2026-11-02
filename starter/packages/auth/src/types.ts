export type RequestContext = {
  sessionId: string;
  accountId: string;
  tenantId: string | null;
  membershipId: string | null;
  activeWorkspace: string | null;
  grants: string[];
  correlationId: string;
};
