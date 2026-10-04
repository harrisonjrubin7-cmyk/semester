import type { Principal } from '../identity';
import { decide, type PolicyEnvironment } from './model';
import type { Can } from './ports';

/** Fix a person and an environment, leaving only the action to ask about. */
export const bindPolicy = (principal: Principal, environment: PolicyEnvironment): Can => (action) =>
  decide(principal, action, environment);
