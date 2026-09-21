/**
 * LTI 1.3, the rules half — every decision, and no I/O.
 *
 * `GRADESCOPE-TURNITIN.md` ends on the finding that sent this file: Semester
 * cannot submit *into* Gradescope or Turnitin, because both are provisioned
 * per course by a professor inside the school's LMS contract. The direction
 * that is open is the reverse one — Brightspace launching Semester as a tool —
 * and it is open because **LTI 1.3 is a 1EdTech standard rather than a vendor
 * product.** There is no partner program to apply to. There is a school
 * administrator, a client id, and this.
 *
 * ## Why the rules are here and not in the function that uses them
 *
 * `_shared/cors.ts` was written this way after a CORS misconfiguration made
 * three functions unreachable from the deployed site while CI stayed green and
 * both ends reported success. `functioncors.test.ts` says what that cost and
 * why the fix was shape rather than care: the rule **takes its inputs as
 * arguments and never reads `Deno.env`**, so it is importable from a vitest
 * file and its decision table can be tested.
 *
 * An LTI launch is the same kind of hazard, worse. A tool that accepts a
 * malformed `id_token` does not fail — it succeeds, for the wrong person. The
 * failure is silent at both ends and the thing it hands out is a student's
 * account. So every refusal below is a function that takes what it judges and
 * returns why it refused, and `lti.test.ts` walks all of them.
 *
 * ## What this file deliberately does not do
 *
 * It does not verify the `id_token`'s signature, fetch a JWKS, or read or
 * write the nonce store. Those need network and database and belong in the
 * function shell. What it does is the part that is pure and is where the
 * standard's teeth are: given a decoded token and a registration, is this
 * launch one we must honour, and if not, exactly which rule refused it.
 *
 * The split matters for one specific reason. A signature check proves the
 * platform issued the token. It proves nothing about *which* platform, which
 * deployment, whether the token has expired, or whether it is a replay of one
 * seen four seconds ago — and every one of those has been a real LTI
 * vulnerability in a shipped tool. Verifying the signature and stopping there
 * is the mistake this division is shaped to make hard.
 */

/** The claim namespace, written once. Every LTI claim is a URI under it. */
const LTI = 'https://purl.imsglobal.org/spec/lti/claim';

export const CLAIM = {
  messageType: `${LTI}/message_type`,
  version: `${LTI}/version`,
  deploymentId: `${LTI}/deployment_id`,
  targetLinkUri: `${LTI}/target_link_uri`,
  roles: `${LTI}/roles`,
  context: `${LTI}/context`,
  resourceLink: `${LTI}/resource_link`,
} as const;

/**
 * What a school's administrator gives us, once, when they install the tool.
 *
 * Every field here comes off the Brightspace side of the registration and none
 * of it is a secret: the client id is public, and the JWKS URL is a public
 * document by definition. The secret in LTI is the platform's private key,
 * which we never hold, and ours, which is not needed until a launch has to
 * call *back* into Brightspace — grade passback or deep linking. Neither is in
 * this slice, and so there is no key material in this file at all.
 */
export interface Registration {
  /** The platform's issuer, exactly as it appears in `iss`. */
  issuer: string;
  /** What Brightspace calls the client id. This tool's `aud`. */
  clientId: string;
  /**
   * One Brightspace *deployment* of this tool.
   *
   * Not decoration. A single issuer can deploy one tool many times — a
   * university with separate Brightspace orgs for its schools is the ordinary
   * case — and the deployment id is the only thing in the token that
   * distinguishes them. A tool that checks `iss` and `client_id` and ignores
   * this accepts a launch from the medical school into the law school's data.
   */
  deploymentId: string;
  /** Where the OIDC authentication request goes. */
  authLoginUrl: string;
  /** Where the platform publishes the keys its tokens are signed with. */
  jwksUrl: string;
}

/** A refusal carries the rule that refused, never a bare false. */
export interface Refused {
  ok: false;
  /** A stable word for a log and a test. Never shown to a person. */
  reason: string;
  /** One sentence, for the log line next to it. */
  detail: string;
}

export interface Accepted<T> {
  ok: true;
  value: T;
}

export type Verdict<T> = Accepted<T> | Refused;

const no = (reason: string, detail: string): Refused => ({ ok: false, reason, detail });
const yes = <T>(value: T): Accepted<T> => ({ ok: true, value });

/**
 * Step one: the platform asks us to start a login.
 *
 * Brightspace sends the student's browser here — as a GET or a POST, and both
 * happen — with the issuer, a `login_hint` that means something only to the
 * platform, and the URL it wants us to end up at. We answer with a redirect
 * into the platform's own authentication endpoint.
 *
 * The two things this returns that are ours rather than the platform's are
 * `state` and `nonce`, and they do different jobs that are easy to conflate:
 *
 *  - **`state` ties the redirect we are about to issue to the POST that comes
 *    back.** Without it, anybody can post an `id_token` at the launch endpoint
 *    out of the blue and we have no way to know we did not ask for it.
 *  - **`nonce` ties the token to *this* request, once.** A token replayed a
 *    second time carries a nonce we have already spent.
 *
 * Both are stored by the caller, not here, and the reason is worth stating
 * because the obvious alternative is a trap: the obvious place for `state` is
 * a cookie, and an LTI launch renders inside an iframe on the LMS's page,
 * where a third-party cookie is exactly what a browser has spent the last few
 * years learning to drop. A tool that keeps `state` in a cookie works for the
 * developer who built it and fails for a student in Safari. It goes in the
 * database.
 */
export interface LoginStart {
  /** Where to send the browser. */
  redirectTo: string;
  /** To be stored, then required back. */
  state: string;
  /** To be stored, then spent exactly once. */
  nonce: string;
}

export interface LoginParams {
  iss?: string | null;
  login_hint?: string | null;
  target_link_uri?: string | null;
  lti_message_hint?: string | null;
  client_id?: string | null;
  lti_deployment_id?: string | null;
}

/**
 * Build the authentication request, or say why we will not.
 *
 * `state` and `nonce` are passed in rather than generated here so that this
 * stays pure and therefore testable — the caller makes them with
 * `crypto.randomUUID()`, which is the one thing in the flow that must not be
 * predictable and is also the one thing a test cannot assert about.
 */
export function startLogin(
  params: LoginParams,
  reg: Registration,
  redirectUri: string,
  state: string,
  nonce: string,
): Verdict<LoginStart> {
  const iss = (params.iss ?? '').trim();
  if (!iss) return no('no-iss', 'The login request carried no issuer.');
  if (iss !== reg.issuer) {
    return no('unknown-iss', `No registration for issuer ${iss}.`);
  }

  const loginHint = (params.login_hint ?? '').trim();
  if (!loginHint) return no('no-login-hint', 'The login request carried no login_hint.');

  /*
   * `client_id` is optional in the standard and Brightspace sends it. When it
   * is there it must agree with the registration we matched on the issuer:
   * one issuer can host more than one tool, and taking the issuer's word for
   * which one this is while ignoring the field that says so is how a launch
   * meant for another tool gets honoured by this one.
   */
  const claimedClient = (params.client_id ?? '').trim();
  if (claimedClient && claimedClient !== reg.clientId) {
    return no('client-mismatch', `Login named client ${claimedClient}, registration is ${reg.clientId}.`);
  }

  const claimedDeployment = (params.lti_deployment_id ?? '').trim();
  if (claimedDeployment && claimedDeployment !== reg.deploymentId) {
    return no('deployment-mismatch', `Login named deployment ${claimedDeployment}.`);
  }

  /*
   * The platform tells us where it wants the launch to land. We do not have to
   * take that at face value and must not: `target_link_uri` is attacker-
   * influenced in the general case, and a tool that redirects to whatever it
   * receives is an open redirect wearing a standard's name. It is checked
   * against our own redirect_uri rather than merely recorded.
   */
  const target = (params.target_link_uri ?? '').trim();
  if (!target) return no('no-target', 'The login request carried no target_link_uri.');
  if (!sameOrigin(target, redirectUri)) {
    return no('foreign-target', `target_link_uri ${target} is not on this tool's origin.`);
  }

  const url = new URL(reg.authLoginUrl);
  const q = url.searchParams;
  q.set('scope', 'openid');
  q.set('response_type', 'id_token');
  /*
   * `form_post` rather than a fragment, because the token comes back to a
   * server rather than to script on a page, and `prompt=none` because the
   * student has already authenticated with Brightspace — this exchange must
   * never draw a second sign-in.
   */
  q.set('response_mode', 'form_post');
  q.set('prompt', 'none');
  q.set('client_id', reg.clientId);
  q.set('redirect_uri', redirectUri);
  q.set('login_hint', loginHint);
  q.set('state', state);
  q.set('nonce', nonce);
  const hint = (params.lti_message_hint ?? '').trim();
  if (hint) q.set('lti_message_hint', hint);

  return yes({ redirectTo: url.toString(), state, nonce });
}

/** Two URLs on the same scheme, host and port. Throwing is a refusal. */
function sameOrigin(a: string, b: string): boolean {
  try {
    return new URL(a).origin === new URL(b).origin;
  } catch {
    return false;
  }
}

/**
 * What a validated launch tells us about who arrived and where from.
 *
 * Deliberately small. It is what the rest of the app is allowed to believe,
 * and every field on it has been checked; anything the token also carried and
 * this does not is something nothing downstream can accidentally trust.
 */
export interface Launch {
  /**
   * Which of the two messages this was.
   *
   * On the verdict rather than inferred again by the caller, because the
   * caller would have to read the raw claims to do it — and a second reading
   * of a claim that has already been checked is the place the two readings
   * drift apart.
   */
  messageType: 'LtiResourceLinkRequest' | 'LtiDeepLinkingRequest';
  /** The platform's own id for this person, unique only within the issuer. */
  subject: string;
  issuer: string;
  clientId: string;
  deploymentId: string;
  /** The LTI roles, as URIs. Unrecognised ones are kept, not dropped. */
  roles: string[];
  /** True when any role is an instructor or administrator role. */
  teaches: boolean;
  /** The course, when the platform sent one. */
  contextId: string | null;
  contextTitle: string | null;
  /** Where the platform wants this launch to land. Same-origin, checked. */
  targetLinkUri: string;
  /** Display name and email, when the platform was configured to send them. */
  name: string | null;
  email: string | null;
}

export interface LaunchCheck {
  /** The decoded payload. Its signature is the shell's job, before this runs. */
  claims: Record<string, unknown>;
  reg: Registration;
  /** The nonce we issued and have not yet spent. */
  expectedNonce: string;
  /** This tool's launch URL. */
  redirectUri: string;
  /** Seconds since the epoch. Passed in so a test can sit at a fixed instant. */
  now: number;
  /** How much clock skew to forgive, in seconds. */
  skew?: number;
}

const RESOURCE_LINK_REQUEST = 'LtiResourceLinkRequest';
const DEEP_LINKING_REQUEST = 'LtiDeepLinkingRequest';

/**
 * The two messages this tool answers, and the reason it is a set rather than
 * a pair of `||`.
 *
 * Every rule in `checkLaunch` above the message-type gate applies to both:
 * both are signed by the same platform, both carry a nonce that may be spent
 * once, both name a deployment. What differs is only what the caller does
 * afterwards, which is why the type is *carried on the verdict* rather than
 * branched on here.
 */
const ANSWERED = new Set<string>([RESOURCE_LINK_REQUEST, DEEP_LINKING_REQUEST]);

/**
 * Roles that mean "can see other people's work".
 *
 * Matched on the suffix after the last `#`, because the standard's role URIs
 * come in a short form and a longer context-scoped form for the same role and
 * a tool that string-compares whole URIs silently treats one of them as a
 * student.
 */
const TEACHING = new Set(['Instructor', 'Administrator', 'ContentDeveloper', 'Mentor', 'TeachingAssistant']);

/**
 * Every rule the standard puts between a signed token and a session.
 *
 * The order is deliberate: identity of the sender first, then freshness, then
 * replay, then what kind of message this is. A test that only ever sends valid
 * tokens cannot tell whether the order is right, so `lti.test.ts` sends tokens
 * that break two rules at once and asserts which one answers.
 */
export function checkLaunch(input: LaunchCheck): Verdict<Launch> {
  const { claims, reg, expectedNonce, redirectUri, now } = input;
  const skew = input.skew ?? 60;

  const iss = str(claims.iss);
  if (!iss) return no('no-iss', 'The token carried no issuer.');
  if (iss !== reg.issuer) return no('wrong-iss', `Token issuer ${iss} is not ${reg.issuer}.`);

  /*
   * `aud` is a string or an array, and the array case is the one that bites.
   * When there is more than one audience the standard requires `azp` and
   * requires it to be the client this token is for — so an array that happens
   * to contain our client id is not on its own a token addressed to us.
   */
  const aud = claims.aud;
  const audiences = Array.isArray(aud) ? aud.filter((a): a is string => typeof a === 'string') : [str(aud)].filter(Boolean);
  if (audiences.length === 0) return no('no-aud', 'The token carried no audience.');
  if (!audiences.includes(reg.clientId)) {
    return no('wrong-aud', `Token audience does not include ${reg.clientId}.`);
  }
  if (audiences.length > 1) {
    const azp = str(claims.azp);
    if (!azp) return no('no-azp', 'Multiple audiences and no azp to say which is meant.');
    if (azp !== reg.clientId) return no('wrong-azp', `Token azp ${azp} is not ${reg.clientId}.`);
  }

  const exp = num(claims.exp);
  if (exp === null) return no('no-exp', 'The token carried no expiry.');
  if (now > exp + skew) return no('expired', `Token expired at ${exp}, now ${now}.`);

  const iat = num(claims.iat);
  if (iat === null) return no('no-iat', 'The token carried no issued-at.');
  if (iat > now + skew) return no('future', `Token was issued at ${iat}, in the future.`);

  /*
   * The nonce is compared here and *spent* by the caller, and the two must not
   * be reordered: spending first would let a token that fails a later rule
   * burn a nonce the real launch still needs. The caller spends it only on
   * this function returning ok.
   */
  const nonce = str(claims.nonce);
  if (!nonce) return no('no-nonce', 'The token carried no nonce.');
  if (nonce !== expectedNonce) return no('wrong-nonce', 'The token nonce is not the one we issued.');

  const version = str(claims[CLAIM.version]);
  if (version !== '1.3.0') return no('wrong-version', `LTI version ${version ?? '(absent)'} is not 1.3.0.`);

  const deployment = str(claims[CLAIM.deploymentId]);
  if (!deployment) return no('no-deployment', 'The token carried no deployment id.');
  if (deployment !== reg.deploymentId) {
    return no('wrong-deployment', `Token deployment ${deployment} is not ${reg.deploymentId}.`);
  }

  const messageType = str(claims[CLAIM.messageType]);
  if (!messageType || !ANSWERED.has(messageType)) {
    /*
     * Still refused by name, and still an allowlist. The previous version of
     * this gate admitted one type and said that the day deep linking was
     * built, the thing that changes is this line; this is that change, and it
     * adds a member to a set rather than relaxing the test — a token carrying
     * a message type nobody here has considered is refused exactly as before.
     */
    return no(
      'wrong-message-type',
      `Message type ${messageType ?? '(absent)'} is not one this tool answers.`,
    );
  }

  const subject = str(claims.sub);
  if (!subject) return no('no-sub', 'The token carried no subject.');

  const target = str(claims[CLAIM.targetLinkUri]);
  if (!target) return no('no-target', 'The token carried no target_link_uri.');
  if (!sameOrigin(target, redirectUri)) {
    return no('foreign-target', `target_link_uri ${target} is not on this tool's origin.`);
  }

  /*
   * Roles must be present and must be an array. An empty array is legal and
   * means the platform is telling us it knows of no role for this person,
   * which is not the same as it having sent nothing — so the absence is
   * refused and the empty array is not.
   */
  const rawRoles = claims[CLAIM.roles];
  if (!Array.isArray(rawRoles)) return no('no-roles', 'The token carried no roles array.');
  const roles = rawRoles.filter((r): r is string => typeof r === 'string');

  const context = obj(claims[CLAIM.context]);

  return yes({
    messageType: messageType as Launch['messageType'],
    subject,
    issuer: iss,
    clientId: reg.clientId,
    deploymentId: deployment,
    roles,
    teaches: roles.some((r) => TEACHING.has(r.split('#').pop() ?? '')),
    contextId: context ? str(context.id) : null,
    contextTitle: context ? str(context.title) : null,
    targetLinkUri: target,
    name: str(claims.name),
    email: str(claims.email),
  });
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function obj(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : null;
}
