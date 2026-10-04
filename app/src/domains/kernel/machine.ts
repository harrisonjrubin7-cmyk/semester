import { transition, type WorkflowDefinition } from '../../../../packages/institution/src/workflow';
import { err, ok, type Result } from './result';

/**
 * State machines, written as events.
 *
 * `packages/institution/src/workflow.ts` (ADR 0009) already says which moves are
 * legal between states and refuses the rest; this adds the thing a use case
 * actually has — an *event* ("complete", "reopen") — and maps it to the move.
 * It builds on that evaluator rather than beside it, so there is one idea of
 * "legal transition" in the repository, and `exceptional` and `terminal` mean
 * what they mean there.
 *
 * A machine is data. It stores nothing and does nothing; `send` is pure and
 * returns the state to write. The write, and the permission to make it, belong
 * to the caller. That is what lets `machine.test.ts` check every state against
 * every event instead of sampling.
 */

export interface MachineSpec<S extends string, E extends string> {
  type: string;
  initial: S;
  terminal?: readonly S[];
  /** For each state, which event leads where. Absent or empty means no exits. */
  on: Readonly<Record<S, Partial<Record<E, S>>>>;
}

export interface Machine<S extends string, E extends string> {
  readonly spec: MachineSpec<S, E>;
  readonly states: readonly S[];
  readonly events: readonly E[];
  /** The same machine as ADR 0009 describes it, for anything that already speaks that vocabulary. */
  readonly definition: WorkflowDefinition<S>;
}

export function defineMachine<S extends string, E extends string>(spec: MachineSpec<S, E>): Machine<S, E> {
  const states = Object.keys(spec.on) as S[];
  const events = [...new Set(states.flatMap((s) => Object.keys(spec.on[s]) as E[]))];
  const transitions = Object.fromEntries(
    states.map((s) => [s, [...new Set(Object.values(spec.on[s]) as S[])]]),
  ) as unknown as Record<S, readonly S[]>;
  return {
    spec,
    states,
    events,
    definition: { type: spec.type, initial: spec.initial, terminal: spec.terminal ?? [], transitions, exceptional: [] },
  };
}

/** The state `event` leads to from `from`, or an `invalid_transition` error that says so. */
export function send<S extends string, E extends string>(machine: Machine<S, E>, from: S, event: E): Result<S> {
  const target = machine.spec.on[from]?.[event];
  if (target === undefined) {
    return err('invalid_transition', `That can’t happen from here: “${event}” while ${from}.`, {
      machine: machine.spec.type,
      from,
      event,
    });
  }
  const verdict = transition(machine.definition, from, target);
  return verdict.ok
    ? ok(verdict.state)
    : err('invalid_transition', `That can’t happen from here: “${event}” while ${from}.`, {
        machine: machine.spec.type,
        from,
        event,
      });
}
