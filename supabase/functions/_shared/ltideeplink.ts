/**
 * Deep linking: the launch that asks a question instead of opening a page.
 *
 * `_shared/lti.ts` refused this message type by name and said why — *"the day
 * it is built, the thing that changes is this line"*. This is that day, so
 * here is what the line now lets through.
 *
 * ## What is actually different
 *
 * A resource link launch is a student arriving at something an instructor has
 * already placed. A **deep linking** launch is the placing: an instructor is
 * inside Brightspace's "add an activity" flow, Brightspace opens this tool and
 * waits, and what it wants back is not a page — it is a *signed answer*
 * describing what to put in the course.
 *
 * So the two launches end in opposite ways. One ends in a redirect carrying a
 * session. This one ends in a JWT this tool signs, posted back to an address
 * the platform nominated, and the person never really leaves Brightspace.
 *
 * That is why this could not be built before `_shared/ltikey.ts`: it is the
 * first thing in this repository that signs anything.
 *
 * ## Everything here is pure
 *
 * Same rule as `_shared/lti.ts` and `_shared/ltikey.ts`: arguments in, values
 * out, no `Deno.env` and no fetch, so `app/src/lib/ltideeplink.test.ts` can
 * walk every branch. The signing itself is the caller's job, because a
 * function that both decides and signs is one whose decisions cannot be tested
 * without a key.
 */

import type { Launch, Registration } from './lti.ts';

const DL = 'https://purl.imsglobal.org/spec/lti-dl/claim';

/** The deep-linking claims, spelled once. */
export const DL_CLAIM = {
  settings: `${DL}/deep_linking_settings`,
  contentItems: `${DL}/content_items`,
  /** Opaque platform state. Echoed back untouched or the platform is lost. */
  data: `${DL}/data`,
  msg: `${DL}/msg`,
} as const;

export const DEEP_LINKING_RESPONSE = 'LtiDeepLinkingResponse';

const LTI = 'https://purl.imsglobal.org/spec/lti/claim';
const VERSION = '1.3.0';

/**
 * The only content type this tool offers.
 *
 * A deep-linking request lists what the platform will accept — a file, an HTML
 * fragment, a link, an `ltiResourceLink`. This tool has exactly one thing to
 * give: a link that launches it back. Naming that as a constant rather than a
 * string in three places is what makes the "can we even answer this?" check
 * below the same question as the item we build.
 */
export const RESOURCE_LINK = 'ltiResourceLink';

/** What a refusal carries. Mirrors `_shared/lti.ts`, deliberately. */
export interface Refused {
  ok: false;
  reason: string;
  detail: string;
}
export type Verdict<T> = { ok: true; value: T } | Refused;

const no = (reason: string, detail: string): Refused => ({ ok: false, reason, detail });

/** Where the answer goes, and what it is allowed to contain. */
export interface DeepLinkSettings {
  /** The address the signed response is posted to. Checked https. */
  returnUrl: string;
  /** The platform's own state. Meaningless to us, fatal to drop. */
  data: string | null;
  /** True when the platform will take more than one item. */
  multiple: boolean;
}

/**
 * The settings claim, read strictly.
 *
 * Three things can be wrong here and only one of them is obvious.
 *
 * The obvious one is a missing return URL: there is nowhere to send the
 * answer.
 *
 * The second is a return URL that is not https. This is the address this tool
 * **posts a JWT it signed** to, and that JWT is an assertion about what an
 * instructor chose. Over http it is readable and alterable in flight, so the
 * scheme is a refusal rather than a warning — the same rule `token_url` is
 * held to in `20260921162000_lti_token_url.sql`, and for the same reason.
 *
 * The third is a platform that will not accept `ltiResourceLink`. That is not
 * an error on its side; it is a platform asking for a kind of content this
 * tool does not have. Refusing by name says so, rather than letting the
 * instructor watch an empty answer come back and wonder what they did.
 */
export function readSettings(claims: Record<string, unknown>): Verdict<DeepLinkSettings> {
  const raw = claims[DL_CLAIM.settings];
  const settings = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : null;
  if (!settings) return no('no-settings', 'The token carried no deep linking settings.');

  const returnUrl = typeof settings.deep_link_return_url === 'string'
    ? settings.deep_link_return_url.trim()
    : '';
  if (!returnUrl) return no('no-return-url', 'The deep linking settings carried no return URL.');
  if (!returnUrl.startsWith('https://')) {
    return no('insecure-return-url', `Deep linking return URL ${returnUrl} is not https.`);
  }

  /*
   * An absent `accept_types` is treated as "anything", which is what the
   * standard's default means — but a present list that omits our one type is
   * a refusal. The distinction matters: the second is a platform that told us
   * what it wants, and guessing past that is how a tool posts an answer the
   * platform silently discards.
   */
  const accept = settings.accept_types;
  if (Array.isArray(accept) && !accept.includes(RESOURCE_LINK)) {
    return no(
      'unaccepted-type',
      `The platform accepts ${accept.join(', ') || '(nothing)'}, and this tool offers only ${RESOURCE_LINK}.`,
    );
  }

  return {
    ok: true,
    value: {
      returnUrl,
      data: typeof settings.data === 'string' && settings.data ? settings.data : null,
      multiple: settings.accept_multiple === true,
    },
  };
}

/** One thing to put in a course. */
export interface ContentItem {
  type: string;
  url: string;
  title: string;
  text?: string;
}

/**
 * The item this tool offers back.
 *
 * `url` is the tool's **launch** endpoint, not the app's address. That is the
 * part worth stating: what the platform stores is the URL it will later open
 * as a resource link launch, and the app cannot serve that — it has no way to
 * verify a token. Handing over the app's address would place a link that works
 * for exactly as long as nobody checks who clicked it.
 */
export function resourceLinkItem(launchUrl: string, title: string, text?: string): Verdict<ContentItem> {
  const url = launchUrl.trim();
  if (!url) return no('no-launch-url', 'There is no launch URL to place.');
  if (!title.trim()) return no('no-title', 'A placed link with no title is one nobody can find again.');
  const item: ContentItem = { type: RESOURCE_LINK, url, title: title.trim() };
  if (text && text.trim()) item.text = text.trim();
  return { ok: true, value: item };
}

export interface ResponseInput {
  reg: Registration;
  settings: DeepLinkSettings;
  items: ContentItem[];
  /** Unpredictable, and passed in so a test can fix it. */
  nonce: string;
  /** Seconds since the epoch. */
  now: number;
  /** Shown to the instructor by the platform, when it chooses to. */
  msg?: string;
}

/**
 * The claims of the response JWT.
 *
 * The direction reverses here, and that is the thing to get right. On the way
 * in, the platform is `iss` and this tool is `aud`. On the way out **this tool
 * is `iss` and the platform is `aud`** — the same reversal `clientAssertion`
 * documents, and the same one people get backwards, because every other token
 * in an LTI flow points the other way.
 *
 * `azp` repeats the client id. It is redundant when `aud` is a single string
 * and required by some platforms when it is not, and sending it always is
 * cheaper than discovering which kind a school runs.
 *
 * `data` is echoed back exactly as it arrived, or omitted when it never came.
 * It is the platform's own bookkeeping — which course, which module, which
 * position in it — and a tool that drops it hands back a correct answer to a
 * question the platform can no longer place.
 */
export function responseClaims(input: ResponseInput): Verdict<Record<string, unknown>> {
  const { reg, settings, items, nonce, now } = input;
  if (!nonce) return no('no-nonce', 'A deep linking response needs a nonce.');
  if (items.length === 0) {
    return no('no-items', 'A response with no content items places nothing.');
  }
  if (items.length > 1 && !settings.multiple) {
    /*
     * The platform said it takes one. Sending several is not a richer answer,
     * it is an answer whose surplus is discarded by whichever rule that
     * platform happens to apply — and which one it kept is not visible from
     * here.
     */
    return no('multiple-refused', `The platform accepts one item and ${items.length} were offered.`);
  }

  const claims: Record<string, unknown> = {
    iss: reg.clientId,
    aud: reg.issuer,
    azp: reg.clientId,
    iat: now,
    /*
     * Five minutes, matching `clientAssertion`. The response is posted by the
     * instructor's own browser the instant it is signed; a longer life only
     * widens the window in which a copy of it is worth having.
     */
    exp: now + 300,
    nonce,
    [`${LTI}/message_type`]: DEEP_LINKING_RESPONSE,
    [`${LTI}/version`]: VERSION,
    [`${LTI}/deployment_id`]: reg.deploymentId,
    [DL_CLAIM.contentItems]: items,
  };
  if (settings.data) claims[DL_CLAIM.data] = settings.data;
  if (input.msg && input.msg.trim()) claims[DL_CLAIM.msg] = input.msg.trim();

  return { ok: true, value: claims };
}

/**
 * HTML entities, for the two values that reach the page below.
 *
 * Both come out of a token whose signature was verified, so neither is
 * attacker-controlled in the ordinary sense — but "it was signed" is a
 * statement about *who* sent it, not about what they sent, and a platform is
 * perfectly able to sign a return URL with a quote in it. Escaping here costs
 * nothing and removes the need to be right about that.
 */
function escape(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * The page that hands the answer back.
 *
 * A form POST rather than a redirect, because the response is a JWT and a JWT
 * in a query string is a JWT in the instructor's browser history, in the
 * platform's access log, and in any referrer header that follows.
 *
 * It submits itself on load and still has a button, which is the part that
 * looks redundant and is not: with script disabled or blocked — and an LMS
 * page embedded in an iframe is a place that happens — the automatic path does
 * nothing at all, and without the button the instructor would sit looking at a
 * blank frame with no way forward and nothing to report.
 */
export function autoPostForm(returnUrl: string, jwt: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>Returning to your course</title></head>
<body onload="document.forms[0].submit()">
<form action="${escape(returnUrl)}" method="post">
<input type="hidden" name="JWT" value="${escape(jwt)}">
<p>Returning your selection to your course…</p>
<button type="submit">Continue</button>
</form>
</body>
</html>`;
}

/**
 * Whether this person may place things in a course.
 *
 * The one rule in this file that is about authority rather than shape, and the
 * one worth being loud about: a deep-linking response is an instruction to put
 * something in a course, and a platform that asks a student for one is a
 * platform that is confused or being driven. `Launch.teaches` is already
 * computed by `_shared/lti.ts` against both role spellings, so this asks it
 * rather than re-deriving it and getting the short form wrong.
 */
export function mayPlace(who: Launch): Verdict<true> {
  if (!who.teaches) {
    return no('not-a-teacher', `Subject ${who.subject} has no teaching role and cannot place content.`);
  }
  return { ok: true, value: true };
}
