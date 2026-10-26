import { institutionConsole } from 'zitejs/api';

export type ConsoleData = {
  institution: { name: string; retentionDays: number; isSample: boolean; inviteCode: string };
  memberships: { id: string; name: string; roles: string[]; status: string; self: boolean }[];
  integrations: { id: string; name: string; connector: string; enabled: boolean; authorized: boolean; syncStatus: string; retryCount: number; lastSyncedAt: string | null; lastReconciliation: string }[];
  audit: { id: string; action: string; actor: string; recordRef: string; authority: string; viaAssistant: boolean; at: string }[];
  checklist: { label: string; done: boolean }[];
};

export const loadConsole = () => institutionConsole({ action: 'get' }) as Promise<ConsoleData>;
