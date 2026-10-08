import { err, ok, type Result } from '../kernel/result';

/**
 * The marketing and funnel events, as a contract and a sink wired to nothing.
 *
 * `docs/marketing/MARKETING_ANALYTICS_EVENT_TAXONOMY.md` is the authority and says
 * what this file may and may not be. Its §2 lists six things that must be true
 * before anything is collected (a recorded owner decision, updated privacy and
 * cookie notices, a first-party endpoint, fail-closed consent, a named retention
 * owner, a denylist test). None of them is done, so this is what §2 says the
 * correct build is until they are: typed event builders, the allowlist and its
 * tests, and a no-op sink. Nothing here reads a cookie, writes storage, or makes a
 * request, and `marketingevents.test.ts` holds that by reading this file's source.
 *
 * ## What an event is
 *
 *     { v: 1, event, ts, consent_state, …allow-listed fields }
 *
 * Unknown fields are **refused, not dropped**: a caller that puts an email address
 * in `cta_id` finds out in a test, not never. Values are short, and one that looks
 * like an address, a URL or a sentence is refused whatever field it is in.
 *
 * ## What is not a browser event
 *
 * Five of the events in the taxonomy are observed by the server from records the
 * product already keeps (a CRM stage change, a booking, the activation and first
 * action marks, a redeemed referral). They carry no browser identifiers, and
 * asking the browser to build one is refused. The onboarding steps the journey PDFs
 * list (`step_viewed`, `step_completed`, `journey_assigned`, …) are not here either:
 * they are rows in `public.onboarding_events`, written by the database functions
 * that make the change, so there is one record of them and it is not the client's.
 */

export const SCHEMA_VERSION = 1;

export type ConsentState = 'granted' | 'denied' | 'unset';

type Origin = 'browser' | 'server';

/** Every event, where it is observed, and the extra fields it may carry. */
export const MARKETING_EVENTS = {
  marketing_page_viewed: { origin: 'browser', extra: [] },
  marketing_cta_clicked: { origin: 'browser', extra: ['cta_id'] },
  marketing_demo_started: { origin: 'browser', extra: ['form_id'] },
  marketing_demo_submitted: { origin: 'browser', extra: ['route_key'] },
  marketing_demo_qualified: { origin: 'server', extra: ['stage'] },
  marketing_calendar_opened: { origin: 'browser', extra: [] },
  marketing_calendar_booked: { origin: 'server', extra: [] },
  marketing_resource_viewed: { origin: 'browser', extra: ['resource_slug'] },
  marketing_resource_downloaded: { origin: 'browser', extra: ['resource_slug'] },
  marketing_webinar_registered: { origin: 'browser', extra: ['resource_slug'] },
  marketing_pricing_viewed: { origin: 'browser', extra: [] },
  marketing_pilot_page_viewed: { origin: 'browser', extra: [] },
  marketing_trust_center_viewed: { origin: 'browser', extra: ['page_slug'] },
  marketing_case_study_viewed: { origin: 'browser', extra: ['resource_slug'] },
  marketing_signup_started: { origin: 'browser', extra: [] },
  marketing_signup_completed: { origin: 'browser', extra: [] },
  marketing_activation_completed: { origin: 'server', extra: [] },
  marketing_first_meaningful_action: { origin: 'server', extra: [] },
  marketing_referral_started: { origin: 'browser', extra: [] },
  marketing_referral_completed: { origin: 'server', extra: [] },
} as const satisfies Record<string, { origin: Origin; extra: readonly string[] }>;

export type MarketingEventName = keyof typeof MARKETING_EVENTS;

/** Fields any event may carry. `referrer` is a host, never a path. */
export const COMMON_FIELDS = [
  'page_type',
  'page_slug',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'referrer',
] as const;

export type Fields = Partial<Record<string, string>>;

export interface MarketingEvent {
  v: typeof SCHEMA_VERSION;
  event: MarketingEventName;
  /** Milliseconds since the epoch, from the caller's clock. */
  ts: number;
  consent_state: ConsentState;
  fields: Record<string, string>;
}

export type Refusal =
  | { kind: 'unknown_event'; event: string }
  | { kind: 'server_only'; event: string }
  | { kind: 'unknown_fields'; fields: string[] }
  | { kind: 'unsafe_value'; field: string };

const MAX_VALUE = 100;
const HOST = /^[a-z0-9.-]{1,100}$/i;

/** A value that is plainly not a label: an address, a URL, a path, or prose. */
function unsafe(field: string, value: string): boolean {
  if (value.length === 0 || value.length > MAX_VALUE) return true;
  if (field === 'referrer') return !HOST.test(value);
  return /[@\s]|:\/\/|^\/|\.\.|[<>"'`]/.test(value);
}

export function buildEvent(
  event: string,
  fields: Fields,
  context: { now: number; consent: ConsentState },
): Result<MarketingEvent, Refusal> {
  if (!Object.prototype.hasOwnProperty.call(MARKETING_EVENTS, event)) return err({ kind: 'unknown_event', event });
  const name = event as MarketingEventName;
  const spec = MARKETING_EVENTS[name];
  if (spec.origin === 'server') return err({ kind: 'server_only', event });

  const allowed = new Set<string>([...COMMON_FIELDS, ...spec.extra]);
  const extra = Object.keys(fields).filter((k) => !allowed.has(k));
  if (extra.length > 0) return err({ kind: 'unknown_fields', fields: extra });

  const kept: Record<string, string> = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    if (unsafe(key, value)) return err({ kind: 'unsafe_value', field: key });
    kept[key] = value;
  }
  return ok({ v: SCHEMA_VERSION, event: name, ts: context.now, consent_state: context.consent, fields: kept });
}

/** Where an event goes. The only one in this repository goes nowhere. */
export interface Sink {
  send(event: MarketingEvent): void;
}

export const NO_OP_SINK: Sink = { send: () => {} };

export type Tracked =
  | { sent: true }
  | { sent: false; reason: 'consent' }
  | { sent: false; reason: 'refused'; refusal: Refusal };

/**
 * A tracker over a sink and a consent reader.
 *
 * Consent is read at the moment of the call and anything but `granted` sends
 * nothing and builds nothing (fail closed: a missing answer is not a yes). The
 * event is built only after consent, so a refusal for a bad value is reported to
 * a caller that is allowed to be tracked and not otherwise.
 */
export function createTracker(options: { sink: Sink; consent: () => ConsentState; now?: () => number }) {
  const now = options.now ?? (() => Date.now());
  return {
    track(event: string, fields: Fields = {}): Tracked {
      const consent = options.consent();
      if (consent !== 'granted') return { sent: false, reason: 'consent' };
      const built = buildEvent(event, fields, { now: now(), consent });
      if (!built.ok) return { sent: false, reason: 'refused', refusal: built.error };
      options.sink.send(built.value);
      return { sent: true };
    },
  };
}

/** What the app uses today: consent is never granted anywhere, and the sink is a no-op. */
export const marketing = createTracker({ sink: NO_OP_SINK, consent: () => 'unset' });
