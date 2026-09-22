/**
 * What the app will do on its own, listed where it can be stopped.
 *
 * Platform §313's one bold sentence — *users must understand what automations
 * are active* — and §314's "in one place". `lib/automations.ts` is the list;
 * this draws it at the top of Alerts, above the switches, so the answer to
 * "what is running" sits directly over the controls that change it.
 *
 * The mail rules are the one kind that lived on another screen. They get a
 * switch here — the same `off` the Mail screen's own list flips — and a way
 * to Mail for editing the search itself, which needs the mailbox open to show
 * what it would catch.
 */

import { useStore } from '../state/store';
import { secondLine } from '../lib/dim';
import { running, runningLine } from '../lib/automations';
import { Toggle } from './ui';

export function RunningNow() {
  const { state, dispatch, courseCode } = useStore();
  const rows = running(state, courseCode);
  const mailRules = rows.filter((r) => r.source === 'mail');

  return (
    <div className="running-now">
      <div className="running-now-line" style={secondLine()}>
        {runningLine(rows)}
      </div>
      {rows.length > 0 && (
        <ul className="running-now-list">
          {rows.map((r) => (
            <li key={`${r.source}:${r.id}`} className={r.held ? 'running-now-row is-held' : 'running-now-row'}>
              <span>{r.says}</span>
              {r.held && <span className="running-now-held">{r.held}</span>}
            </li>
          ))}
        </ul>
      )}
      {state.mailRules.length > 0 && (
        <div className="running-now-mail">
          {state.mailRules.map((rule) => (
            <Toggle
              key={rule.id}
              label={`Mail rule: ${rule.name.trim() || rule.when.trim() || 'Untitled rule'}`}
              on={!rule.off}
              onChange={() => dispatch({ type: 'putMailRule', rule: { ...rule, off: !rule.off } })}
            />
          ))}
          <button
            type="button"
            className="bare running-now-edit"
            onClick={() => dispatch({ type: 'go', screen: 'mail' })}
          >
            Edit mail rules in Mail
          </button>
          {mailRules.length === 0 && (
            <div style={secondLine()}>None of these is running — switched off, or matching mail and doing nothing.</div>
          )}
        </div>
      )}
    </div>
  );
}
