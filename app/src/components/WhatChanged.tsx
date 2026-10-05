/**
 * What changed in your deadlines since you last looked, on Today and on a
 * course's page.
 *
 * `lib/whatchanged.ts` decides what differs; this draws it and holds the one
 * button. Each change shows the six things a student needs to trust it —
 * before, after, where the new value comes from, when it takes effect, what it
 * does to them and what they can do — and nothing here edits a deadline. The
 * only write is "Got it", which moves the acknowledged reading to what is on
 * screen.
 *
 * ## It is silent far more often than not
 *
 * No changes, the sample semester, or a course never read before all draw
 * nothing. A course never read is seeded silently, so the first visit reports
 * nothing instead of every deadline as new.
 *
 * ## The sample cannot reach it
 *
 * While `state.sample` is true the catalogue carries a shipped semester the
 * visitor never asked for; a change report about somebody else's term is worse
 * than none.
 */

import { useEffect, useMemo } from 'react';
import { useNow, useStore } from '../state/store';
import { ActionButton, SectionLabel } from './ui';
import { Folding } from './Fold';
import { READ_ONLY } from '../lib/readonly';
import { pendingChanges, seenOf, unseenCourses, type WhatChanged as Change } from '../lib/whatchanged';

const KIND: Record<Change['kind'], string> = {
  added: 'New deadline',
  removed: 'No longer listed',
  moved: 'Date moved',
  retimed: 'Time changed',
  reweighted: 'Weight changed',
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dateLine = (d: Date) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

/** Pass a course id for Course Home; omit it for Today. */
export function WhatChanged({ courseId }: { courseId?: string }) {
  const { state, dispatch, catalog } = useStore();
  const now = useNow();
  const live = !state.sample && !READ_ONLY;

  const fresh = useMemo(
    () => (live ? unseenCourses(state.deadlineSeen, catalog.items) : {}),
    [live, state.deadlineSeen, catalog.items],
  );
  useEffect(() => {
    if (Object.keys(fresh).length > 0) dispatch({ type: 'seenDeadlines', seen: fresh, onlyNew: true });
  }, [fresh, dispatch]);

  const changes = useMemo(
    () => (state.sample ? [] : pendingChanges(state.deadlineSeen, catalog.items, now, courseId)),
    [state.sample, state.deadlineSeen, catalog.items, now, courseId],
  );
  if (changes.length === 0) return null;

  const courses = [...new Set(changes.map((c) => c.courseId))];
  const gotIt = () =>
    dispatch({
      type: 'seenDeadlines',
      onlyNew: false,
      seen: Object.fromEntries(
        courses.map((c) => [c, catalog.items.filter((i) => i.c === c).map(seenOf)]),
      ),
    });

  return (
    <Folding name="WhatChanged">
      <div style={{ marginTop: 'calc(14px * var(--density, 1))' }}>
        <SectionLabel style={{ marginTop: '0', marginInline: '0', marginBottom: 'calc(8px * var(--density, 1))' }}>What changed</SectionLabel>
        <ul
          aria-label="Changes to your deadlines"
          style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 'calc(7px * var(--density, 1))' }}
        >
          {changes.map((c) => (
            <li
              key={c.id}
              style={{
                paddingBlock: 'calc(10px * var(--density, 1))',
                paddingInline: 'calc(13px * var(--density, 1))',
                borderRadius: 'var(--r-md)',
                border: '1px solid var(--app-warn-line)',
                background: 'var(--app-warn-wash)',
              }}
            >
              <div style={{ fontSize: 'var(--type-base-plus)', lineHeight: 'var(--leading-tight-plus)', textWrap: 'pretty' }}>
                {c.title} · {KIND[c.kind]}
              </div>
              <dl style={{ margin: 0, marginTop: 'calc(3px * var(--density, 1))', fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)' }}>
                {c.previous !== null ? <Row k="Before" v={c.previous} /> : null}
                {c.next !== null ? <Row k="Now" v={c.next} /> : null}
                <Row k="Effective" v={dateLine(c.effective)} />
                <Row k="Source" v={c.source} />
                <Row k="Impact" v={c.impact} />
                <Row k="You can" v={c.action} />
              </dl>
            </li>
          ))}
        </ul>
        <ActionButton tone="ghost" onClick={gotIt} style={{ marginTop: 'calc(8px * var(--density, 1))' }}>
          Got it
        </ActionButton>
      </div>
    </Folding>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', gap: 'calc(6px * var(--density, 1))' }}>
      <dt style={{ minWidth: '4.5em' }}>{k}</dt>
      <dd style={{ margin: 0, textWrap: 'pretty' }}>{v}</dd>
    </div>
  );
}
