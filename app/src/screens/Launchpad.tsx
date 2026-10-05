import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { SectionLabel, TabList } from '../components/ui';
import { Card, Checklist, GoTo, Never, OfficeDoor } from '../components/JourneyKit';
import { MentorFinder } from '../components/MentorFinder';
import { useDeviceLibrary } from '../lib/device-library';
import { creditHoursOr0 } from '../lib/credits';
import { hasMode } from '../lib/accessmode';
import { forRole } from '../lib/role';
import {
  EMPTY_LAUNCHPAD,
  EXPLAINERS,
  GLOSSARY,
  MENTOR_INTERESTS,
  REFLECTION_PROMPTS,
  STAGES,
  STUDENT_TYPES,
  SUPPORTER_TOPICS,
  openSteps,
  progress,
  readLaunchpad,
  semesterPreview,
  stepsFor,
  type LaunchpadLibrary,
  type Stage,
  type StudentType,
} from '../lib/launchpad';

/**
 * Admission to week five, as one list the student keeps.
 *
 * See `lib/launchpad.ts` for why stages are chosen rather than inferred, why a
 * student type only ever adds steps, and why ticking a step here tells no
 * office anything. The screen's job is to say those things where they matter:
 * beside the stage picker, and on every step an office decides.
 */

const TABS = [
  { id: 'steps' as const, label: 'Checklist' },
  { id: 'term' as const, label: 'First term' },
  { id: 'words' as const, label: 'Campus words' },
  { id: 'people' as const, label: 'Mentors & family' },
  { id: 'reflect' as const, label: 'Look back' },
];

type Tab = (typeof TABS)[number]['id'];

export function Launchpad() {
  const { account } = useStore();
  return <Workspace key={account?.id || 'device'} storageKey={`semester.launchpad.v1:${account?.id || 'device'}`} />;
}

function Workspace({ storageKey }: { storageKey: string }) {
  const { state } = useStore();
  const lib = useDeviceLibrary(storageKey, readLaunchpad, EMPTY_LAUNCHPAD);
  const [tab, setTab] = useState<Tab>('steps');
  const set = (patch: Partial<LaunchpadLibrary>) => lib.update((old) => ({ ...old, ...patch }));
  const chunk = hasMode(state.access, 'chunk');
  const plain = hasMode(state.access, 'plain');

  return (
    <Page blurb="Everything between the offer and the fifth week of term, in the order it usually falls. A list you keep — ticking a step here tells no office anything.">
      <TabList label="Launchpad" className="portal-tabs" value={tab} onChange={setTab} tabs={TABS} />
      {lib.error ? <p className="jx-warn" role="alert">{lib.error}</p> : null}
      {tab === 'steps' ? <Steps lib={lib.value} set={set} chunk={chunk} /> : null}
      {tab === 'term' ? <FirstTerm /> : null}
      {tab === 'words' ? <Words plain={plain} /> : null}
      {tab === 'people' ? <Supporters lib={lib.value} set={set} /> : null}
      {tab === 'reflect' ? <Reflect lib={lib.value} set={set} /> : null}
    </Page>
  );
}

function Steps({ lib, set, chunk }: { lib: LaunchpadLibrary; set: (p: Partial<LaunchpadLibrary>) => void; chunk: boolean }) {
  const { state } = useStore();
  const steps = useMemo(() => stepsFor(lib.types), [lib.types]);
  const p = progress(steps, lib.stage, lib.done);
  const open = openSteps(steps, lib.stage, lib.done);
  const at = STAGES.findIndex((s) => s.id === lib.stage);

  const toggleType = (t: StudentType) => {
    const on = lib.types.includes(t) ? lib.types.filter((x) => x !== t) : [...lib.types, t];
    set({ types: on.length ? on : ['first-year'] });
  };
  const toggleStep = (id: string) => {
    const done = { ...lib.done };
    if (done[id]) delete done[id];
    else done[id] = new Date().toISOString().slice(0, 10);
    set({ done });
  };

  return (
    <>
      <Card kicker="Where you are" title={`${p.done} of ${p.of} done so far`}>
        <div className="jx-chips" role="radiogroup" aria-label="Where you are">
          {STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              role="radio"
              aria-checked={lib.stage === s.id}
              className={`jx-chip${lib.stage === s.id ? ' jx-chip-on' : ''}`}
              onClick={() => set({ stage: s.id as Stage })}
            >
              {s.label}
            </button>
          ))}
        </div>
        <p className="jx-muted">
          {STAGES[at]?.says} You choose this — it is not read from any school system, and a school-verified account is a separate thing your school sets when it connects.
        </p>
      </Card>

      <SectionLabel>You are a…</SectionLabel>
      <div className="jx-chips" role="group" aria-label="Student type">
        {STUDENT_TYPES.map((t) => (
          <button
            key={t.id}
            type="button"
            aria-pressed={lib.types.includes(t.id)}
            className={`jx-chip${lib.types.includes(t.id) ? ' jx-chip-on' : ''}`}
            onClick={() => toggleType(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <p className="jx-muted">Choosing a type adds the steps it needs. Nothing is taken away, and this is never sent anywhere.</p>

      {STAGES.slice(0, at + 1).map((stage) => {
        const here = steps.filter((s) => s.stage === stage.id);
        if (!here.length) return null;
        return (
          <div key={stage.id}>
            <SectionLabel>{stage.label}</SectionLabel>
            <Checklist
              label={`${stage.label} steps`}
              oneAtATime={chunk}
              done={(id) => Boolean(lib.done[id])}
              onToggle={toggleStep}
              items={here.map((s) => ({
                id: s.id,
                title: s.title,
                detail: (
                  <>
                    {s.detail}
                    {s.office ? <OfficeDoor office={s.office} compact /> : null}
                    {s.screen && forRole(s.screen, state.role) ? <GoTo screen={s.screen}>Work on it here</GoTo> : null}
                  </>
                ),
              }))}
            />
          </div>
        );
      })}

      {!open.length ? <p className="jx-muted">Nothing open for this stage. Move to the next one when you get there.</p> : null}
    </>
  );
}

function FirstTerm() {
  const { catalog, state } = useStore();
  const [typed, setTyped] = useState('15');
  const credits = catalog.courses.length
    ? catalog.courses.map((c) => creditHoursOr0(c.credits))
    : [Number(typed) || 0];
  const v = semesterPreview(credits);
  return (
    <>
      <Card kicker="An estimate, not a schedule" title={`About ${v.total} hours a week`}>
        <p>
          {v.inClass} in class and about {v.outside} outside it
          {catalog.courses.length ? `, across your ${v.courses} courses.` : '.'}
        </p>
        {!catalog.courses.length ? (
          <label className="jx-field">
            <span>Credits you expect to take</span>
            <input className="input" inputMode="numeric" value={typed} onChange={(e) => setTyped(e.target.value)} aria-label="Credits you expect to take" />
          </label>
        ) : null}
        <p className="jx-muted">
          Two hours outside class for each credit is a convention many catalogs state. It varies by course and by person — it is here so fifteen credits does not read as fifteen hours.
        </p>
        {forRole('yes', state.role) ? <GoTo screen="yes">Plan first-term courses</GoTo> : null}
      </Card>
      {EXPLAINERS.map((e) => (
        <Card key={e.id} title={e.title}>
          <p>{e.body}</p>
        </Card>
      ))}
    </>
  );
}

function Words({ plain }: { plain: boolean }) {
  const [q, setQ] = useState('');
  const shown = GLOSSARY.filter((g) => (g.term + g.plain).toLowerCase().includes(q.trim().toLowerCase()));
  return (
    <>
      <input className="input jx-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a word" aria-label="Find a campus word" />
      <dl className="jx-glossary">
        {shown.map((g) =>
          plain ? (
            <div key={g.term}>
              <dd>{g.plain}</dd>
              <dt>{g.term}</dt>
            </div>
          ) : (
            <div key={g.term}>
              <dt>{g.term}</dt>
              <dd>{g.plain}</dd>
            </div>
          ),
        )}
      </dl>
      {!shown.length ? <p className="jx-muted">No word matches. Ask the care network if a term in an email makes no sense.</p> : null}
    </>
  );
}

function Supporters({ lib, set }: { lib: LaunchpadLibrary; set: (p: Partial<LaunchpadLibrary>) => void }) {
  const toggleInterest = (i: string) =>
    set({ interests: lib.interests.includes(i) ? lib.interests.filter((x) => x !== i) : [...lib.interests, i] });
  return (
    <>
      <Card kicker="Peer mentors" title="Someone a year or two ahead">
        <label className="jx-check">
          <input type="checkbox" checked={lib.mentorOptIn} onChange={() => set({ mentorOptIn: !lib.mentorOptIn })} aria-label="I would like a peer mentor" />
          <span className="jx-check-body">
            <span className="jx-check-title">I would like a peer mentor</span>
            <span className="jx-check-detail">Off unless you turn it on.</span>
          </span>
        </label>
        {lib.mentorOptIn ? (
          <>
            <p className="jx-muted">What would you like to talk about? A match uses only what you tick here — nothing about how you use the app.</p>
            <div className="jx-chips" role="group" aria-label="Mentor interests">
              {MENTOR_INTERESTS.map((i) => (
                <button key={i} type="button" aria-pressed={lib.interests.includes(i)} className={`jx-chip${lib.interests.includes(i) ? ' jx-chip-on' : ''}`} onClick={() => toggleInterest(i)}>
                  {i}
                </button>
              ))}
            </div>
            <MentorFinder
              kind="peer"
              interests={lib.interests}
              types={lib.types}
              fallback={
                <p className="jx-muted">
                  Your school has not connected a mentor program yet. When it does, a match is proposed to both of you, and contact happens only through the program once you both accept — never by sharing personal accounts.
                </p>
              }
            />
          </>
        ) : null}
      </Card>

      <Card kicker="For parents and supporters" title="What they can know without your records">
        {SUPPORTER_TOPICS.map((t) => (
          <p key={t.title}>
            <strong>{t.title}.</strong> {t.body}
          </p>
        ))}
        <p className="jx-muted">A supporter sees nothing of yours by default. If you want to share something, you choose item by item.</p>
        <GoTo screen="family">Choose what to share</GoTo>
      </Card>
      <Never
        items={[
          'Supporters have no access to your records unless you grant it, item by item.',
          'Mentor matching never uses your grades, your activity or anything you did not tick.',
          'No personal contact details are exchanged through Semester.',
        ]}
      />
      <OfficeDoor office="orientation" />
    </>
  );
}

function Reflect({ lib, set }: { lib: LaunchpadLibrary; set: (p: Partial<LaunchpadLibrary>) => void }) {
  return (
    <>
      <p className="jx-muted">Private to this device. Never scored, never sent, and nobody is told you wrote anything.</p>
      {REFLECTION_PROMPTS.map((p) => (
        <label key={p.id} className="jx-field">
          <span>{p.prompt}</span>
          <textarea
            className="input jx-area"
            value={lib.reflection[p.id] ?? ''}
            aria-label={p.prompt}
            onChange={(e) => set({ reflection: { ...lib.reflection, [p.id]: e.target.value } })}
          />
        </label>
      ))}
      <GoTo screen="support">If something is hard, start here</GoTo>
    </>
  );
}
