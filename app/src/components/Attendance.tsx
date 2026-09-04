/**
 * A course's attendance policy, and how much of it is left.
 *
 * Two parts, and the order is deliberate. The **budget** comes first because
 * it is the thing a student needs at a glance — three absences left, or none,
 * or a penalty already running. The **policy** is behind it, because it is
 * typed once at the start of term and then only corrected.
 *
 * The policy has to be entered by hand for now. The importer reads a syllabus
 * for dates and weights and does not yet ask about attendance, so the app has
 * no way to know a rule exists — and a rule it invented would be worse than
 * none, since the whole value here is a number a student can rely on.
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
    <>
      <SectionLabel style={{ margin: '24px 0 6px' }}>Turning up</SectionLabel>

      {hasPolicy(policy) ? (
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--r-md)',
            border: `1px solid ${how === 'over' || how === 'close' ? 'var(--app-warn-line)' : 'var(--app-line)'}`,
            background: how === 'over' || how === 'close' ? 'var(--app-warn-wash)' : 'transparent',
          }}
        >
          {policy.allowed > 0 || policy.penaltyPer > 0 ? (
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <span
                className="chrome-text"
                style={{ fontSize: 'calc(28px * var(--text-scale, 1))', lineHeight: 1 }}
              >
                {b.over > 0 ? `−${Math.round(b.cost * 10) / 10}%` : b.left}
              </span>
              <span style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.7 }}>
                {b.over > 0 ? 'already lost to absences' : b.left === 1 ? 'absence left' : 'absences left'}
              </span>
            </div>
          ) : null}
          <div
            style={{
              fontSize: 'calc(13px * var(--text-scale, 1))',
              marginTop: 7,
              lineHeight: 1.5,
              textWrap: 'pretty',
            }}
          >
            {said}
          </div>
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6 }}>
            {t.marked === 0
              ? 'Nothing marked yet. Mark a class from the day view.'
              : `${t.marked} ${t.marked === 1 ? 'class' : 'classes'} marked · ${t.present} went, ${t.absent} missed${t.excused ? `, ${t.excused} excused` : ''}`}
          </div>
          {policy.note ? (
            <div
              style={{
                fontSize: 'calc(11.5px * var(--text-scale, 1))',
                opacity: 0.55,
                marginTop: 7,
                lineHeight: 1.45,
                textWrap: 'pretty',
              }}
            >
              “{policy.note}”
            </div>
          ) : null}
        </div>
      ) : (
        <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.6, lineHeight: 1.5, textWrap: 'pretty' }}>
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
          padding: '8px 0',
          fontSize: 'calc(12px * var(--text-scale, 1))',
          opacity: 0.6,
          textAlign: 'left',
        }}
      >
        {open ? 'Done' : hasPolicy(policy) ? 'Change the rule' : 'Enter the rule'}
      </button>

      {open && (
        <div style={{ paddingBottom: 8 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ flex: '1 1 130px', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.7 }}>
              Absences allowed
              <input
                className="input"
                inputMode="numeric"
                value={policy.allowed || ''}
                placeholder="0"
                onChange={(e) => set({ allowed: Number(e.target.value) || 0 })}
                style={{ width: '100%', height: 38, marginTop: 4, fontSize: 'calc(13.5px * var(--text-scale, 1))' }}
              />
            </label>
            <label style={{ flex: '1 1 130px', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.7 }}>
              Then % off, each
              <input
                className="input"
                inputMode="decimal"
                value={policy.penaltyPer || ''}
                placeholder="0"
                onChange={(e) => set({ penaltyPer: Number(e.target.value) || 0 })}
                style={{ width: '100%', height: 38, marginTop: 4, fontSize: 'calc(13.5px * var(--text-scale, 1))' }}
              />
            </label>
            <label style={{ flex: '1 1 130px', fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.7 }}>
              Or worth % of grade
              <input
                className="input"
                inputMode="decimal"
                value={policy.worth || ''}
                placeholder="0"
                onChange={(e) => set({ worth: Number(e.target.value) || 0 })}
                style={{ width: '100%', height: 38, marginTop: 4, fontSize: 'calc(13.5px * var(--text-scale, 1))' }}
              />
            </label>
          </div>
          <input
            className="input"
            value={policy.note}
            placeholder="The rule in the syllabus's own words, so you can check it later"
            aria-label="The attendance rule as the syllabus words it"
            onChange={(e) => set({ note: e.target.value })}
            style={{ width: '100%', marginTop: 8, fontSize: 'calc(13px * var(--text-scale, 1))' }}
          />
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 7, lineHeight: 1.45 }}>
            A course can have both: some free absences with a penalty after, and attendance as a
            weighted category. Leave what does not apply at zero.
          </div>
        </div>
      )}
    </>
  );
}
