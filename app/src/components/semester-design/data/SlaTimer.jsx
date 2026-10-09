import React from 'react';
const L = { ok: '◷', soon: '!', breach: '⊘', met: '✓', paused: '‖', none: '–' };
const fmt = (ms) => { const a = Math.abs(ms); const m = Math.round(a / 60000); const d = Math.floor(m / 1440), h = Math.floor((m % 1440) / 60), mm = m % 60; return d ? d + ' d ' + h + ' h' : h ? h + ' h ' + mm + ' m' : mm + ' m'; };
/** Time left on a service-level target. Glyph + words carry the state; colour only reinforces.
 * Hardened: can compute from a due timestamp (ticks each minute, no per-second churn), derives soon/breach itself, says "No target" when none applies, pause reason, met-at time. */
export function SlaTimer({ remaining, target, state, paused = false, pausedReason, due, soonWithinMinutes = 60, met = false, metAt, now }) {
  const [t, setT] = React.useState(() => now || Date.now());
  React.useEffect(() => { if (!due || paused || met) return; const id = setInterval(() => setT(Date.now()), 60000); return () => clearInterval(id); }, [due, paused, met]);
  let st = state, rem = remaining;
  if (due && !state) { const ms = new Date(due).getTime() - (now || t); if (!Number.isFinite(ms)) { st = 'none'; } else { rem = fmt(ms); st = met ? 'met' : ms < 0 ? 'breach' : ms <= soonWithinMinutes * 60000 ? 'soon' : 'ok'; } }
  if (met) st = 'met'; if (!st) st = rem ? 'ok' : 'none';
  const key = paused ? 'paused' : st;
  const word = paused ? 'Paused' + (pausedReason ? ': ' + pausedReason : '') : st === 'breach' ? 'Overdue' + (rem ? ' by ' + rem : '') : st === 'met' ? 'Met' + (metAt ? ' ' + metAt : '') : st === 'none' ? 'No target' : (rem || '') + ' left';
  return <span className="sla" data-state={key} role="timer" aria-live="off"><span aria-hidden="true">{L[key]}</span><span>{word}</span>{target && <span className="gov-sub">· target {target}</span>}</span>;
}
