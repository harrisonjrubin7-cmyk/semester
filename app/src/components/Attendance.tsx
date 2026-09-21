/**
 * A course's attendance policy, and how much of it is left.
 *
 * Two parts, and the order is deliberate. The **budget** comes first because
 * it is the thing a student needs at a glance — three absences left, or none,
 * or a penalty already running. The **policy** is behind it, because it is
 * typed once at the start of term and then only corrected.
 *
 * The importer fills the policy in where the syllabus states one — it reads
 * dates, weights and now this — and the fields below stay editable because a
 * read rule is a proposal, not a fact. `lib/generate.ts` quotes the sentence
 * it took the rule from into `note` for exactly that reason, and refuses to
 * guess: a syllabus that says nothing about attendance produces nothing here
 * rather than a common-looking default, because a student told they have
 * three absences who actually has none will use them.
 *
 * So the hand-entry path is still the whole path for a course whose syllabus
 * is silent, or whose rule the importer read wrong. It is not a fallback that
 * withered — it is where the number a student relies on is finally agreed.
 */

import { useState } from 'react';
import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import {
  NO_POLICY,
  attendLine,
  budget,
  hasPolicy,
  standing,
  tally,
  type AttendPolicy,
} from '../lib/attend';
import type { CourseId } from '../lib/types';
import { Folding } from './Fold';

export function Attendance({ courseId }: { courseId: CourseId }) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState(false);

  const policy = state.attendPolicy[courseId] ?? NO_POLICY;
  const t = tally(state.attendance, courseId);
  const said = attendLine(policy, t);
  const how = standing(policy, t);
  const b = budget(policy, t);

  const set = (patch: Partial<AttendPolicy>) =>
    dispatch({ type: 'setAttendPolicy', courseId, policy: { ...policy, ...patch } });

  return (
    <Folding name="Attendance">
      <SectionLabel style={{ marginTop: 'calc(24px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(6px * var(--density, 1))' }}>Turning up</SectionLabel>

      {hasPolicy(policy) ? (
        <div
          style={{
            paddingBlock: 'calc(12px * var(--density, 1))', paddingInline: 'calc(14px * var(--density, 1))',
            borderRadius: 'var(--r-md)',
            border: `1px solid ${how === 'over' || how === 'close' ? 'var(--app-warn-line)' : 'var(--app-line)'}`,
            background: how === 'over' || how === 'close' ? 'var(--app-warn-wash)' : 'transparent',
          }}
        >
          {policy.allowed > 0 || policy.penaltyPer > 0 ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--sp-5)' }}>
              <span
                className="chrome-text"
                style={{ fontSize: 'calc(28px * var(--text-scale, 1))', lineHeight: 'var(--leading-none)' }}
              >
                {b.over > 0 ? `−${Math.round(b.cost * 10) / 10}%` : b.left}
              </span>
              <span style={{ fontSize: 'var(--type-sm-plus)', color: 'var(--app-dim)' }}>
                {b.over > 0 ? 'already lost to absences' : b.left === 1 ? 'absence left' : 'absences left'}
              </span>
            </div>
          ) : null}
          <div
            style={{
              fontSize: 'var(--type-base)',
              marginTop: 'calc(7px * var(--density, 1))',
              lineHeight: 'var(--leading-relaxed)',
              textWrap: 'pretty',
            }}
          >
            {said}
          </div>
          <div style={{ fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)' }}>
            {t.marked === 0
              ? 'Nothing marked yet. Mark a class from the day view.'
              : `${t.marked} ${t.marked === 1 ? 'class' : 'classes'} marked · ${t.present} went, ${t.absent} missed${t.excused ? `, ${t.excused} excused` : ''}`}
          </div>
          {policy.note ? (
            <div
              style={{
                fontSize: 'var(--type-xs-plus)',
                color: 'var(--app-dim)',
                marginTop: 'calc(7px * var(--density, 1))',
                lineHeight: 'var(--leading-normal)',
                textWrap: 'pretty',
              }}
            >
              “{policy.note}”
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ fontSize: 'var(--type-sm-plus)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
          {/* Stated rather than assumed. The importer does not read attendance
              rules yet, so "nothing here" means nothing was entered — not
              that the syllabus is silent. */}
          No attendance rule recorded for this course. If the syllabus has one, entering it here is
          what lets the grade projection see it.
        </div>
      )}

      <button
        type="button"
        className="bare tappable"
        onClick={() => setOpen((was) => !was)}
        aria-expanded={open}
        style={{
          width: 'auto',
          paddingBlock: 'calc(8px * var(--density, 1))', paddingInline: '0',
          fontSize: 'var(--type-sm)',
          color: 'var(--app-dim)',
          textAlign: 'left',
        }}
      >
        {open ? 'Done' : hasPolicy(policy) ? 'Change the rule' : 'Enter the rule'}
      </button>

      {open && (
        <div style={{ paddingBottom: 'var(--sp-4)' }}>
          <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 130px', fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)' }}>
              Absences allowed
              <input
                className="input"
                inputMode="numeric"
                value={policy.allowed || ''}
                placeholder="0"
                onChange={(e) => set({ allowed: Number(e.target.value) || 0 })}
                style={{ width: '100%', height: 38, marginTop: 'var(--sp-2)', fontSize: 'var(--type-base-plus)' }}
              />
            </label>
            <label style={{ flex: '1 1 130px', fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)' }}>
              Then % off, each
              <input
                className="input"
                inputMode="decimal"
                value={policy.penaltyPer || ''}
                placeholder="0"
                onChange={(e) => set({ penaltyPer: Number(e.target.value) || 0 })}
                style={{ width: '100%', height: 38, marginTop: 'var(--sp-2)', fontSize: 'var(--type-base-plus)' }}
              />
            </label>
            <label style={{ flex: '1 1 130px', fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)' }}>
              Or worth % of grade
              <input
                className="input"
                inputMode="decimal"
                value={policy.worth || ''}
                placeholder="0"
                onChange={(e) => set({ worth: Number(e.target.value) || 0 })}
                style={{ width: '100%', height: 38, marginTop: 'var(--sp-2)', fontSize: 'var(--type-base-plus)' }}
              />
            </label>
          </div>
          <input
            className="input"
            value={policy.note}
            placeholder="The rule in the syllabus's own words, so you can check it later"
            aria-label="The attendance rule as the syllabus words it"
            onChange={(e) => set({ note: e.target.value })}
            style={{ width: '100%', marginTop: 'var(--sp-4)', fontSize: 'var(--type-base)' }}
          />
          <div style={{ fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)', marginTop: 'calc(7px * var(--density, 1))', lineHeight: 'var(--leading-normal)' }}>
            A course can have both: some free absences with a penalty after, and attendance as a
            weighted category. Leave what does not apply at zero.
          </div>
        </div>
      )}
    </Folding>
  );
}
