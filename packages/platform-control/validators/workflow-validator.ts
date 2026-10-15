import type { RegistrySnapshot, ValidationIssue } from '../types.ts';

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function validateWorkflows(snapshot: RegistrySnapshot): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const workflow of [...snapshot.workflows].sort((left, right) => compareOrdinal(left.key, right.key))) {
    const path = `workflows.${workflow.key}`;
    const states = new Set(workflow.states);
    const transitionTargets = (state: string): string[] =>
      Object.prototype.hasOwnProperty.call(workflow.transitions, state) ? workflow.transitions[state] : [];
    if (!workflow.owner.trim()) issues.push({ code: 'missing_owner', path, message: 'Workflow requires an owner.' });
    if (!Number.isInteger(workflow.version) || workflow.version < 1) issues.push({ code: 'invalid_version', path: `${path}.version`, message: 'Workflow version must be a positive integer.' });
    if (!workflow.idempotency.trim() || !workflow.retry_policy.trim() || !workflow.escalation_role.trim() || !workflow.runbook.trim()) {
      issues.push({ code: 'incomplete_recovery_contract', path, message: 'Workflow requires idempotency, retry, escalation, and runbook fields.' });
    }
    if (!states.has(workflow.initial)) {
      issues.push({ code: 'unknown_initial', path: `${path}.initial`, message: `Unknown initial state ${workflow.initial}.` });
    }
    const terminals = new Set(workflow.terminal);
    if (workflow.continuous && terminals.size > 0) {
      issues.push({ code: 'continuous_has_terminal', path: `${path}.terminal`, message: 'A continuous workflow cannot declare terminal states.' });
    }
    if (!workflow.continuous && terminals.size === 0) {
      issues.push({ code: 'missing_terminal', path: `${path}.terminal`, message: 'A terminating workflow requires at least one terminal state.' });
    }
    const cycleOutcomes = new Set(workflow.cycle_outcomes);
    if (workflow.continuous && cycleOutcomes.size === 0) {
      issues.push({ code: 'missing_cycle_outcome', path: `${path}.cycle_outcomes`, message: 'A continuous workflow requires at least one per-cycle completed outcome.' });
    }
    if (!workflow.continuous && cycleOutcomes.size > 0) {
      issues.push({ code: 'terminating_has_cycle_outcome', path: `${path}.cycle_outcomes`, message: 'A terminating workflow uses terminal states, not cycle outcomes.' });
    }
    for (const outcome of [...cycleOutcomes].sort(compareOrdinal)) {
      if (!states.has(outcome)) {
        issues.push({ code: 'unknown_cycle_outcome', path: `${path}.cycle_outcomes.${outcome}`, message: `Unknown cycle outcome ${outcome}.` });
      }
    }
    for (const terminal of [...terminals].sort(compareOrdinal)) {
      if (!states.has(terminal)) {
        issues.push({ code: 'unknown_terminal', path: `${path}.terminal.${terminal}`, message: `Unknown terminal state ${terminal}.` });
      } else if (transitionTargets(terminal).length > 0) {
        issues.push({ code: 'terminal_has_exit', path: `${path}.terminal.${terminal}`, message: `Terminal state ${terminal} has an outgoing transition.` });
      }
    }
    for (const [from, targets] of Object.entries(workflow.transitions).sort(([left], [right]) => compareOrdinal(left, right))) {
      if (!states.has(from)) issues.push({ code: 'unknown_transition_source', path: `${path}.transitions.${from}`, message: `Unknown source state ${from}.` });
      for (const target of [...targets].sort(compareOrdinal)) if (!states.has(target)) issues.push({ code: 'unknown_transition_target', path: `${path}.transitions.${from}`, message: `Unknown target state ${target}.` });
    }
    for (const state of [...states].sort(compareOrdinal)) {
      if (!Object.prototype.hasOwnProperty.call(workflow.transitions, state)) {
        issues.push({ code: 'missing_transition_source', path: `${path}.transitions.${state}`, message: `State ${state} has no transition entry.` });
      } else if (workflow.continuous && !transitionTargets(state).some((target) => states.has(target))) {
        issues.push({ code: 'continuous_dead_end', path: `${path}.transitions.${state}`, message: `Continuous state ${state} has no exit.` });
      }
    }

    const reachable = new Set<string>();
    const queue = states.has(workflow.initial) ? [workflow.initial] : [];
    while (queue.length > 0) {
      const state = queue.shift()!;
      if (reachable.has(state)) continue;
      reachable.add(state);
      for (const target of transitionTargets(state)) if (states.has(target)) queue.push(target);
    }
    for (const state of [...states].sort(compareOrdinal)) {
      if (!reachable.has(state)) issues.push({ code: 'unreachable_state', path: `${path}.states.${state}`, message: `State ${state} is unreachable from ${workflow.initial}.` });
    }

    if (workflow.continuous && cycleOutcomes.size > 0) {
      const canCompleteCycle = new Set([...cycleOutcomes].filter((state) => states.has(state)));
      let changed = true;
      while (changed) {
        changed = false;
        for (const state of states) {
          if (!canCompleteCycle.has(state) && (transitionTargets(state)).some((target) => canCompleteCycle.has(target))) {
            canCompleteCycle.add(state);
            changed = true;
          }
        }
      }
      for (const state of [...states].sort(compareOrdinal)) {
        if (!canCompleteCycle.has(state)) issues.push({ code: 'cannot_reach_cycle_outcome', path: `${path}.states.${state}`, message: `State ${state} cannot reach a completed cycle outcome.` });
      }
      const nonOutcomes = new Set([...states].filter((state) => !cycleOutcomes.has(state)));
      const returnsWithoutOutcome = (start: string, current: string, seen: Set<string>): boolean => {
        for (const target of transitionTargets(current)) {
          if (!nonOutcomes.has(target)) continue;
          if (target === start) return true;
          if (seen.has(target)) continue;
          seen.add(target);
          if (returnsWithoutOutcome(start, target, seen)) return true;
        }
        return false;
      };
      for (const state of [...nonOutcomes].sort(compareOrdinal)) {
        if (returnsWithoutOutcome(state, state, new Set([state]))) {
          issues.push({ code: 'outcome_free_cycle', path: `${path}.states.${state}`, message: `State ${state} participates in a cycle that can avoid every completed outcome.` });
        }
      }
    } else if (!workflow.continuous) {
      const canTerminate = new Set([...terminals].filter((state) => states.has(state)));
      let changed = true;
      while (changed) {
        changed = false;
        for (const state of states) {
          if (!canTerminate.has(state) && (transitionTargets(state)).some((target) => canTerminate.has(target))) {
            canTerminate.add(state);
            changed = true;
          }
        }
      }
      for (const state of [...states].sort(compareOrdinal)) {
        if (!canTerminate.has(state)) issues.push({ code: 'cannot_reach_terminal', path: `${path}.states.${state}`, message: `State ${state} cannot reach a terminal state.` });
      }
    }
  }
  return issues;
}
