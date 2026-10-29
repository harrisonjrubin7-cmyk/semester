// Section demand (role app "Department Chair": demand). Pure. Inputs are the canonical section capacity and the registration
// tables: committed seats (reg_seats) and students still waiting (reg_waitlist state 'waiting'). Nothing here is a forecast.
export type DemandSection = { id: string; label: string; course: string; term: string; capacity: number | null; state: string };
export type DemandSignal = 'waitlisted' | 'full' | 'near_full' | 'open' | 'low' | 'closed' | 'no_capacity';
export type DemandRow = DemandSection & { seated: number; waiting: number; fill: number | null; signal: DemandSignal };

export const NEAR_FULL = 0.9;
export const LOW = 0.3;

export function signalFor(capacity: number | null, seated: number, waiting: number, state: string): DemandSignal {
  if (state === 'Closed' || state === 'Cancelled') return 'closed';
  if (!capacity || capacity <= 0) return 'no_capacity';
  if (waiting > 0) return 'waitlisted';
  const fill = seated / capacity;
  if (fill >= 1) return 'full';
  if (fill >= NEAR_FULL) return 'near_full';
  if (fill < LOW) return 'low';
  return 'open';
}

const ORDER: DemandSignal[] = ['waitlisted', 'full', 'near_full', 'open', 'low', 'no_capacity', 'closed'];

export function demandRows(sections: DemandSection[], seats: Record<string, number>, waits: Record<string, number>): DemandRow[] {
  return sections.map((s) => {
    const seated = seats[s.id] ?? 0, waiting = waits[s.id] ?? 0;
    return { ...s, seated, waiting, fill: s.capacity && s.capacity > 0 ? seated / s.capacity : null, signal: signalFor(s.capacity, seated, waiting, s.state) };
  }).sort((a, b) => ORDER.indexOf(a.signal) - ORDER.indexOf(b.signal) || b.waiting - a.waiting || (b.fill ?? -1) - (a.fill ?? -1) || a.label.localeCompare(b.label));
}

/** Per course and term: total seats, seated and waiting across its open sections, and how many more seats the waitlist would need. */
export function courseDemand(rows: DemandRow[]) {
  const by = new Map<string, { course: string; term: string; sections: number; capacity: number; seated: number; waiting: number }>();
  for (const r of rows) {
    if (r.signal === 'closed') continue;
    const k = `${r.term}|${r.course}`;
    const g = by.get(k) ?? { course: r.course, term: r.term, sections: 0, capacity: 0, seated: 0, waiting: 0 };
    g.sections += 1; g.capacity += r.capacity ?? 0; g.seated += r.seated; g.waiting += r.waiting;
    by.set(k, g);
  }
  return [...by.values()].map((g) => ({ ...g, seatsShort: Math.max(0, g.seated + g.waiting - g.capacity) })).sort((a, b) => b.seatsShort - a.seatsShort || b.waiting - a.waiting || a.course.localeCompare(b.course));
}
