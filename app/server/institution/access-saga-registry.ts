/**
 * The participants the scheduled access saga tick runs against.
 *
 * `null` until a real policy administrator, policy decision point and
 * enforcement point exist to hand the runner (`Services` in
 * `packages/institution/src/access-saga.ts`). While it is null the
 * `access-saga-tick` Edge Function lists what is due and moves nothing
 * (`runScheduledAccessSagaTick`), so the job can be scheduled, its token
 * check exercised and its counts watched before anything is provisioned.
 *
 * Registering participants is a reviewed change to this file, as adding an
 * adapter is to `server/integration/registry.ts`: they must be real services,
 * not stand-ins, and the revocation barrier the runner states as `revokePa`'s
 * duty must hold at the enforcement point they talk to.
 */
import type { Services } from '../../../packages/institution/src/index.ts';

export const SERVICES: Services | null = null;
