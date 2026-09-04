/**
 * What a term costs, which is the half of a semester the app ignored.
 *
 * The bookstore is one tap away from the campus shelf and nothing adds up. A
 * course has a required text, a lab fee, an access code that expires at the
 * end of the term, a clicker subscription. Rent-versus-buy across four books
 * is a two-hundred-dollar decision made in a hurry in August with no numbers
 * in front of you, and made again next August with no memory of the last one.
 *
 * ## Entered, never fetched
 *
 * There is no price lookup here and there will not be one. Prices differ by
 * edition, by seller and by the week; the bookstore has no API a student can
 * use; and a wrong price shown confidently is worse than a blank field —
 * which is the same reasoning that keeps the registrar's dates and myVU's
 * address out of this codebase. You type what you paid. The app does the
 * arithmetic and remembers it, which is the part you cannot do in your head
 * eleven months later.
 *
 * ## Cents, as integers
 *
 * Money is held in cents and never as a float. `19.99 + 0.1` is not 20.09 in
 * binary floating point, and a term total that is out by a cent for no
 * visible reason is the kind of thing that makes somebody stop trusting every
 * other number on the screen.
 */

export type Kind = 'book' | 'access' | 'fee' | 'supplies' | 'other';

export interface KindInfo {
  id: Kind;
  label: string;
  /** Whether this is the sort of thing that can be rented or sold back. */
  resellable: boolean;
}

export const KINDS: KindInfo[] = [
  { id: 'book', label: 'Textbook', resellable: true },
  { id: 'access', label: 'Access code', resellable: false },
  { id: 'fee', label: 'Course fee', resellable: false },
  { id: 'supplies', label: 'Supplies', resellable: false },
  { id: 'other', label: 'Something else', resellable: false },
];

export function kindOf(id: string): KindInfo {
  return KINDS.find((k) => k.id === id) ?? KINDS[KINDS.length - 1];
}

export interface Cost {
  id: string;
  courseId: string;
  /** What it is — "Mankiw, Principles of Macroeconomics, 9e". */
  what: string;
  kind: Kind;
  /** Cents. Always an integer. */
  cents: number;
  /** Rented rather than bought, so it goes back rather than being sold. */
  rented: boolean;
  /** What you got back for it, in cents. Zero until you sell it. */
  backCents: number;
  /** Which term this belongs to, so a total means one semester. */
  term: string;
  at: number;
}

/**
 * A typed amount, as cents.
 *
 * Takes what people type — "$64.99", "64.99", "65", "1,240" — and refuses
 * anything else rather than guessing at zero, because a field that silently
 * becomes zero is a field that quietly wrecks a total.
 */
export function readMoney(text: string): number | null {
  const cleaned = text.trim().replace(/[$£€,\s]/g, '');
  if (!cleaned) return null;
  if (!/^\d+(\.\d{0,2})?$/.test(cleaned)) return null;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0 || n > 100_000) return null;
  return Math.round(n * 100);
}

/** Cents as "$64.99". */
export function money(cents: number): string {
  const sign = cents < 0 ? '−' : '';
  const abs = Math.abs(cents);
  return `${sign}$${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

export interface Total {
  /** What it all cost, in cents. */
  spent: number;
  /** What came back, in cents. */
  back: number;
  /** Spent less what came back. */
  net: number;
  /** How many entries it rests on. */
  items: number;
  /** Things that could be sold back and have not been. */
  toSell: Cost[];
  /** Rentals, which have to go back rather than being sold. */
  rentals: Cost[];
}

export function total(costs: Cost[]): Total {
  const spent = costs.reduce((n, c) => n + c.cents, 0);
  const back = costs.reduce((n, c) => n + c.backCents, 0);
  return {
    spent,
    back,
    net: spent - back,
    items: costs.length,
    toSell: costs.filter((c) => !c.rented && kindOf(c.kind).resellable && c.backCents === 0),
    rentals: costs.filter((c) => c.rented),
  };
}

/** One term's worth. */
export function forTerm(costs: Cost[], term: string): Cost[] {
  return costs.filter((c) => c.term === term);
}

/** One course's worth, within a term. */
export function forCourse(costs: Cost[], courseId: string): Cost[] {
  return costs.filter((c) => c.courseId === courseId);
}

/** Every term with anything recorded, newest id first. */
export function terms(costs: Cost[]): string[] {
  return [...new Set(costs.map((c) => c.term))].sort().reverse();
}

/**
 * What the term cost, in a sentence.
 *
 * Says net rather than gross where anything has come back, because the money
 * a person actually spent is the figure they want — and says both, because
 * "you got $80 of it back" is the half that makes selling books back feel
 * worth the walk.
 */
export function line(t: Total): string {
  if (t.items === 0) return 'Nothing recorded for this term yet.';
  if (t.back === 0) {
    return `${money(t.spent)} across ${t.items} ${t.items === 1 ? 'thing' : 'things'}.`;
  }
  return `${money(t.net)} net — ${money(t.spent)} out, ${money(t.back)} back.`;
}

/** What is still worth doing about it, or nothing. */
export function todo(t: Total): string {
  const parts: string[] = [];
  if (t.toSell.length > 0) {
    const worth = t.toSell.reduce((n, c) => n + c.cents, 0);
    parts.push(
      `${t.toSell.length} ${t.toSell.length === 1 ? 'book' : 'books'} to sell back, ${money(worth)} of them at cover`,
    );
  }
  if (t.rentals.length > 0) {
    parts.push(`${t.rentals.length} ${t.rentals.length === 1 ? 'rental' : 'rentals'} to return`);
  }
  return parts.length > 0 ? `${parts.join('; ')}.` : '';
}

/**
 * The comparison worth having in August: what the same course cost last time.
 *
 * Matched on course code rather than on id, because a course id is a slug of
 * its code and the same course in a later term is a different row with the
 * same name. Returns nothing rather than a guess where there is no prior
 * term to compare against.
 */
export function lastTime(
  costs: Cost[],
  codeOf: (courseId: string) => string,
  courseId: string,
  term: string,
): { term: string; cents: number } | null {
  const code = codeOf(courseId);
  const earlier = costs.filter((c) => c.term < term && codeOf(c.courseId) === code);
  if (earlier.length === 0) return null;
  const last = terms(earlier)[0];
  return { term: last, cents: earlier.filter((c) => c.term === last).reduce((n, c) => n + c.cents, 0) };
}
