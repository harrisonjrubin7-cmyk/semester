/**
 * Reminder rules the student writes.
 *
 * The seven built-in toggles are good defaults and they are somebody else's.
 * "Two-day warning on big assignments" is right for a problem set and useless
 * for a twenty-page paper that needed starting a fortnight ago. This is where
 * they say their own lead time.
 *
 * Each rule is one sentence with three blanks, and it reads back as a sentence
 * — `ruleLine` — so what the app will do is legible without decoding a row of
 * controls. The arithmetic is in `lib/myrules.ts`.
 */

import { useStore } from '../state/store';
import { SectionLabel, TickBox } from './ui';
import {
  MOST_DAYS,
  MOST_RULES,
  addRule,
  dropRule,
  editRule,
  ruleLine,
} from '../lib/myrules';

/** The leads people actually use. A free number field invites 0 and 365. */
const LEADS = [0, 1, 2, 3, 5, 7, 10, 14, MOST_DAYS];

/** Waking hours. Nobody sets a reminder for 3am on purpose. */
const HOURS = [6, 7, 8, 9, 10, 12, 15, 17, 18, 19, 20, 21, 22];

const hourLabel = (h: number) => `${h % 12 === 0 ? 12 : h % 12}${h < 12 ? 'am' : 'pm'}`;

export function MyRules() {
  const { state, dispatch, catalog, courseCode } = useStore();
  const rules = state.myRules;

  const set = (next: typeof rules) => dispatch({ type: 'setMyRules', rules: next });

  return (
    <>
      <SectionLabel
        style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(6px * var(--density, 1))' }}
      >
        Your own reminders
      </SectionLabel>
      <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', opacity: 0.65, marginBottom: 10, textWrap: 'pretty' }}>
        The seven above are defaults. These are yours — a lead time you choose, on the kind of
        thing you choose, for one course or all of them. They add to the ones above rather than
        replacing any, so nothing here can make a reminder stop arriving.
      </div>

      {rules.map((r) => (
        <div
          key={r.id}
          style={{
            padding: '11px 0',
            borderBottom: '1px solid var(--app-line)',
          }}
        >
          <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start' }}>
            <button
              type="button"
              className="bare tappable"
              onClick={() => set(editRule(rules, r.id, { on: !r.on }))}
              aria-label={r.on ? `Switch off: ${ruleLine(r, courseCode)}` : `Switch on: ${ruleLine(r, courseCode)}`}
              style={{ flex: 'none', width: 28, padding: '2px 0' }}
            >
              <TickBox on={r.on} />
            </button>
            <div style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))', opacity: r.on ? 1 : 0.5 }}>
              {ruleLine(r, courseCode)}
            </div>
            <button
              type="button"
              className="bare"
              onClick={() => set(dropRule(rules, r.id))}
              aria-label={`Delete: ${ruleLine(r, courseCode)}`}
              style={{ flex: 'none', width: 28, opacity: 0.5, fontSize: 'calc(15px * var(--text-scale, 1))' }}
            >
              ×
            </button>
          </div>

          <div style={{ display: 'flex', gap: 7, marginTop: 8, flexWrap: 'wrap' }}>
            <select
              className="input"
              value={r.days}
              onChange={(e) => set(editRule(rules, r.id, { days: Number(e.target.value) }))}
              aria-label="How long before"
              style={{ flex: '1 1 96px', fontSize: 'calc(12.5px * var(--text-scale, 1))', minWidth: 96 }}
            >
              {LEADS.map((d) => (
                <option key={d} value={d}>
                  {d === 0 ? 'On the day' : `${d} ${d === 1 ? 'day' : 'days'} before`}
                </option>
              ))}
            </select>

            <select
              className="input"
              value={r.watches}
              onChange={(e) =>
                set(editRule(rules, r.id, { watches: e.target.value as typeof r.watches }))
              }
              aria-label="What it watches"
              style={{ flex: '1 1 92px', fontSize: 'calc(12.5px * var(--text-scale, 1))', minWidth: 92 }}
            >
              <option value="deadline">every deadline</option>
              <option value="exam">exams only</option>
            </select>

            <select
              className="input"
              value={r.hour}
              onChange={(e) => set(editRule(rules, r.id, { hour: Number(e.target.value) }))}
              aria-label="What time of day"
              style={{ flex: '0 1 78px', fontSize: 'calc(12.5px * var(--text-scale, 1))', minWidth: 74 }}
            >
              {HOURS.map((h) => (
                <option key={h} value={h}>
                  {hourLabel(h)}
                </option>
              ))}
            </select>

            <select
              className="input"
              value={r.courseId}
              onChange={(e) => set(editRule(rules, r.id, { courseId: e.target.value }))}
              aria-label="Which course"
              style={{ flex: '1 1 120px', fontSize: 'calc(12.5px * var(--text-scale, 1))', minWidth: 110 }}
            >
              <option value="">all courses</option>
              {catalog.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code}
                </option>
              ))}
            </select>
          </div>
        </div>
      ))}

      {rules.length < MOST_RULES ? (
        <button
          type="button"
          className="btn btn-secondary btn-block"
          onClick={() => set(addRule(rules))}
          style={{ height: 42, marginTop: 12 }}
        >
          Add a reminder rule
        </button>
      ) : (
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 12 }}>
          {MOST_RULES} is the limit — past that nobody remembers what they asked for.
        </div>
      )}
    </>
  );
}
