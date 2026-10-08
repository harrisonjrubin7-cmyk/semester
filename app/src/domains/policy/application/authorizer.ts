import {
  decide,
  isPolicyAction,
  type AuthorizationDecision,
  type AuthorizationRequest,
  type PolicyObligation,
} from '@semester/institution';
import { fail, ok, type Clock, type DomainError, type Result } from '../../../kernel';
import { decidePersonal, type PersonalActor, type PersonalResource } from '../domain/personal';

/**
 * What only a server can say about a request: which institution it is for and
 * how that was verified, the person's memberships and grants, the consent they
 * have given. The decision point is a pure function of this; it never goes to
 * find it.
 */
export type InstitutionalFacts = Pick<AuthorizationRequest, 'actor' | 'tenant'> & {
  context: Omit<AuthorizationRequest['context'], 'correlationId'>;
};

/** Where those facts come from. A gateway resolves them; the browser has none to offer. */
export interface InstitutionalContext {
  resolve(actor: PersonalActor, correlationId: string): InstitutionalFacts | null;
}

/**
 * What is being acted on. `ownerId` may be `null` for a thing that has only
 * ever lived on this device; the decision point's own field cannot be, so it
 * is left out of the request it sees rather than sent as an owner of nothing.
 */
export interface ResourceRef extends Omit<Partial<AuthorizationRequest['resource']>, 'ownerId'>, PersonalResource {}

export interface AuthorizeRequest {
  readonly action: string;
  readonly resource?: ResourceRef;
  readonly correlationId: string;
}

export interface Authorizer {
  authorize(actor: PersonalActor, request: AuthorizeRequest): AuthorizationDecision;
  /** `authorize`, with a refusal turned into the app's one error shape and an allowance into the obligations it carries. */
  enforce(actor: PersonalActor, request: AuthorizeRequest): Result<readonly PolicyObligation[], DomainError>;
}

export interface AuthorizerDeps {
  readonly clock: Clock;
  /** Absent on a device that has no institution: institutional actions are then refused, never guessed. */
  readonly institutional?: InstitutionalContext;
}

/**
 * One front door for "may they?", routed by what is being asked.
 *
 * - An action in the institutional vocabulary (`POLICY_ACTIONS`) goes to the
 *   package's decision point, **with facts a server resolved**. With none it is
 *   refused as an unverified tenant — fail closed, the same answer the
 *   decision point itself gives. Called from a browser this is an advisory
 *   pre-check; the gateway asks again and its answer is the one that counts
 *   (ADR 0007).
 * - Anything else is a personal action and gets the owner rule.
 * - Anything unnamed is refused.
 */
export function createAuthorizer({ clock, institutional }: AuthorizerDeps): Authorizer {
  const authorize: Authorizer['authorize'] = (actor, request) => {
    if (!isPolicyAction(request.action)) return decidePersonal(actor, request.action, request.resource);

    const facts = institutional?.resolve(actor, request.correlationId) ?? null;
    if (!facts) {
      return { allow: false, reasonCode: 'tenant_unverified', userMessage: 'No verified institution is attached to this request.' };
    }
    const { ownerId, ...rest } = request.resource ?? {};
    return decide(
      {
        actor: facts.actor,
        tenant: facts.tenant,
        action: request.action,
        resource: { ...rest, type: rest.type ?? 'unknown', ...(ownerId != null ? { ownerId } : {}) },
        context: { ...facts.context, correlationId: request.correlationId },
      },
      clock.now(),
    );
  };

  return {
    authorize,
    enforce(actor, request) {
      const decision = authorize(actor, request);
      if (decision.allow) return ok(decision.obligations);
      return fail('forbidden', `policy.${decision.reasonCode}`, decision.userMessage, {
        correlationId: request.correlationId,
        ...(decision.userAction ? { userAction: decision.userAction } : {}),
      });
    },
  };
}
