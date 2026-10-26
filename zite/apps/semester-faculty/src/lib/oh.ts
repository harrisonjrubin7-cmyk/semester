import { officeHours } from 'zitejs/api';

export type Booking = { id: number; student: string; state: string; topic: string; followUp: string };
export type Slot = { id: number; kind: string; section: string | null; start: string; end: string; location: string; capacity: number; cancelled: boolean; cancelReason: string; bookings: Booking[] };
export type OhData = { hostKinds: string[]; teaching: { id: string; label: string }[]; hosting: Slot[]; now: string; firstSection: string | null };

export const loadOh = () => officeHours({ action: 'get' }) as Promise<OhData>;
