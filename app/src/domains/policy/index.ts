/**
 * Policy: may they? One question, one answer shape, whoever is asking and
 * whatever they are asking about.
 *
 * Public entry. The institutional half delegates to the decision point in
 * `@semester/institution` (ADR 0007); this slice is where it first has a
 * caller inside the app.
 */
export { PERSONAL_ACTIONS, isPersonalAction, decidePersonal } from './domain/personal';
export type { PersonalAction, PersonalActor, PersonalResource } from './domain/personal';
export { createAuthorizer } from './application/authorizer';
export type { Authorizer, AuthorizerDeps, AuthorizeRequest, InstitutionalContext, ResourceRef, InstitutionalFacts } from './application/authorizer';
