import { useRef, useState } from 'react';
import { useDeviceLibrary } from '../lib/device-library';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { ActionButton, FilePick, Notice, SectionLabel, Segmented } from '../components/ui';
import { CardGrid, GridCard } from '../components/GridCard';
import { secondLine } from '../lib/dim';
import { download } from '../lib/deliver';
import { fromMarkdown } from '../lib/document';
import { DRAFT_TEMPLATES } from '../lib/university.templates';
import {
  DRAFT_LIMITS,
  UNIVERSITY_AREAS,
  UNIVERSITY_ROLES,
  commitInstitutionAction,
  gatewayConfigured,
  institutionRecords,
  institutionStatus,
  prepareInstitutionAction,
  readUniversityDrafts,
  reconcileInstitutionAction,
  type InstitutionStatus,
  type Receipt,
  type RecordAction,
  type Review,
  type UniversityArea,
  type UniversityDraft,
  type UniversityRecord,
  type UniversityRole,
} from '../lib/university';
import { schoolCourse } from '../lib/fromschool';
import type { Screen } from '../lib/types';

/**
 * Everything a university is, and an honest account of which parts work.
 *
 * Thirty-seven service areas — registration, the bursar, dining, advising,
 * accessibility — in one place, each saying what this app can actually do for
 * it today. For nearly all of them the answer is the same: it can help you
 * *prepare*. It can hold the questions for an advising appointment, the
 * checklist before a form is filed, the draft of an appeal. It cannot file
 * anything, because filing requires a school to have deployed a gateway and
 * approved an adapter, and none has.
 *
 * ## Saying so is the design
 *
 * The easy version of this screen is a grid of thirty-seven tiles that look
 * like they do something. That screen is a lie a student would discover at
 * the worst possible moment — the evening a registration deadline closes. So
 * every tile states its connection, the records tab draws an empty state
 * naming what the school has not enabled, and nothing anywhere is labelled
 * submitted, enrolled, paid or official unless a receipt from the school's
 * own gateway says so.
 *
 * ## The role selector is not a permission
 *
 * "Prepare work as: Administrator" changes which template a new draft starts
 * from. It grants nothing, and it cannot: what this account may see comes
 * back from the gateway in `InstitutionStatus.roles`, which only the school
 * can set. The two are separate fields with separate names in
 * `@semester/institution` precisely so that no screen can confuse them, and
 * the line under the selector says this in the second person.
 *
 * ## Drafts are this device's
 *
 * They are kept in `localStorage`, keyed by account and term, and never sent
 * anywhere. That is a real limitation rather than a feature, so the screen
 * offers an export and says where they live. A failure to read or save them
 * is surfaced with a recovery download rather than swallowed — an unreadable
 * draft file is somebody's appeal.
 *
 * ## And the school's courses can now be brought in
 *
 * The other half of that separation used to be that a school's records were
 * drawn and never kept. "Add my courses to this app" copies them — the course
 * and every published deadline — into the same library the student's own
 * imported courses live in, so Today, Calendar and Study can see them. That is
 * the Calendar stage of the completion plan's chain, and it is a change of
 * position rather than an oversight: it is written down here because the
 * opposite used to be.
 *
 * It keeps what the separation was for. A copy happens because somebody asked
 * for it; everything copied carries the institution's name, on the course and
 * on each deadline, so it cannot be mistaken for the student's own; a sync
 * updates rather than duplicating and will not undo a date they moved; and
 * nothing anywhere is labelled official without a receipt.
 */

/** The tabs, and what each is for. */
const TABS = [
  { id: 'overview' as const, label: 'Services' },
  { id: 'drafts' as const, label: 'Drafts' },
  { id: 'records' as const, label: 'Records' },
  { id: 'connections' as const, label: 'Connections' },
];

type Tab = (typeof TABS)[number]['id'];

/** What each role is called on screen. */
const ROLE_LABELS: Record<UniversityRole, string> = {
  student: 'Student',
  faculty: 'Professor',
  advisor: 'Advisor',
  admin: 'Administrator',
  payer: 'Authorized payer',
  staff: 'Campus staff',
};

/**
 * The areas this app already has a real screen for, and which one.
 *
 * The point of the table: a student who taps "Housing" here should land on
 * the housing screen this app actually has, not on a draft about housing.
 * Preparation is the fallback for the areas with nothing behind them, not the
 * first offer for the areas that do.
 *
 * Partial on purpose — most of the thirty-seven have no local screen, and
 * inventing one to fill the table would be worse than the gap.
 */
const LOCAL: Partial<Record<UniversityArea, { screen: Screen; label: string }>> = {
  courses: { screen: 'courses', label: 'Open courses' },
  assignments: { screen: 'work', label: 'Open assignments' },
  assessments: { screen: 'study', label: 'Open practice tools' },
  grades: { screen: 'courses', label: 'Open courses & grades' },
  email: { screen: 'mail', label: 'Open email drafts' },
  registration: { screen: 'yes', label: 'Search classes' },
  advising: { screen: 'degree', label: 'Review degree plan' },
  billing: { screen: 'costs', label: 'Open bill & aid planner' },
  aid: { screen: 'costs', label: 'Open aid planner' },
  dining: { screen: 'meals', label: 'Open meal portal' },
  housing: { screen: 'housing', label: 'Open housing portal' },
  transport: { screen: 'maps', label: 'Open campus map' },
  recreation: { screen: 'activities', label: 'Explore recreation' },
  clubs: { screen: 'activities', label: 'Open clubs' },
};

/*
 * Module-level, so `useDeviceLibrary`'s memo of the read is stable.
 *
 * Passed inline these would be new values every render, and the hook's `load`
 * — and the effect subscribing to storage events with it — would rebuild on
 * each one.
 */
const EMPTY_DRAFTS: UniversityDraft[] = [];
const readDrafts = (value: unknown) => readUniversityDrafts(JSON.stringify(value));

export function University() {
  const { state, account } = useStore();
  /*
   * Keyed by account and term, so switching either gets that term's drafts
   * rather than the last one's. Remounting is deliberate: the drafts are
   * `useState` seeded from storage, and a key change is the one thing that
   * re-seeds them.
   */
  const scope = `${account?.id || 'device'}:${state.term}`;
  return <Workspace key={scope} storageKey={`semester.university.drafts.v1:${scope}`} />;
}

function Workspace({ storageKey }: { storageKey: string }) {
  const { state, dispatch, catalog, school } = useStore();

  const [tab, setTab] = useState<Tab>('overview');
  const [intent, setIntent] = useState<UniversityRole>('student');
  const [area, setArea] = useState<UniversityArea>('courses');

  /*
   * The same store the other five device workspaces use.
   *
   * This screen used to read and write `localStorage` itself, and carried the
   * two faults that cost `device-library.ts` its rewrite: a save built on the
   * value this component last read, so another tab's draft was overwritten
   * rather than added to; and a refusal latched at mount, so a file corrupted
   * *after* the screen opened was flattened by the next keystroke rather than
   * kept. A draft here is somebody's appeal or their withdrawal letter, which
   * is the worst thing in the app to overwrite.
   *
   * `update` also reports whether the write landed. Every caller below checks
   * it before telling anybody the draft was created.
   */
  const library = useDeviceLibrary(storageKey, readDrafts, EMPTY_DRAFTS);
  const drafts = library.value;
  const setDrafts = library.update;
  const saveError = library.error;

  const [selected, setSelected] = useState('');
  const [step, setStep] = useState('');
  const [notice, setNotice] = useState('');
  const [removed, setRemoved] = useState<UniversityDraft | null>(null);

  const [status, setStatus] = useState<InstitutionStatus | null>(null);
  const [records, setRecords] = useState<UniversityRecord[]>([]);
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [fetched, setFetched] = useState('');

  const [action, setAction] = useState<{ record: UniversityRecord; action: RecordAction } | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [review, setReview] = useState<Review | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [unresolved, setUnresolved] = useState(false);

  /*
   * Which request is the current one.
   *
   * Changing area while a fetch is in flight used to let the old answer land
   * in the new area's list. Bumped on every change and checked after every
   * await, so a stale page is dropped rather than drawn.
   */
  const revision = useRef(0);

  const draft = drafts.find((d) => d.id === selected);
  const connection = status?.connections.find((c) => c.area === area);

  const patch = (fields: Partial<UniversityDraft>) =>
    setDrafts((ds) =>
      ds.map((d) => (d.id === selected ? { ...d, ...fields, updatedAt: new Date().toISOString() } : d)),
    );

  const create = (kind: UniversityArea) => {
    if (library.error) return setNotice(library.error);
    if (drafts.length >= DRAFT_LIMITS.drafts) {
      return setNotice(`Export and remove older drafts before adding more than ${DRAFT_LIMITS.drafts}.`);
    }
    const template = DRAFT_TEMPLATES[kind];
    const id = crypto.randomUUID();
    // Nothing below this line runs on a refused write: selecting a draft that
    // was never stored would open an editor bound to a draft that is not there.
    const saved = setDrafts((ds) => [
      {
        id,
        role: intent,
        area: kind,
        title: template.title,
        body: template.body,
        due: '',
        courseId: '',
        steps: template.steps.map((text) => ({ id: crypto.randomUUID(), text, done: false })),
        updatedAt: new Date().toISOString(),
      },
      ...ds,
    ]);
    if (!saved) return;
    setSelected(id);
    setArea(kind);
    setTab('drafts');
    setNotice('Draft created. It stays on this device until you export it or save a copy in Write.');
  };

  /** Everything that was about the old area, dropped together. */
  const changeArea = (next: UniversityArea) => {
    revision.current += 1;
    setArea(next);
    setRecords([]);
    setCursor(null);
    setFetched('');
    setAction(null);
    setReview(null);
    setReceipt(null);
    setValues({});
    setUnresolved(false);
    setNotice('');
  };

  const refreshStatus = async () => {
    setBusy(true);
    setNotice('');
    try {
      setStatus(await institutionStatus());
      setNotice('Connection status refreshed. Only permissions the school has verified are shown.');
    } catch (e) {
      setStatus(null);
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const load = async (more = false) => {
    const mine = (revision.current += 1);
    setBusy(true);
    setNotice('');
    try {
      const page = await institutionRecords(area, query, more ? cursor : null);
      if (mine !== revision.current) return;
      setRecords((rs) =>
        more ? [...rs, ...page.records.filter((r) => !rs.some((old) => old.id === r.id))] : page.records,
      );
      setCursor(page.nextCursor);
      setFetched(page.fetchedAt);
    } catch (e) {
      if (mine === revision.current) setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const prepare = async () => {
    if (!action) return;
    setBusy(true);
    setNotice('');
    try {
      setReview(
        await prepareInstitutionAction({
          area,
          recordId: action.record.id,
          version: action.record.version,
          actionId: action.action.id,
          fields: values,
        }),
      );
      setConfirmed(false);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /*
   * Commit, or reconcile if the last attempt's outcome was never seen.
   *
   * A failed commit sets `unresolved`, and the button then asks the gateway
   * what happened to that review rather than sending a second one. Retrying a
   * commit is how a bill gets paid twice.
   */
  const commit = async () => {
    if (!review || !confirmed) return;
    setBusy(true);
    setNotice('');
    try {
      setReceipt(await (unresolved ? reconcileInstitutionAction : commitInstitutionAction)(review.id));
      setUnresolved(false);
    } catch (e) {
      setNotice((e as Error).message);
      setUnresolved(true);
    } finally {
      setBusy(false);
    }
  };

  /**
   * The school's courses, into this app's own calendar.
   *
   * The chain the completion plan draws runs Course → Syllabus → Calendar →
   * Study, and until now the first two were on the gateway and the last two
   * were here, with nothing between them: a student enrolled in a course could
   * not see its deadlines in Today.
   *
   * This copies them in, which is a change of position and worth saying
   * plainly. School records used to be read and drawn and never kept; they are
   * kept now, in the same place the student's own imported courses live, on
   * the same terms — deletable, exportable, and theirs. A sync brings them up
   * to date rather than adding a second copy, and it does not overwrite a date
   * the student has moved; `lib/fromschool.ts` holds those rules and says why.
   *
   * What does not change: nothing is labelled official unless a receipt says
   * so, and every course and deadline this adds carries the institution's name
   * so it can never be mistaken for one of the student's own.
   */
  const bringIn = async () => {
    setBusy(true);
    setNotice('');
    try {
      const [inCourses, work] = await Promise.all([
        institutionRecords('courses', ''),
        institutionRecords('assignments', ''),
      ]);
      const courses = inCourses.records.filter((r) => !r.id.startsWith('thread:') && r.id !== 'syllabus');
      if (!courses.length) throw new Error('This school has no courses to add for you yet.');
      for (const course of courses) {
        dispatch({
          type: 'schoolCourse',
          module: schoolCourse(course, inCourses.records, work.records),
        });
      }
      setNotice(
        `${courses.length === 1 ? 'One course' : `${courses.length} courses`} added, with every ` +
          'published deadline. They are yours now — edit or delete them like any other.',
      );
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  /*
   * Ask the gateway what became of a receipt that is still pending.
   *
   * The school completes an action on its own clock, so a receipt can sit at
   * "pending" long after this screen is done with it. This asks about that
   * same review rather than sending the action again — reconciling is a read.
   */
  const recheck = async () => {
    if (!review) return;
    setBusy(true);
    setNotice('');
    try {
      setReceipt(await reconcileInstitutionAction(review.id));
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const exportDrafts = () =>
    download({
      name: 'Semester university preparation drafts.json',
      body: JSON.stringify({ version: 1, status: 'local-preparation-only', drafts }, null, 2),
      mime: 'application/json',
    });

  const areaName = (id: UniversityArea) => UNIVERSITY_AREAS.find(([x]) => x === id)?.[1] ?? id;

  return (
    <Page>
      <div style={{ fontSize: 'var(--type-base)', ...secondLine(), lineHeight: 'var(--leading-normal)' }}>
        {school.name || 'Your university'} · {state.term}
      </div>
      <div
        style={{
          fontSize: 'var(--type-base)',
          lineHeight: 'var(--leading-normal)',
          marginBlock: 'var(--sp-4)',
          textWrap: 'pretty',
        }}
      >
        Coursework, advising, records and campus services in one place. Plans and drafts work now.
        Official records, submissions and payments need a connection your school has approved —{' '}
        {status ? 'and this account has one.' : 'and none is configured yet.'}
      </div>

      <Segmented
        options={TABS.map((t) => ({
          id: t.id,
          label: t.id === 'drafts' ? `${t.label} (${drafts.length})` : t.label,
        }))}
        value={tab}
        onChange={setTab}
        style={{ marginBlock: 'var(--sp-5)' }}
      />

      {(notice || saveError) && (
        <Notice>
          {saveError || notice}
          {library.error && (
            <ActionButton
              onClick={() =>
                download({
                  name: 'Semester draft recovery.json',
                  body: localStorage.getItem(storageKey) || '[]',
                  mime: 'application/json',
                })
              }
              style={{ marginTop: 'var(--sp-4)' }}
            >
              Download recovery copy
            </ActionButton>
          )}
          {removed && (
            <ActionButton
              onClick={() => {
                if (drafts.length >= DRAFT_LIMITS.drafts) return;
                setDrafts((ds) => [removed, ...ds]);
                setRemoved(null);
                setNotice('Draft restored.');
              }}
              style={{ marginTop: 'var(--sp-4)' }}
            >
              Undo removal
            </ActionButton>
          )}
        </Notice>
      )}

      {tab === 'overview' && (
        <>
          <label style={{ display: 'block', marginBlock: 'var(--sp-5) var(--sp-3)' }}>
            <SectionLabel style={{ marginBlock: 0 }}>Prepare drafts as</SectionLabel>
            <select
              className="input"
              value={intent}
              onChange={(e) => setIntent(e.target.value as UniversityRole)}
              style={{ marginTop: 'var(--sp-3)', width: '100%' }}
            >
              {UNIVERSITY_ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABELS[r]}
                </option>
              ))}
            </select>
          </label>
          <p
            style={{
              fontSize: 'var(--type-sm)',
              ...secondLine(),
              lineHeight: 'var(--leading-normal)',
              marginBlock: 0,
              textWrap: 'pretty',
            }}
          >
            This picks which template a new draft starts from. It grants you nothing — the roles your
            school has actually verified appear under Connections.
          </p>

          <SectionLabel
            aside={`${UNIVERSITY_AREAS.length} areas`}
            style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}
          >
            Every service
          </SectionLabel>
          <CardGrid min={150}>
            {/*
              Not dimmed, and that is a correction rather than an oversight.
              Dimming every area that is not connected greys all thirty-seven
              — which is the true state of the *connections* and a lie about
              the screen, because nearly all of them do have something behind
              them: a local screen that already works, or a draft to start.
              `dim` in `GridCard` means "nothing here", and here there is
              something. The line under each name carries the distinction, and
              the hero above already says how many are connected.
            */}
            {UNIVERSITY_AREAS.map(([id, name]) => {
              const connected = status?.connections.find((c) => c.area === id)?.state === 'connected';
              return (
                <GridCard
                  key={id}
                  label={name}
                  meta={connected ? 'Connected' : LOCAL[id] ? 'Opens here' : 'Prepare only'}
                  selected={id === area}
                  title={DRAFT_TEMPLATES[id].steps.join(' · ')}
                  onClick={() => {
                    changeArea(id);
                    setArea(id);
                  }}
                />
              );
            })}
          </CardGrid>

          <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}>
            {areaName(area)}
          </SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
            {LOCAL[area] && (
              <ActionButton
                tone="primary"
                onClick={() => dispatch({ type: 'go', screen: LOCAL[area]!.screen })}
                style={{ flex: '1 1 auto' }}
              >
                {LOCAL[area]!.label}
              </ActionButton>
            )}
            {area === 'courses' && (
              <ActionButton
                disabled={busy || !status}
                onClick={() => void bringIn()}
                style={{ flex: '1 1 auto' }}
              >
                Add my courses to this app
              </ActionButton>
            )}
            <ActionButton onClick={() => create(area)} style={{ flex: '1 1 auto' }}>
              Prepare a draft
            </ActionButton>
          </div>
          <p
            style={{
              fontSize: 'var(--type-sm)',
              ...secondLine(),
              lineHeight: 'var(--leading-normal)',
              marginBlock: 'var(--sp-5)',
              textWrap: 'pretty',
            }}
          >
            Health and safety drafts are for routine preparation. Use your institution's emergency
            channel for anything urgent, and keep medical, payment-card and other sensitive records in
            the service your school approved for them.
          </p>
        </>
      )}

      {tab === 'drafts' && (
        <>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBlock: 'var(--sp-5)' }}>
            <ActionButton tone="primary" onClick={() => create(area)} style={{ flex: '1 1 auto' }}>
              New draft
            </ActionButton>
            <ActionButton disabled={!drafts.length} onClick={exportDrafts} style={{ flex: '1 1 auto' }}>
              Export
            </ActionButton>
          </div>
          <FilePick
            accept=".json"
            multiple={false}
            onPick={async (files) => {
              try {
                if (library.error) throw new Error(library.error);
                const file = files[0];
                if (!file) return;
                if (file.size > 1_600_000) throw new Error('Choose a draft export smaller than 1.6 MB.');
                const incoming = readUniversityDrafts(await file.text());
                if (incoming.length + drafts.length > DRAFT_LIMITS.drafts) {
                  throw new Error(`Keep at most ${DRAFT_LIMITS.drafts} drafts.`);
                }
                setDrafts((ds) => [...incoming.map((d) => ({ ...d, id: crypto.randomUUID() })), ...ds]);
                setNotice(`${incoming.length} drafts imported as new copies.`);
              } catch (e) {
                setNotice((e as Error).message);
              }
            }}
          >
            Import drafts
          </FilePick>

          <SectionLabel
            aside={`${drafts.length} on this device`}
            style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}
          >
            Saved here
          </SectionLabel>
          {drafts.length === 0 ? (
            <p
              style={{
                fontSize: 'var(--type-base)',
                ...secondLine(),
                lineHeight: 'var(--leading-normal)',
                textWrap: 'pretty',
              }}
            >
              No drafts yet. Start one from a service above — the questions worth having written down
              before an advising appointment, or the checklist before a form is filed.
            </p>
          ) : (
            <CardGrid min={150}>
              {drafts.map((d) => (
                <GridCard
                  key={d.id}
                  label={d.title || 'Untitled draft'}
                  meta={`${ROLE_LABELS[d.role]} · ${areaName(d.area)}`}
                  selected={d.id === selected}
                  onClick={() => {
                    setSelected(d.id);
                    setArea(d.area);
                    setIntent(d.role);
                    setStep('');
                  }}
                />
              ))}
            </CardGrid>
          )}

          {draft && (
            <>
              <SectionLabel
                aside="Not submitted"
                style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}
              >
                {ROLE_LABELS[draft.role]} preparation
              </SectionLabel>
              <label style={{ display: 'block', marginBottom: 'var(--sp-5)' }}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Title</span>
                <input
                  className="input"
                  value={draft.title}
                  maxLength={DRAFT_LIMITS.title}
                  onChange={(e) => patch({ title: e.target.value })}
                  style={{ width: '100%', marginTop: 'var(--sp-2)' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 'var(--sp-5)' }}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Course (optional)</span>
                <select
                  className="input"
                  value={draft.courseId}
                  onChange={(e) => patch({ courseId: e.target.value })}
                  style={{ width: '100%', marginTop: 'var(--sp-2)' }}
                >
                  <option value="">No course</option>
                  {catalog.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.code}
                    </option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'block', marginBottom: 'var(--sp-5)' }}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Target date</span>
                <input
                  className="input"
                  type="date"
                  value={draft.due}
                  onChange={(e) => patch({ due: e.target.value })}
                  style={{ width: '100%', marginTop: 'var(--sp-2)' }}
                />
              </label>
              <label style={{ display: 'block', marginBottom: 'var(--sp-5)' }}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Preparation notes</span>
                <textarea
                  className="input"
                  rows={12}
                  maxLength={DRAFT_LIMITS.body}
                  value={draft.body}
                  onChange={(e) => patch({ body: e.target.value })}
                  style={{ width: '100%', marginTop: 'var(--sp-2)' }}
                />
              </label>

              <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-4)' }}>
                Readiness checklist
              </SectionLabel>
              {draft.steps.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-4)',
                    paddingBlock: 'var(--sp-3)',
                    borderBottom: '1px solid var(--app-line)',
                  }}
                >
                  <input
                    type="checkbox"
                    aria-label={s.text}
                    checked={s.done}
                    onChange={(e) =>
                      patch({
                        steps: draft.steps.map((x) => (x.id === s.id ? { ...x, done: e.target.checked } : x)),
                      })
                    }
                  />
                  <span style={{ flex: 1, fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)' }}>
                    {s.text}
                  </span>
                  <button
                    type="button"
                    className="bare tappable"
                    aria-label={`Remove step: ${s.text}`}
                    onClick={() => patch({ steps: draft.steps.filter((x) => x.id !== s.id) })}
                    style={{ ...secondLine() }}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!step.trim() || draft.steps.length >= DRAFT_LIMITS.steps) return;
                  patch({ steps: [...draft.steps, { id: crypto.randomUUID(), text: step.trim(), done: false }] });
                  setStep('');
                }}
                style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}
              >
                <input
                  className="input"
                  aria-label="New readiness step"
                  value={step}
                  maxLength={DRAFT_LIMITS.stepText}
                  onChange={(e) => setStep(e.target.value)}
                  placeholder="Add a preparation step"
                  style={{ flex: 1 }}
                />
                <button
                  type="submit"
                  className="btn btn-secondary"
                  disabled={!step.trim() || draft.steps.length >= DRAFT_LIMITS.steps}
                >
                  Add
                </button>
              </form>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
                <ActionButton
                  onClick={() =>
                    dispatch({
                      type: 'makeDocument',
                      open: true,
                      doc: {
                        title: draft.title,
                        subtitle: 'University preparation · Not submitted',
                        courseId: draft.courseId || null,
                        blocks: fromMarkdown(draft.body),
                      },
                    })
                  }
                  style={{ flex: '1 1 auto' }}
                >
                  Save a copy in Write
                </ActionButton>
                <ActionButton
                  onClick={() => {
                    setRemoved(draft);
                    setDrafts((ds) => ds.filter((d) => d.id !== selected));
                    setSelected('');
                    setNotice('Draft removed. You can undo this.');
                  }}
                  style={{ flex: '1 1 auto' }}
                >
                  Remove draft
                </ActionButton>
              </div>
              <p
                style={{
                  fontSize: 'var(--type-sm)',
                  ...secondLine(),
                  lineHeight: 'var(--leading-normal)',
                  marginBlock: 'var(--sp-5)',
                  textWrap: 'pretty',
                }}
              >
                Saved {new Date(draft.updatedAt).toLocaleString()} on this device. A ticked checklist
                describes your preparation, never official completion.
              </p>
            </>
          )}
        </>
      )}

      {tab === 'records' && (
        <>
          <label style={{ display: 'block', marginBlock: 'var(--sp-5) var(--sp-4)' }}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Service</span>
            <select
              className="input"
              disabled={busy}
              value={area}
              onChange={(e) => changeArea(e.target.value as UniversityArea)}
              style={{ width: '100%', marginTop: 'var(--sp-2)' }}
            >
              {UNIVERSITY_AREAS.map(([id, name]) => (
                <option key={id} value={id}>
                  {name}
                </option>
              ))}
            </select>
          </label>

          {!connection?.canRead ? (
            <div
              style={{
                border: '1px solid var(--app-line)',
                borderRadius: 'var(--r-md)',
                padding: 'var(--sp-7)',
                textWrap: 'pretty',
              }}
            >
              <SectionLabel style={{ marginBlock: 0 }}>Not connected</SectionLabel>
              <p
                style={{
                  fontSize: 'var(--type-base)',
                  ...secondLine(),
                  lineHeight: 'var(--leading-normal)',
                  marginBlock: 'var(--sp-4) var(--sp-5)',
                }}
              >
                Your school's {areaName(area).toLowerCase()} records will appear here once it enables
                this service. Everything you have already — courses, deadlines, material and drafts —
                is unaffected.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
                <ActionButton onClick={() => setTab('connections')} style={{ flex: '1 1 auto' }}>
                  School connections
                </ActionButton>
                <ActionButton tone="primary" onClick={() => create(area)} style={{ flex: '1 1 auto' }}>
                  Prepare a draft
                </ActionButton>
              </div>
            </div>
          ) : (
            <>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void load();
                }}
                style={{ display: 'flex', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}
              >
                <input
                  className="input"
                  aria-label="Search connected university records"
                  placeholder="Search school records"
                  value={query}
                  maxLength={200}
                  onChange={(e) => setQuery(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-secondary" disabled={busy}>
                  {busy ? 'Loading…' : 'Refresh'}
                </button>
              </form>
              <p style={{ fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' }}>
                {fetched ? `Fetched ${new Date(fetched).toLocaleString()}` : 'Refresh to load records.'} ·
                Read from your school, never copied into local drafts.
              </p>
              {records.map((r) => (
                <section
                  key={r.id}
                  style={{
                    border: '1px solid var(--app-line)',
                    borderRadius: 'var(--r-md)',
                    padding: 'var(--sp-5)',
                    marginBlock: 'var(--sp-4)',
                  }}
                >
                  <SectionLabel aside={r.status} style={{ marginBlock: 0 }}>
                    {r.title}
                  </SectionLabel>
                  <p
                    style={{
                      fontSize: 'var(--type-base)',
                      lineHeight: 'var(--leading-normal)',
                      marginBlock: 'var(--sp-4)',
                    }}
                  >
                    {r.summary}
                  </p>
                  {r.details.map((d, i) => (
                    <div key={i} style={{ fontSize: 'var(--type-sm)', marginBottom: 'var(--sp-3)' }}>
                      <span style={secondLine()}>{d.label}: </span>
                      <span>{d.value}</span>
                    </div>
                  ))}
                  {connection.canWrite &&
                    r.actions.map((a) => (
                      <ActionButton
                        key={a.id}
                        disabled={busy}
                        onClick={() => {
                          setAction({ record: r, action: a });
                          setValues({});
                          setReview(null);
                          setReceipt(null);
                          setConfirmed(false);
                          setUnresolved(false);
                        }}
                        style={{ marginTop: 'var(--sp-4)' }}
                      >
                        {a.label}
                      </ActionButton>
                    ))}
                </section>
              ))}
              {fetched && !records.length && (
                <p style={{ fontSize: 'var(--type-base)', ...secondLine() }}>No matching records.</p>
              )}
              {cursor && (
                <ActionButton disabled={busy} onClick={() => void load(true)}>
                  Load more
                </ActionButton>
              )}
            </>
          )}

          {action && (
            <section
              style={{
                border: '1px solid var(--app-accent)',
                borderRadius: 'var(--r-md)',
                padding: 'var(--sp-5)',
                marginTop: 'var(--sp-6)',
              }}
            >
              <SectionLabel style={{ marginBlock: 0 }}>
                {action.action.label} · {action.record.title}
              </SectionLabel>

              {receipt ? (
                <p
                  role="status"
                  style={{
                    fontSize: 'var(--type-base)',
                    lineHeight: 'var(--leading-normal)',
                    marginBlock: 'var(--sp-4)',
                  }}
                >
                  {receipt.message} ·{' '}
                  {receipt.status === 'pending' ? 'Awaiting official completion' : 'Completed'} · Receipt{' '}
                  {receipt.id}
                  {receipt.status === 'pending' && (
                    <>
                      {' '}
                      <ActionButton disabled={busy} onClick={() => void recheck()}>
                        Recheck this action
                      </ActionButton>
                    </>
                  )}
                </p>
              ) : review ? (
                <>
                  <p
                    style={{
                      fontSize: 'var(--type-base)',
                      lineHeight: 'var(--leading-normal)',
                      marginBlock: 'var(--sp-4)',
                    }}
                  >
                    {review.title}
                  </p>
                  {review.details.map((d, i) => (
                    <div key={i} style={{ fontSize: 'var(--type-sm)', marginBottom: 'var(--sp-3)' }}>
                      <span style={secondLine()}>{d.label}: </span>
                      <span>{d.value}</span>
                    </div>
                  ))}
                  <p style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>
                    This review expires at {new Date(review.expiresAt).toLocaleTimeString()}.
                  </p>
                  {unresolved && (
                    <p
                      style={{
                        fontSize: 'var(--type-sm)',
                        lineHeight: 'var(--leading-normal)',
                        marginBlock: 'var(--sp-4)',
                        textWrap: 'pretty',
                      }}
                    >
                      The last attempt did not report back. Recheck this same review — do not send a
                      second one.
                    </p>
                  )}
                  <label
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 'var(--sp-4)',
                      marginBlock: 'var(--sp-5)',
                      fontSize: 'var(--type-base)',
                      lineHeight: 'var(--leading-normal)',
                    }}
                  >
                    <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
                    <span>I have reviewed these details and want to perform this official action.</span>
                  </label>
                  <ActionButton tone="primary" disabled={busy || !confirmed} onClick={() => void commit()}>
                    {unresolved ? 'Recheck this action' : 'Confirm official action'}
                  </ActionButton>
                </>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void prepare();
                  }}
                >
                  <fieldset disabled={busy} style={{ border: 0, padding: 0, minWidth: 0 }}>
                    {action.action.fields.map((f) => (
                      <label key={f.id} style={{ display: 'block', marginBlock: 'var(--sp-4)' }}>
                        <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>{f.label}</span>
                        {f.kind === 'textarea' ? (
                          <textarea
                            className="input"
                            required={f.required}
                            maxLength={20_000}
                            value={values[f.id] || ''}
                            onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                            style={{ width: '100%', marginTop: 'var(--sp-2)' }}
                          />
                        ) : f.kind === 'select' ? (
                          <select
                            className="input"
                            required={f.required}
                            value={values[f.id] || ''}
                            onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                            style={{ width: '100%', marginTop: 'var(--sp-2)' }}
                          >
                            <option value="">Choose…</option>
                            {f.options?.map((o) => (
                              <option key={o}>{o}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            className="input"
                            type={f.kind}
                            required={f.required}
                            maxLength={20_000}
                            value={values[f.id] || ''}
                            onChange={(e) => setValues((v) => ({ ...v, [f.id]: e.target.value }))}
                            style={{ width: '100%', marginTop: 'var(--sp-2)' }}
                          />
                        )}
                      </label>
                    ))}
                  </fieldset>
                  {/*
                    A real submit button, not `ActionButton`: that one fixes
                    `type="button"` so it can never accidentally submit a form
                    it sits inside. Here submitting is the point — Enter in any
                    field should reach the review step.
                  */}
                  <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
                    Review before sending
                  </button>
                </form>
              )}

              <ActionButton
                disabled={busy}
                onClick={() => {
                  setAction(null);
                  setReview(null);
                  setReceipt(null);
                }}
                style={{ marginTop: 'var(--sp-4)' }}
              >
                Close
              </ActionButton>
            </section>
          )}
        </>
      )}

      {tab === 'connections' && (
        <>
          <p
            style={{
              fontSize: 'var(--type-base)',
              lineHeight: 'var(--leading-normal)',
              marginBlock: 'var(--sp-5)',
              textWrap: 'pretty',
            }}
          >
            {gatewayConfigured
              ? 'A gateway address is configured. Check your school access to see which services it has made available.'
              : 'This build is ready for a university gateway, and none is configured. Your school deploys an approved adapter and assigns access before any official service can work here.'}
          </p>
          <ActionButton
            tone="primary"
            disabled={!gatewayConfigured || busy}
            onClick={() => void refreshStatus()}
          >
            {busy ? 'Checking…' : 'Check school access'}
          </ActionButton>

          {status && (
            <p
              style={{
                fontSize: 'var(--type-base)',
                lineHeight: 'var(--leading-normal)',
                marginBlock: 'var(--sp-5)',
              }}
            >
              {status.institutionName} · Verified roles:{' '}
              {status.roles.map((r) => ROLE_LABELS[r]).join(', ') || 'none'}
            </p>
          )}

          <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}>Every service</SectionLabel>
          {UNIVERSITY_AREAS.map(([id, label]) => {
            const c = status?.connections.find((x) => x.area === id);
            const access = !c
              ? 'Awaiting school setup'
              : c.state !== 'connected'
                ? c.state
                : c.canWrite
                  ? 'Read and supported actions'
                  : c.canRead
                    ? 'Read only'
                    : 'No access';
            return (
              <div
                key={id}
                style={{
                  paddingBlock: 'var(--sp-4)',
                  borderBottom: '1px solid var(--app-line)',
                  fontSize: 'var(--type-base)',
                  lineHeight: 'var(--leading-normal)',
                }}
              >
                <div>{label}</div>
                <div style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>
                  {access}
                  {c?.lastSyncAt ? ` · Last sync ${new Date(c.lastSyncAt).toLocaleString()}` : ''}
                </div>
              </div>
            );
          })}

          <p
            style={{
              fontSize: 'var(--type-sm)',
              ...secondLine(),
              lineHeight: 'var(--leading-normal)',
              marginBlock: 'var(--sp-6)',
              textWrap: 'pretty',
            }}
          >
            Your school configures the identity provider, the adapters for each service, and the role,
            consent, retention and audit policy behind them. School credentials stay on the gateway
            server — a role chosen on this device cannot grant any of it.
          </p>
        </>
      )}
    </Page>
  );
}
