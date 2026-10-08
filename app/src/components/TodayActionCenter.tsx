import { lazy, Suspense, useMemo } from 'react';
import { blocksFor } from '../data/catalog';
import { ACTIONS_PREFIX, EMPTY_ACTION_CHOICES, rank, readActionChoices } from '../lib/actions';
import { clock, dateToIso } from '../lib/date';
import { useDeviceLibrary } from '../lib/device-library';
import { readDue } from '../lib/duetime';
import { DESKTOP, useMedia } from '../lib/media';
import { goCal } from '../lib/opencal';
import { goMine } from '../lib/openmine';
import { fromHash } from '../lib/route';
import { appointmentsOn, tasksOn, upcomingItems } from '../lib/select';
import { freshnessLine, freshnessState, SOURCE_TEXT, type SourceLabel } from '../lib/source';
import { officeActionToAction } from '../lib/office-actions';
import { useOfficeActions } from '../lib/office-actions.hook';
import { registrationActions } from '../lib/registration-actions';
import { useRegistrationPlan } from '../lib/registration-plan';
import { ownedScope } from '../lib/standing';
import { todayActions } from '../lib/today-actions';
import {
  STATUS_SENTENCE,
  doneForToday,
  itemSource,
  planCommitments,
  type CommitmentRow,
} from '../lib/today-center';
import { pathSnapshot } from '../lib/today-decision';
import { useNow, useStore } from '../state/store';
import { ActionCenter } from './ActionCenter';
import { QuickActions } from './QuickActions';
import { SourceBadge } from './SourceBadge';
import { shadowEnabled } from '../composition/shadow';
import { Meter } from './ui';

/** How far ahead the commitment rows look. "In 9 days" is the furthest the brief's example reaches. */
const HORIZON_DAYS = 10;
const ACCOUNT_SYNC_FRESH_MS = 24 * 60 * 60 * 1000;

/**
 * Today with `today_action_center` on (Phase B, DECISION-LOG D-013 and D-021).
 *
 * The Action Center itself is BL-1.4's (`components/ActionCenter.tsx`): one
 * most important action, up to three next, the rest behind View all, worked
 * with buttons and stored on the canonical model. Phase B puts Today around
 * it:
 *
 * - the path in one of three approved sentences, with its source;
 * - "done for today" when the day is done (handed to the Action Center);
 * - at most one urgent commitment and four time-first rows, never repeating
 *   the item the Action Center leads with;
 * - five quick actions;
 * - on a desktop, a context pane after the column.
 *
 * With the flag off none of this renders, and Today is the #761 briefing.
 */
/** The row's source in words, after its meta. A missing source says nothing. */
function sourceWords(source: SourceLabel | undefined): string {
  if (!source) return '';
  return source === 'needs_review' ? ` · ${SOURCE_TEXT[source]} · date not checked` : ` · ${SOURCE_TEXT[source]}`;
}

/** Phase 2 of the Today migration: the domain layer run beside this one, drawing nothing. Off unless the build opts in. */
const TodayShadow = lazy(() => import('../composition/TodayShadow'));

export function TodayActionCenter({
  registrationDay = false,
  officeActions = false,
  officeAccountId,
}: { registrationDay?: boolean; officeActions?: boolean; officeAccountId?: string | null } = {}) {
  const { state, dispatch, catalog, account, sync } = useStore();
  const now = useNow();
  const wide = useMedia(DESKTOP);
  // The same store the Action Center writes; read here only to know what it
  // leads with and whether the day is done. `useDeviceLibrary` keeps the two
  // readers in step through its change event.
  const library = useDeviceLibrary(`${ACTIONS_PREFIX}:${account?.id || 'device'}`, readActionChoices, EMPTY_ACTION_CHOICES);
  const choices = library.value.choices;

  const path = useMemo(() => pathSnapshot(state.requirements, state.taken), [state.requirements, state.taken]);
  const ownIds = useMemo(() => state.courses.map((c) => c.course.id), [state.courses]);
  const scope = useMemo(
    () => ownedScope(upcomingItems(catalog, now), ownIds, state.sample, catalog.empty),
    [catalog, now, ownIds, state.sample],
  );
  const upcoming = scope.items;
  const reviewDue = useMemo(
    () => Object.values(state.reviews).filter((review) => review.due <= now.getTime()).length,
    [state.reviews, now],
  );
  const registration = useRegistrationPlan();
  // Campus office actions (Phase J), ranked with everything else. The ones the
  // student marked done in the feed stay out.
  const office = useOfficeActions(officeActions, officeAccountId);
  const officeList = office.state.kind === 'ready' ? office.state.actions : null;
  const actions = useMemo(
    () => [
      ...todayActions({ path, upcoming, done: state.done, reviewDue, catalogEmpty: scope.empty }),
      // Registration readiness (Phase C), only while the mode is showing.
      ...(registrationDay ? registrationActions(registration.data, registration.cart, registration.catalog, now) : []),
      ...(officeList ?? []).filter((a) => a.doneAt === null).map((a) => officeActionToAction(a, now.getTime())),
    ],
    [path, upcoming, state.done, reviewDue, scope.empty, registrationDay, registration.data, registration.cart, registration.catalog, now, officeList],
  );
  const top = useMemo(() => rank(actions, choices, now.getTime()).mostImportant, [actions, choices, now]);
  const leadingRoute = top ? fromHash(top.action.primary.target) : null;
  const leadingId = leadingRoute?.screen === 'item' ? leadingRoute.id : null;
  const closure = useMemo(
    () => doneForToday({ upcoming, done: state.done, now: now.getTime() }, choices),
    [upcoming, state.done, now, choices],
  );

  const rows = useMemo(() => {
    const out: CommitmentRow[] = [];
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + HORIZON_DAYS);
    for (const item of upcoming) {
      if (state.done[item.id] || item.date < start || item.date >= end) continue;
      out.push({
        id: `course:${item.id}`,
        at: item.date.getTime() + Math.min(item.dueAt, 24 * 60 - 1) * 60_000,
        title: item.title,
        meta: catalog.byId[item.c]?.code || 'Course deadline',
        kind: 'deadline',
        group: item.c,
        source: itemSource(item),
        itemId: item.id,
      });
    }
    for (let offset = 0; offset < HORIZON_DAYS; offset += 1) {
      const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + offset);
      for (const task of tasksOn(state.tasks, date).filter((t) => !t.done)) {
        out.push({
          id: `task:${task.id}`,
          at: date.getTime() + (readDue(task.time) ?? 24 * 60 - 1) * 60_000,
          title: task.title,
          meta: 'Your action',
          kind: 'task',
          source: 'student_entered',
        });
      }
      for (const appointment of appointmentsOn(state.appointments, date)) {
        out.push({
          id: `appointment:${appointment.id}:${dateToIso(date)}`,
          at: date.getTime() + (appointment.at ?? 0) * 60_000,
          title: appointment.title,
          meta: appointment.where || 'Your appointment',
          kind: 'appointment',
          source: 'student_entered',
        });
      }
      // Classes only for today and tomorrow: a timetable repeated for ten
      // days would push every deadline off the list.
      if (offset > 1) continue;
      // The sample's classes are not the student's classes until they say so.
      const theirs = (b: { c?: string | null }) => !state.sample || !b.c || ownIds.includes(b.c);
      for (const block of blocksFor(catalog, date).filter((b) => !b.optional && !b.canceled && theirs(b))) {
        out.push({
          id: `class:${dateToIso(date)}:${block.c}:${block.at}`,
          at: date.getTime() + block.at * 60_000,
          title: block.title,
          meta: `Class · ${clock(block.at)}`,
          kind: 'class',
          group: block.c || undefined,
        });
      }
    }
    return out;
  }, [catalog, now, ownIds, state.appointments, state.done, state.sample, state.tasks, upcoming]);

  const commitments = useMemo(() => planCommitments(rows, now.getTime(), leadingId), [rows, now, leadingId]);

  const openRow = (row: CommitmentRow) => {
    if (row.itemId) dispatch({ type: 'openItem', id: row.itemId });
    else if (row.kind === 'task') goMine(dispatch, 'tasks');
    else if (row.kind === 'appointment') goMine(dispatch, 'appointments');
    else goCal(dispatch, dateToIso(new Date(row.at)));
  };

  const sentence = STATUS_SENTENCE[path.state];
  // `state.lastSync` also moves when another local tab hydrates from device
  // storage. Only the account sync state proves this device reached the
  // account, so local reconciliation must not earn an Imported/current badge.
  const accountSyncAt = sync.at > 0 ? sync.at : null;
  const syncLine = accountSyncAt ? freshnessLine(accountSyncAt, now.getTime()) : null;
  const syncHealth = freshnessState(accountSyncAt, ACCOUNT_SYNC_FRESH_MS, now.getTime());
  const unchecked = rows.filter((r) => r.source === 'needs_review').length;
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const classesLeft = rows.filter((r) => r.kind === 'class' && r.at >= now.getTime() && r.at < midnight + 86_400_000);
  // `doneForToday` already refuses while anything is due today or tomorrow,
  // so a deadline further out can still sit under "When you have a moment".
  const showClosure = closure?.line ?? null;

  return (
    <section className="today-action-center" aria-label="Today">
      {shadowEnabled() && (
        <Suspense fallback={null}>
          <TodayShadow actions={actions} choices={choices} rows={rows} now={now} registrationDay={registrationDay} officeList={officeList} />
        </Suspense>
      )}
      <div className="action-center-main">
        <section className="action-panel action-panel-primary" aria-label="Your next best step">
          <div className="action-panel-heading">
            <p className="action-kicker">Your focus</p>
            <button
              type="button"
              className="workspace-text-button hides-in-focus"
              onClick={() => dispatch({ type: 'setLook', look: { workspaceMode: 'focused' } })}
            >
              Focus on this
            </button>
          </div>
          <ActionCenter actions={actions} closure={showClosure} />
        </section>

        <section className="action-panel action-panel-secondary" aria-labelledby="action-path-heading">
          <p className="action-kicker">Your path</p>
          <h2 id="action-path-heading" className="action-title">{sentence}</h2>
          <p className="action-body">
            {path.total > 0
              ? `${path.covered} of ${path.total} recorded requirements covered · ${path.creditLine}`
              : path.creditLine}
          </p>
          {path.total > 0 && (
            <Meter
              pct={path.percent}
              height={6}
              label={`${path.covered} of ${path.total} recorded requirements covered by finished or in-progress courses, ${path.percent} percent. This is not degree completion.`}
            />
          )}
          <div className="action-source">
            <SourceBadge label="student_entered" />
            <span className="action-meta">Not the registrar’s audit</span>
          </div>
          <button type="button" className="workspace-text-button" onClick={() => dispatch({ type: 'go', screen: 'degree' })}>
            View My Path
          </button>
        </section>

        <section className="action-panel action-panel-secondary" aria-labelledby="action-commitments-heading">
          <p className="action-kicker">Coming up</p>
          <h2 id="action-commitments-heading" className="action-title">Your commitments</h2>
          {commitments.urgent && (
            <button type="button" className="commitment-urgent" onClick={() => openRow(commitments.urgent!)}>
              <span className="commitment-when">{commitments.urgent.when}</span>
              <strong>{commitments.urgent.title}</strong>
              <span className="commitment-meta">
                {commitments.urgent.meta}
                {sourceWords(commitments.urgent.source)}
              </span>
            </button>
          )}
          {commitments.rows.length > 0 ? (
            <ul className="commitment-list">
              {commitments.rows.map((row) => (
                <li key={row.id}>
                  <button type="button" className="commitment-row" onClick={() => openRow(row)}>
                    <span className="commitment-when">{row.when}</span>
                    <span className="commitment-what">
                      <strong>{row.count > 1 ? (catalog.byId[row.group ?? '']?.code ?? row.title) : row.title}</strong>
                      <span className="commitment-meta">
                        {row.meta}
                        {sourceWords(row.source)}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : !commitments.urgent ? (
            <p className="action-body">Nothing is recorded for the next {HORIZON_DAYS} days.</p>
          ) : null}
          <button type="button" className="workspace-text-button" onClick={() => goCal(dispatch, dateToIso(now))}>
            See full plan
          </button>
        </section>

        <div className="hides-in-focus">
          <QuickActions />
        </div>
      </div>

      {wide && (
        <aside className="today-context" aria-label="Today at a glance">
          <h2 className="action-kicker">At a glance</h2>
          <section aria-labelledby="context-plan">
            <h3 id="context-plan">Planning status</h3>
            <p>{sentence}</p>
          </section>
          <section aria-labelledby="context-today">
            <h3 id="context-today">Today’s schedule</h3>
            {classesLeft.length > 0 ? (
              <ul>
                {classesLeft.map((r) => <li key={r.id}>{clock(Math.round((r.at - midnight) / 60_000))} · {r.title}</li>)}
              </ul>
            ) : (
              <p>No more classes today.</p>
            )}
          </section>
          <section aria-labelledby="context-fresh">
            <h3 id="context-fresh">Data freshness</h3>
            <div className="action-source">
              <SourceBadge label={syncHealth === 'current' ? 'imported' : 'unavailable_stale'} />
              <span className="action-meta">
                {syncLine ? `Account sync: ${syncLine.toLowerCase()}` : 'No account sync recorded on this device.'}
              </span>
            </div>
            {syncHealth !== 'current' ? (
              <p>
                Account data may be out of date. Your saved plan still works; refresh from Account when connected and use the official system for time-sensitive actions.
              </p>
            ) : null}
            <p>
              {unchecked === 0
                ? 'Every upcoming course date has been checked against its source.'
                : `${unchecked} upcoming course ${unchecked === 1 ? 'date has' : 'dates have'} not been checked against the syllabus.`}
            </p>
          </section>
        </aside>
      )}
    </section>
  );
}
