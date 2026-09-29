/**
 * Whether dining is on for this school at all: `module.dining` in
 * `lib/flags.ts`, through the one evaluator, so a kill switch, an environment
 * or a tenant row that says off answers here exactly as it does everywhere.
 *
 * Two layers of "no" and they mean different things. The flag says whether a
 * school has turned dining on. The partner connection (`partner.ts`) says
 * whether anything dining shows is the institution's figure. Ordering and
 * sharing need both; reading hours and menus needs only the flag.
 */
import { evaluateFlag, type FlagContext, type FlagDecision } from '../flags';
import { no, yes, type Decision } from './decision';

export const DINING_FLAG = 'module.dining';

export function diningGate(ctx: FlagContext): FlagDecision {
  return evaluateFlag(DINING_FLAG, ctx);
}

/** The flag decision as a dining decision, keeping the evaluator's own reason. */
export function requireDining(flag: FlagDecision): Decision<true> {
  if (flag.allowed) return yes(true, flag.reason);
  return no(flag.step === 'kill_switch' ? 'kill_switch' : 'flag_off', `Dining is off here: ${flag.reason}`);
}
