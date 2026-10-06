import { CATEGORIES, contextToSend, type Category, type ContextKey } from './supporttickets';
import { noteOrigin, type Origin } from './tickethandoff';

/**
 * A support handoff from registration readiness or the gradebook.
 *
 * The ticket carries a category. It does not carry a score, a hold, a
 * section, a seat count, or any other student-record field. Those values
 * are not arguments: the words below are fixed, and `want_context` is the
 * six app keys the student ticks (`contextToSend`). Help still shows the
 * composer, so nothing is sent until the student writes it and reviews it.
 */

export const HANDOFF_SURFACES = ['registration_readiness', 'gradebook'] as const;
export type HandoffSurface = (typeof HANDOFF_SURFACES)[number];

export const ASK_LABEL = 'Ask Semester for help with the app';

const ASKS: Record<HandoffSurface, { category: Category; origin: Origin }> = {
  registration_readiness: {
    category: 'how_to',
    origin: {
      hash: '#/registration',
      action: 'Registration is not turned on in Semester',
      reference: null,
    },
  },
  gradebook: {
    category: 'how_to',
    origin: {
      hash: '#/gradebook',
      action: 'Looking at the gradebook',
      reference: null,
    },
  },
};

export const TICKET_ARG_KEYS = ['want_category', 'want_subject', 'want_body', 'want_context', 'want_email_notice'] as const;

export function supportAsk(surface: HandoffSurface): { category: Category; origin: Origin } {
  const ask = ASKS[surface];
  return { category: ask.category, origin: { ...ask.origin } };
}

/** Noted before the screen changes, so Help reads this origin rather than `#/help`. */
export function noteSupportAsk(surface: HandoffSurface): void {
  noteOrigin(supportAsk(surface).origin);
}

/**
 * The only object `open_support_ticket` is given from these surfaces.
 * Extra keys on `available` are dropped. There is no field for a record.
 */
export function ticketFromAsk(
  surface: HandoffSurface,
  subject: string,
  body: string,
  available: Partial<Record<ContextKey, string>>,
  ticked: ReadonlySet<ContextKey>,
): {
  want_category: Category;
  want_subject: string;
  want_body: string;
  want_context: Partial<Record<ContextKey, string>>;
  want_email_notice: boolean;
} {
  const category = supportAsk(surface).category;
  if (!(CATEGORIES as readonly string[]).includes(category)) {
    throw new Error('A support ticket needs a category.');
  }
  return {
    want_category: category,
    want_subject: subject.trim(),
    want_body: body.trim(),
    want_context: contextToSend(available, ticked),
    want_email_notice: false,
  };
}
