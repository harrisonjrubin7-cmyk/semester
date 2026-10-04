import type { Principal } from './model';

/** Where a host learns who is asking. The legacy store is one implementation; a session service would be another. */
export interface IdentityPort {
  current(): Principal;
}
