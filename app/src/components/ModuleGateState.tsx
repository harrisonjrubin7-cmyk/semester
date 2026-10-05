import type { ReactNode } from 'react';
import { useStore } from '../state/store';
import { Notice } from './ui';
import type { ModuleGate } from '../lib/modulegate';

/**
 * What a flagged school module shows when it cannot show itself.
 *
 * Every state but `on` is one sentence and at most one way forward, in the
 * order the permission-state contract asks for (UI constitution §6): what is
 * unavailable, why, who controls it, what the person can do. `off` is the
 * state every school is in today, so it is the one most people will ever see,
 * and it is written as a fact about the school rather than an error — nothing
 * is broken, the school has not turned it on.
 *
 * Returns null when the module is on, so a screen reads
 * `gateState(...) ?? <TheScreen/>`.
 */
export function ModuleGateState({
  gate,
  what,
  off,
}: {
  gate: ModuleGate & { retry: () => void };
  /** The module, lower-case, as the object of a sentence: "registration", "the gradebook". */
  what: string;
  /** The one sentence for a school that has not turned it on. */
  off: ReactNode;
}) {
  const { dispatch } = useStore();
  switch (gate.status) {
    case 'on':
      return null;
    case 'loading':
      return <p role="status">Checking whether your school has {what} turned on…</p>;
    case 'off':
      return <Notice>{off}</Notice>;
    case 'stopped':
      return (
        <Notice alert>
          Your school has paused {what} in Semester for now ({gate.switch}), so nothing here can be changed. Your
          school’s administrators lift the pause; until then, use your school’s own system.
        </Notice>
      );
    case 'signed_out':
      return (
        <>
          <Notice>
            Sign in with your school account to use {what}. It shows your own records, so Semester needs to know who you are
            first.
          </Notice>
          <button type="button" className="btn" onClick={() => dispatch({ type: 'go', screen: 'account' })}>
            Open your account
          </button>
        </>
      );
    case 'no_school':
      return (
        <>
          <Notice>
            Your account is not linked to a school yet, and {what} belongs to your school. Choose your school in your profile;
            your school decides whether {what} is turned on.
          </Notice>
          <button type="button" className="btn" onClick={() => dispatch({ type: 'go', screen: 'profile' })}>
            Open your profile
          </button>
        </>
      );
    case 'error':
      return (
        <>
          <Notice alert>
            {gate.message} Nothing has changed. Try again, or use your school’s own system if this keeps happening.
          </Notice>
          <button type="button" className="btn" onClick={gate.retry}>
            Try again
          </button>
        </>
      );
  }
}
