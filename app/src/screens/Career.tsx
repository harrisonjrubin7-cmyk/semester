import { useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { ActionButton, FilePick, Notice, SectionLabel, Segmented } from '../components/ui';
import { Group, NavRow } from '../components/shell/Rows';
import { CardGrid, GridCard } from '../components/GridCard';
import { secondLine } from '../lib/dim';
import { useDeviceLibrary } from '../lib/device-library';
import {
  ABROAD_STEPS,
  CAREER_LIMITS,
  CONTACT_PERMISSIONS,
  EMPTY_CAREER,
  EXPERIENCE_TYPES,
  OPPORTUNITY_FORMATS,
  OPPORTUNITY_KINDS,
  coverLetter,
  newOpportunity,
  readCareer,
  readOpportunities,
  resumeMarkdown,
  type CareerContact,
  type CareerExperience,
  type Opportunity,
} from '../lib/career';
import { fromMarkdown } from '../lib/document';
import { download } from '../lib/deliver';
import { LIVE, safeUrl, type ApplyKind } from '../lib/apply';

/**
 * What is open, what you have done, and who you have spoken to.
 *
 * Three things that are usually three products, in one place because for a
 * student they are one job — and because the middle one is the evidence the
 * other two are built from. The cover letter opens with real recorded
 * experience rather than a blank page; a networking note turns into a
 * follow-up task in the same list as everything else.
 *
 * ## Nothing here is a real listing until somebody puts one in
 *
 * There is no job board behind this. Every opportunity was typed in or
 * imported from a file, and the screen says so on the detail panel rather
 * than letting a tidy card imply otherwise. An imported listing is somebody's
 * spreadsheet, not a verified posting, and the link goes to the official
 * source so a student checks it there.
 *
 * ## Applications live in the tracker that already exists
 *
 * "Track it" hands an opportunity to `screens/Applying.tsx` — the app's own
 * tracker — and says plainly that nothing was submitted. Two trackers, one of
 * which is nearly the other, is how a student ends up with half their
 * deadlines in each, and that reasoning is why there has only ever been one.
 *
 * ## …and they live there only
 *
 * This screen used to render that tracker inline, as an Applications tab. The
 * data was never duplicated — the tab and the screen both read
 * `state.applications` — but the *home* was: pressing Career → Applications
 * and opening Applications landed on the identical body, so a student had to
 * know which one you meant. That is the shape `lib/onehome.test.ts` was
 * written for after Today's Report tab and Courses' Grades tab, and the rule
 * it states applies here unchanged: a destination is what the directory, the
 * search box and the tab bar point at, and a tab cannot be any of those.
 *
 * It also nested two `<Page>` frames, since `Applying` opens one and this
 * screen wraps it in another — doubled padding and doubled trailing space,
 * which is exactly what the warning in `components/Page.tsx` describes. The
 * embed had no `bare` prop, which is why the guard did not catch it; the test
 * now checks for the destination itself rather than for the escape hatch.
 *
 * What is left is the hand-off, which is the part that was always worth
 * having: the row below opens the tracker, with the number of live
 * applications on it so the answer is there without opening anything.
 *
 * ## Contacts record permission
 *
 * A networking note carries whether the person has actually agreed to
 * connect. It exists so that a list of people does not quietly become a list
 * of people who never agreed to be on one.
 */

const TABS = [
  { id: 'discover' as const, label: 'Discover' },
  { id: 'resume' as const, label: 'Résumé' },
  { id: 'network' as const, label: 'Contacts' },
  { id: 'abroad' as const, label: 'Abroad' },
  { id: 'library' as const, label: 'Library' },
];

type Tab = (typeof TABS)[number]['id'];

/** What each opportunity field is called on screen. */
const FIELD_LABELS: Record<string, string> = {
  title: 'Position or program',
  organization: 'Employer or university',
  location: 'Location',
  compensation: 'Compensation, as listed',
  skills: 'Skills or subjects',
  country: 'Country',
  term: 'Term or season',
  cost: 'Estimated cost, as listed',
  credit: 'Credit information',
};

/** An opportunity kind, as the application tracker names the same thing. */
const APPLY_KIND: Record<Opportunity['kind'], ApplyKind> = {
  Internship: 'internship',
  Job: 'job',
  'Campus employment': 'job',
  Research: 'research',
  Fellowship: 'fellowship',
  'Study abroad': 'program',
  'Career event': 'other',
};

export function Career() {
  const { state, account } = useStore();
  const scope = `${account?.id || 'device'}:${state.term}`;
  return <Workspace key={scope} storageKey={`semester.career.v1:${scope}`} />;
}

function Workspace({ storageKey }: { storageKey: string }) {
  const { state, dispatch } = useStore();
  const lib = useDeviceLibrary(storageKey, readCareer, EMPTY_CAREER);

  const [tab, setTab] = useState<Tab>('discover');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState('All types');
  const [format, setFormat] = useState('All formats');
  const [savedOnly, setSavedOnly] = useState(false);
  const [selected, setSelected] = useState('');
  const [edit, setEdit] = useState<Opportunity | null>(null);
  const [experience, setExperience] = useState<CareerExperience | null>(null);
  const [person, setPerson] = useState<CareerContact | null>(null);
  const [notice, setNotice] = useState('');

  const open = lib.value.opportunities.find((o) => o.id === selected);
  const matches = lib.value.opportunities
    .filter(
      (o) =>
        (!savedOnly || o.saved) &&
        (kind === 'All types' || o.kind === kind) &&
        (format === 'All formats' || o.format === format) &&
        `${o.title} ${o.organization} ${o.location} ${o.skills} ${o.country} ${o.term}`
          .toLowerCase()
          .includes(query.toLowerCase()),
    )
    .sort((a, b) => (a.deadline || '9999').localeCompare(b.deadline || '9999'));

  const write = (title: string, body: string) =>
    dispatch({
      type: 'makeDocument',
      open: true,
      doc: { title, subtitle: 'Career draft · Review before sending', courseId: null, blocks: fromMarkdown(body) },
    });

  const saveOpportunity = () => {
    if (!edit) return;
    const next = { ...lib.value, opportunities: [...lib.value.opportunities.filter((o) => o.id !== edit.id), edit] };
    try {
      readCareer(next);
      if (lib.update(next)) {
        setSelected(edit.id);
        setEdit(null);
        setNotice('Saved. Nothing you type or import here is verified by an institution.');
      }
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const line = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;
  const field = { display: 'block', marginBottom: 'var(--sp-5)' } as const;
  const input = { width: '100%', marginTop: 'var(--sp-2)' } as const;
  const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)' } as const;

  return (
    <Page>
      <p style={{ ...line, marginBlock: 0, textWrap: 'pretty' }}>
        Your own preparation. Live listings, verified alumni, appointments and official applications all
        need approved school services this app is not connected to.
      </p>

      <Segmented options={TABS} value={tab} onChange={setTab} style={{ marginBlock: 'var(--sp-5)' }} />

      {/*
       * Where the Applications tab used to be, as a row rather than a second
       * copy of the tracker. Above the tab bodies because it is not one of
       * them: it belongs to the whole screen, the way "Track it" does.
       */}
      <Group>
        <NavRow
          label="Applications"
          sub="Every one you are tracking, beside the coursework it lands on"
          value={String(state.applications.filter((a) => LIVE.includes(a.stage)).length)}
          onClick={() => dispatch({ type: 'go', screen: 'applying' })}
        />
      </Group>

      {(notice || lib.error) && (
        <Notice>
          {lib.error || notice}
          {lib.blocked && (
            <ActionButton
              onClick={() =>
                download({ name: 'Career recovery.json', body: lib.recovery(), mime: 'application/json' })
              }
              style={{ marginTop: 'var(--sp-4)' }}
            >
              Download recovery copy
            </ActionButton>
          )}
        </Notice>
      )}

      {tab === 'discover' && (
        <>
          <input
            className="input"
            aria-label="Search opportunities"
            placeholder="Role, employer, location, skills or country"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', marginBottom: 'var(--sp-4)' }}
          />
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Type</span>
            <select className="input" value={kind} onChange={(e) => setKind(e.target.value)} style={input}>
              <option>All types</option>
              {OPPORTUNITY_KINDS.map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Format</span>
            <select className="input" value={format} onChange={(e) => setFormat(e.target.value)} style={input}>
              {['All formats', ...OPPORTUNITY_FORMATS].map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            <ActionButton
              onClick={() => setSavedOnly(!savedOnly)}
              aria-pressed={savedOnly}
              tone={savedOnly ? 'primary' : 'secondary'}
              style={{ flex: '1 1 auto' }}
            >
              Saved only
            </ActionButton>
            <ActionButton onClick={() => setEdit(newOpportunity())} style={{ flex: '1 1 auto' }}>
              Add one
            </ActionButton>
          </div>
          <FilePick
            accept=".json"
            multiple={false}
            onPick={async (files) => {
              try {
                const f = files[0];
                if (!f) return;
                if (f.size > 2_000_000) throw new Error('Choose a file smaller than 2 MB.');
                const got = readOpportunities(await f.text());
                if (lib.update((old) => ({ ...old, opportunities: [...old.opportunities, ...got] }))) {
                  setNotice(`${got.length} imported, for you to review.`);
                }
              } catch (e) {
                setNotice((e as Error).message);
              }
            }}
          >
            Import listings
          </FilePick>

          {edit && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                saveOpportunity();
              }}
              style={{ marginTop: 'var(--sp-6)' }}
            >
              <SectionLabel style={{ marginBlock: '0 var(--sp-4)' }}>
                {lib.value.opportunities.some((o) => o.id === edit.id) ? 'Edit' : 'New opportunity'}
              </SectionLabel>
              {(['title', 'organization', 'location', 'compensation', 'skills', 'country', 'term', 'cost', 'credit'] as const).map(
                (k) => (
                  <label key={k} style={field}>
                    <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>{FIELD_LABELS[k]}</span>
                    <input
                      className="input"
                      required={k === 'title'}
                      maxLength={k === 'title' || k === 'organization' ? 160 : 1000}
                      value={edit[k]}
                      onChange={(e) => setEdit({ ...edit, [k]: e.target.value })}
                      style={input}
                    />
                  </label>
                ),
              )}
              <label style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Type</span>
                <select
                  className="input"
                  value={edit.kind}
                  onChange={(e) => setEdit({ ...edit, kind: e.target.value as Opportunity['kind'] })}
                  style={input}
                >
                  {OPPORTUNITY_KINDS.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Format</span>
                <select
                  className="input"
                  value={edit.format}
                  onChange={(e) => setEdit({ ...edit, format: e.target.value as Opportunity['format'] })}
                  style={input}
                >
                  {OPPORTUNITY_FORMATS.map((k) => (
                    <option key={k}>{k}</option>
                  ))}
                </select>
              </label>
              <label style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Deadline</span>
                <input
                  className="input"
                  type="date"
                  value={edit.deadline}
                  onChange={(e) => setEdit({ ...edit, deadline: e.target.value })}
                  style={input}
                />
              </label>
              <label style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Official listing link</span>
                <input
                  className="input"
                  type="url"
                  maxLength={CAREER_LIMITS.url}
                  value={edit.url}
                  onChange={(e) => setEdit({ ...edit, url: e.target.value })}
                  style={input}
                />
              </label>
              <label style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Description</span>
                <textarea
                  className="input"
                  rows={4}
                  maxLength={CAREER_LIMITS.description}
                  value={edit.description}
                  onChange={(e) => setEdit({ ...edit, description: e.target.value })}
                  style={input}
                />
              </label>
              <label style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>What it asks for</span>
                <textarea
                  className="input"
                  rows={4}
                  maxLength={CAREER_LIMITS.requirements}
                  value={edit.requirements}
                  onChange={(e) => setEdit({ ...edit, requirements: e.target.value })}
                  style={input}
                />
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1 1 auto' }}>
                  Save
                </button>
                <ActionButton onClick={() => setEdit(null)} style={{ flex: '1 1 auto' }}>
                  Cancel
                </ActionButton>
              </div>
            </form>
          )}

          <SectionLabel aside={`${matches.length}`} style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}>
            Opportunities
          </SectionLabel>
          {matches.length === 0 ? (
            <p style={{ ...body, ...secondLine(), textWrap: 'pretty' }}>
              Nothing here yet. Add a real listing, or import an export your school provided. No invented
              jobs or alumni are included — there is no job board behind this screen.
            </p>
          ) : (
            <CardGrid min={150}>
              {matches.map((o) => (
                <GridCard
                  key={o.id}
                  label={o.title}
                  meta={o.deadline ? `Due ${o.deadline}` : 'No deadline'}
                  selected={selected === o.id}
                  title={`${o.organization} · ${o.location || o.format}`}
                  onClick={() => setSelected(o.id)}
                />
              ))}
            </CardGrid>
          )}

          {open && (
            <>
              <SectionLabel
                aside="You entered this"
                style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}
              >
                {open.title}
              </SectionLabel>
              <p style={body}>{open.organization}</p>
              {open.description && (
                <p style={{ ...body, whiteSpace: 'pre-wrap', marginBlock: 'var(--sp-4)' }}>{open.description}</p>
              )}
              {open.requirements && (
                <>
                  <SectionLabel style={{ marginBlock: 'var(--sp-5) var(--sp-3)' }}>Asks for</SectionLabel>
                  <p style={{ ...body, whiteSpace: 'pre-wrap' }}>{open.requirements}</p>
                </>
              )}
              {(
                [
                  ['Skills', open.skills],
                  ['Format', open.format],
                  ['Country', open.country],
                  ['Term', open.term],
                  ['Cost', open.cost],
                  ['Credits', open.credit],
                ] as const
              )
                .filter(([, v]) => v)
                .map(([name, v]) => (
                  <p key={name} style={{ fontSize: 'var(--type-sm)', marginBlock: 'var(--sp-2)' }}>
                    <span style={secondLine()}>{name}: </span>
                    {v}
                  </p>
                ))}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}>
                <ActionButton
                  onClick={() =>
                    lib.update((old) => ({
                      ...old,
                      opportunities: old.opportunities.map((o) =>
                        o.id === open.id ? { ...o, saved: !o.saved } : o,
                      ),
                    }))
                  }
                  style={{ flex: '1 1 auto' }}
                >
                  {open.saved ? 'Unsave' : 'Save'}
                </ActionButton>
                <ActionButton
                  onClick={() => {
                    if (state.applications.some((a) => a.org === open.organization && a.role === open.title)) {
                      setNotice('That is already in your application tracker.');
                      return;
                    }
                    dispatch({
                      type: 'addApplication',
                      patch: {
                        org: open.organization,
                        role: open.title,
                        kind: APPLY_KIND[open.kind],
                        where: open.location,
                        due: open.deadline,
                        url: open.url,
                        note: open.requirements,
                        next: 'Review what it asks for and start the materials',
                        stage: 'found',
                      },
                    });
                    setNotice('Added to your tracker, with its deadline. Nothing has been applied for.');
                  }}
                  style={{ flex: '1 1 auto' }}
                >
                  Track it
                </ActionButton>
                <ActionButton
                  onClick={() => write(`${open.organization} · Cover letter`, coverLetter(lib.value, open))}
                  style={{ flex: '1 1 auto' }}
                >
                  Draft a letter
                </ActionButton>
                <ActionButton onClick={() => setEdit({ ...open })} style={{ flex: '1 1 auto' }}>
                  Edit
                </ActionButton>
              </div>
              {safeUrl(open.url) && (
                <p style={{ marginTop: 'var(--sp-4)' }}>
                  <a href={safeUrl(open.url)} target="_blank" rel="noreferrer" style={body}>
                    Open the official listing ↗
                  </a>
                </p>
              )}
            </>
          )}
        </>
      )}

      {tab === 'resume' && (
        <>
          <p style={{ ...line, marginBlock: '0 var(--sp-5)', textWrap: 'pretty' }}>
            Everything here is what you say about yourself. Nothing is marked verified, and nothing is
            shared anywhere on its own.
          </p>
          {(['name', 'headline', 'contact'] as const).map((k) => (
            <label key={k} style={field}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>
                {k === 'contact' ? 'Contact line you want on it' : k === 'headline' ? 'Profile or objective' : 'Name'}
              </span>
              <input
                className="input"
                maxLength={k === 'name' ? 160 : k === 'headline' ? 300 : 500}
                value={lib.value[k]}
                onChange={(e) => lib.update((old) => ({ ...old, [k]: e.target.value }))}
                style={input}
              />
            </label>
          ))}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            <ActionButton
              tone="primary"
              onClick={() => write(`${lib.value.name || 'My'} résumé`, resumeMarkdown(lib.value))}
              style={{ flex: '1 1 auto' }}
            >
              Build it in Write
            </ActionButton>
            <ActionButton
              onClick={() =>
                setExperience({
                  id: crypto.randomUUID(),
                  category: 'Experience',
                  title: '',
                  organization: '',
                  dates: '',
                  details: '',
                })
              }
              style={{ flex: '1 1 auto' }}
            >
              Add an entry
            </ActionButton>
          </div>

          {experience && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const ok = lib.update((old) => ({
                  ...old,
                  experiences: [...old.experiences.filter((x) => x.id !== experience.id), experience],
                }));
                if (ok) setExperience(null);
              }}
            >
              <label style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Category</span>
                <select
                  className="input"
                  value={experience.category}
                  onChange={(e) =>
                    setExperience({ ...experience, category: e.target.value as CareerExperience['category'] })
                  }
                  style={input}
                >
                  {EXPERIENCE_TYPES.map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              {(['title', 'organization', 'dates'] as const).map((k) => (
                <label key={k} style={field}>
                  <span style={{ fontSize: 'var(--type-sm)', ...secondLine(), textTransform: 'capitalize' }}>{k}</span>
                  <input
                    className="input"
                    required={k === 'title'}
                    maxLength={k === 'dates' ? 100 : 160}
                    value={experience[k]}
                    onChange={(e) => setExperience({ ...experience, [k]: e.target.value })}
                    style={input}
                  />
                </label>
              ))}
              <label style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>What you actually did</span>
                <textarea
                  className="input"
                  rows={6}
                  maxLength={5000}
                  value={experience.details}
                  onChange={(e) => setExperience({ ...experience, details: e.target.value })}
                  style={input}
                />
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1 1 auto' }}>
                  Save entry
                </button>
                <ActionButton onClick={() => setExperience(null)} style={{ flex: '1 1 auto' }}>
                  Cancel
                </ActionButton>
              </div>
            </form>
          )}

          {lib.value.experiences.map((e, i) => (
            <section
              key={e.id}
              style={{
                border: '1px solid var(--app-line)',
                borderRadius: 'var(--r-md)',
                padding: 'var(--sp-5)',
                marginBlock: 'var(--sp-4)',
              }}
            >
              <SectionLabel aside={e.category} style={{ marginBlock: 0 }}>
                {e.title}
              </SectionLabel>
              <p style={line}>
                {e.organization}
                {e.dates ? ` · ${e.dates}` : ''}
              </p>
              <p style={{ ...body, whiteSpace: 'pre-wrap' }}>{e.details}</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
                <ActionButton onClick={() => setExperience({ ...e })} style={{ flex: '1 1 auto' }}>
                  Edit
                </ActionButton>
                <ActionButton
                  disabled={i === 0}
                  onClick={() =>
                    lib.update((old) => {
                      const xs = [...old.experiences];
                      [xs[i - 1], xs[i]] = [xs[i], xs[i - 1]];
                      return { ...old, experiences: xs };
                    })
                  }
                  style={{ flex: '1 1 auto' }}
                >
                  Up
                </ActionButton>
                <ActionButton
                  disabled={i === lib.value.experiences.length - 1}
                  onClick={() =>
                    lib.update((old) => {
                      const xs = [...old.experiences];
                      [xs[i + 1], xs[i]] = [xs[i], xs[i + 1]];
                      return { ...old, experiences: xs };
                    })
                  }
                  style={{ flex: '1 1 auto' }}
                >
                  Down
                </ActionButton>
              </div>
            </section>
          ))}

          {state.commitments.length > 0 && (
            <>
              <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}>
                From what you already do
              </SectionLabel>
              <CardGrid min={140}>
                {state.commitments.map((c) => (
                  <GridCard
                    key={c.id}
                    label={c.name}
                    meta={c.role || 'Member'}
                    onClick={() =>
                      setExperience({
                        id: crypto.randomUUID(),
                        category: c.kind === 'varsity' ? 'Athletics' : 'Leadership',
                        title: c.role || 'Member',
                        organization: c.name,
                        dates: '',
                        details: c.note,
                      })
                    }
                  />
                ))}
              </CardGrid>
            </>
          )}
        </>
      )}

      {tab === 'network' && (
        <>
          <p style={{ ...line, marginBlock: '0 var(--sp-5)', textWrap: 'pretty' }}>
            Private notes about people you already know. A name in a file is not permission to contact
            somebody, and this screen never contacts anyone.
          </p>
          <ActionButton
            onClick={() =>
              setPerson({
                id: crypto.randomUUID(),
                name: '',
                organization: '',
                interests: '',
                permission: 'Not requested',
                next: '',
                nextDate: '',
                notes: '',
              })
            }
          >
            Add a note
          </ActionButton>

          {person && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const ok = lib.update((old) => ({
                  ...old,
                  contacts: [...old.contacts.filter((c) => c.id !== person.id), person],
                }));
                if (ok) setPerson(null);
              }}
              style={{ marginTop: 'var(--sp-5)' }}
            >
              {(['name', 'organization', 'interests', 'next'] as const).map((k) => (
                <label key={k} style={field}>
                  <span style={{ fontSize: 'var(--type-sm)', ...secondLine(), textTransform: 'capitalize' }}>
                    {k === 'next' ? 'Next step' : k}
                  </span>
                  <input
                    className="input"
                    required={k === 'name'}
                    maxLength={500}
                    value={person[k]}
                    onChange={(e) => setPerson({ ...person, [k]: e.target.value })}
                    style={input}
                  />
                </label>
              ))}
              <label style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Have they agreed?</span>
                <select
                  className="input"
                  value={person.permission}
                  onChange={(e) =>
                    setPerson({ ...person, permission: e.target.value as CareerContact['permission'] })
                  }
                  style={input}
                >
                  {CONTACT_PERMISSIONS.map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
              </label>
              <label style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Follow up on</span>
                <input
                  className="input"
                  type="date"
                  value={person.nextDate}
                  onChange={(e) => setPerson({ ...person, nextDate: e.target.value })}
                  style={input}
                />
              </label>
              <label style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Private notes</span>
                <textarea
                  className="input"
                  rows={5}
                  maxLength={CAREER_LIMITS.notes}
                  value={person.notes}
                  onChange={(e) => setPerson({ ...person, notes: e.target.value })}
                  style={input}
                />
              </label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
                <button type="submit" className="btn btn-primary" style={{ flex: '1 1 auto' }}>
                  Save note
                </button>
                <ActionButton onClick={() => setPerson(null)} style={{ flex: '1 1 auto' }}>
                  Cancel
                </ActionButton>
              </div>
            </form>
          )}

          {lib.value.contacts.map((c) => (
            <section
              key={c.id}
              style={{
                border: '1px solid var(--app-line)',
                borderRadius: 'var(--r-md)',
                padding: 'var(--sp-5)',
                marginBlock: 'var(--sp-4)',
              }}
            >
              <SectionLabel aside={c.permission} style={{ marginBlock: 0 }}>
                {c.name}
              </SectionLabel>
              <p style={line}>{c.organization}</p>
              {c.interests && <p style={body}>{c.interests}</p>}
              {c.notes && <p style={{ ...body, whiteSpace: 'pre-wrap' }}>{c.notes}</p>}
              <p style={line}>
                Next: {c.next || 'nothing recorded'} {c.nextDate}
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
                <ActionButton onClick={() => setPerson({ ...c })} style={{ flex: '1 1 auto' }}>
                  Edit
                </ActionButton>
                <ActionButton
                  onClick={() => {
                    const from = `career-contact:${c.id}`;
                    if (state.tasks.some((t) => t.from === from)) {
                      setNotice('That follow-up is already a task.');
                      return;
                    }
                    dispatch({
                      type: 'addTask',
                      task: {
                        title: c.next || `Follow up with ${c.name}`,
                        date: c.nextDate || null,
                        time: '',
                        note: c.organization,
                        courseId: null,
                        from,
                      },
                    });
                    setNotice('Added to your tasks. No message was sent.');
                  }}
                  style={{ flex: '1 1 auto' }}
                >
                  Make it a task
                </ActionButton>
                <ActionButton
                  onClick={() =>
                    write(
                      `Conversation with ${c.name}`,
                      [
                        '# Before the conversation',
                        '',
                        `Contact: ${c.name}`,
                        c.organization,
                        '',
                        '## What you have in common',
                        c.interests,
                        '',
                        '## Questions',
                        '- What has been most useful in your own path?',
                        '- Which skills would you build next, in my position?',
                        '- What should I learn before going further into this?',
                        '',
                        '## My next step',
                        c.next,
                        '',
                        '## Thank-you draft',
                        '[Write down the specific advice you were glad of, afterwards.]',
                      ].join('\n'),
                    )
                  }
                  style={{ flex: '1 1 auto' }}
                >
                  Prepare
                </ActionButton>
              </div>
            </section>
          ))}
        </>
      )}

      {tab === 'abroad' && (
        <>
          <p style={{ ...body, marginBlock: '0 var(--sp-5)', textWrap: 'pretty' }}>
            Credit approval, visas, health requirements and acceptance all have to be confirmed with the
            institution responsible for them. This is the preparation around that.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            <ActionButton
              onClick={() => {
                setKind('Study abroad');
                setTab('discover');
              }}
              style={{ flex: '1 1 auto' }}
            >
              Saved programs
            </ActionButton>
            <ActionButton
              onClick={() => {
                setEdit({ ...newOpportunity(), kind: 'Study abroad' });
                setTab('discover');
              }}
              style={{ flex: '1 1 auto' }}
            >
              Add a program
            </ActionButton>
            <ActionButton onClick={() => dispatch({ type: 'go', screen: 'degree' })} style={{ flex: '1 1 auto' }}>
              Degree plan
            </ActionButton>
          </div>
          <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-3)' }}>The order it happens in</SectionLabel>
          {ABROAD_STEPS.map((step) => (
            <label
              key={step}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-4)',
                paddingBlock: 'var(--sp-3)',
                borderBottom: '1px solid var(--app-line)',
                ...body,
              }}
            >
              <input
                type="checkbox"
                checked={lib.value.abroadSteps[step] || false}
                onChange={(e) =>
                  lib.update((old) => ({ ...old, abroadSteps: { ...old.abroadSteps, [step]: e.target.checked } }))
                }
              />
              <span>{step}</span>
            </label>
          ))}
          <ActionButton
            onClick={() =>
              write(
                'Study abroad preparation',
                [
                  '# My study abroad plan',
                  '',
                  ABROAD_STEPS.map((s) => `- [${lib.value.abroadSteps[s] ? 'x' : ' '}] ${s}`).join('\n'),
                  '',
                  '## Programs',
                  lib.value.opportunities
                    .filter((o) => o.kind === 'Study abroad')
                    .map((o) =>
                      [`### ${o.title}`, `${o.organization} · ${o.country}`, o.cost, o.credit, o.requirements].join(
                        '\n',
                      ),
                    )
                    .join('\n\n'),
                ].join('\n'),
              )
            }
            style={{ marginTop: 'var(--sp-5)' }}
          >
            Build the document
          </ActionButton>
        </>
      )}

      {tab === 'library' && (
        <>
          <SectionLabel style={{ marginBlock: '0 var(--sp-4)' }}>Prepare for an appointment</SectionLabel>
          <CardGrid min={150}>
            {(
              [
                ['Résumé review', 'Bring a current draft and one real job description.'],
                ['Interview preparation', 'Prepare examples you can back with evidence.'],
                ['Career exploration', 'Compare interests, skills and possible next steps.'],
                ['Mentoring', 'Agree availability, goals and how you will keep in touch.'],
              ] as const
            ).map(([name, detail]) => (
              <GridCard
                key={name}
                label={name}
                title={detail}
                onClick={() =>
                  write(
                    `${name} preparation`,
                    `# ${name}\n\n${detail}\n\n## Goal\n\n## What I have tried\n\n## Questions\n\n## Evidence and materials\n\n## Next steps\n`,
                  )
                }
              />
            ))}
          </CardGrid>

          <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}>Your data</SectionLabel>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            <ActionButton
              onClick={() =>
                download({
                  name: 'Semester career library.json',
                  body: JSON.stringify(lib.value, null, 2),
                  mime: 'application/json',
                })
              }
              style={{ flex: '1 1 auto' }}
            >
              Export
            </ActionButton>
            <ActionButton
              onClick={() =>
                download({
                  name: 'Career listing template.json',
                  body: JSON.stringify(
                    { opportunities: [{ ...newOpportunity(), title: 'Replace with a real listing' }] },
                    null,
                    2,
                  ),
                  mime: 'application/json',
                })
              }
              style={{ flex: '1 1 auto' }}
            >
              Import template
            </ActionButton>
          </div>
          <FilePick
            accept=".json"
            multiple={false}
            onPick={async (files) => {
              try {
                const f = files[0];
                if (!f) return;
                if (f.size > 3_000_000) throw new Error('Choose an export smaller than 3 MB.');
                const got = readCareer(JSON.parse(await f.text()));
                /*
                 * Only into an empty library. A restore that merged would have
                 * to decide which résumé won, and there is no answer to that
                 * which is not somebody's work quietly disappearing.
                 * Opportunities alone can be merged, in Discover.
                 */
                if (lib.value.experiences.length || lib.value.contacts.length || lib.value.opportunities.length) {
                  throw new Error(
                    'Restore into an empty career library. Opportunities on their own can be merged in Discover.',
                  );
                }
                if (lib.update(got)) setNotice('Restored.');
              } catch (e) {
                setNotice((e as Error).message);
              }
            }}
          >
            Restore a library
          </FilePick>
        </>
      )}
    </Page>
  );
}
