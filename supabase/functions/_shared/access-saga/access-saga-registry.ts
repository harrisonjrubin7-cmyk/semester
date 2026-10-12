// Generated from app/server/institution/access-saga-registry.ts by app/scripts/edge-access-saga.ts. Do not edit;
// change the source and run `cd app && node scripts/edge-access-saga.ts`.

/**
 * The participants the scheduled access saga tick runs against.
 *
 * `null` until every one of the runner's `Services` (in
 * `packages/institution/src/access-saga.ts`) has a real implementation. The
 * policy administrator and the enforcement point have one:
 * `PostgresAccessParticipants` (`postgres-access-participants.ts`) over
 * migration `20261012050000_access_participants`, which holds the revocation
 * barrier inside the database. The policy decision point (`validate`,
 * `evaluate`) does not yet: `decide` in `policy.ts` is the decision, and the
 * trusted context it is asked with (the subject's memberships, role grants and
 * capabilities in the tenant) is not yet built from a saga. While this is null
 * the `access-saga-tick` Edge Function lists what is due and moves nothing
 * (`runScheduledAccessSagaTick`), so the job can be scheduled, its token
 * check exercised and its counts watched before anything is provisioned.
 *
 * Registering participants is a reviewed change to this file, as adding an
 * adapter is to `server/integration/registry.ts`: they must be real services,
 * not stand-ins, and no scripted decision point belongs here.
 */
import type { Services } from './access-saga.ts';

export const SERVICES: Services | null = null;
