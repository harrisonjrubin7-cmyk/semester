export type SreqMe = { canRequest: boolean; chairOf: number[]; isRegistrar: boolean; isAdmin: boolean };
export type SreqEvent = { step: string; state: string; who: string; note: string; at: string };
export type SreqRow = {
  id: number; ref: string; state: string; version: number; label: string; capacity: number; meetingTimes: string;
  room: string; department: string; departmentId: number; instructor: string; requester: string; mine: boolean;
  reason: string; lastNote: string; sectionId: string | null; events: SreqEvent[];
};
export type SreqData = {
  result: unknown; me: SreqMe;
  departments: { id: number; name: string; chair: string | null; active: boolean }[];
  rooms: { id: number; name: string; capacity: number; active: boolean }[];
  courses: { id: string; code: string; title: string }[];
  terms: { id: string; code: string; label: string }[];
  faculty: { id: string; name: string }[];
  requests: SreqRow[];
};

export const STATE_LABEL: Record<string, string> = {
  submitted: 'Chair review', chair_approved: 'Registrar authorization', authorized: 'Authorized — creating',
  creating: 'Creating section', created: 'Reconciliation', reconciled: 'Completed', rejected: 'Declined', withdrawn: 'Withdrawn',
};

export const STEPS = ['submitted', 'chair_approved', 'authorized', 'created', 'reconciled'];

export const needsMe = (r: SreqRow, me: SreqMe) =>
  (r.state === 'submitted' && me.chairOf.includes(r.departmentId)) ||
  (['chair_approved', 'authorized', 'creating', 'created'].includes(r.state) && me.isRegistrar);
