import { useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { ActionButton, FilePick, Notice, SectionLabel, Segmented } from '../components/ui';
import { CardGrid, GridCard } from '../components/GridCard';
import { secondLine } from '../lib/dim';
import { useDeviceLibrary } from '../lib/device-library';
import { download } from '../lib/deliver';
import { fromMarkdown } from '../lib/document';
import {
  APPLICATION_STAGES,
  EMPTY_PATHWAY,
  LIFE_STAGES,
  MATERIAL_STATES,
  PATHWAY_LIMITS,
  PATHWAY_TEMPLATES,
  netProgramCost,
  newPathwayProject,
  newProgram,
  programReadiness,
  readPathway,
  readPrograms,
  type PathwayLibrary,
  type PathwayProject,
  type Program,
} from '../lib/pathway';
import type { Screen } from '../lib/types';

/**
 * The parts of a degree that outlast a term.
 *
 * Applying somewhere, arriving, a thesis, graduating, leaving. Each is a
 * project with a shape most people meet exactly once, which is why the
 * eleven templates in `lib/pathway.ts` are worth more than they look: they
 * are the order the deadlines actually fall in, for somebody who has never
 * done this before.
 *
 * Unlike every other workspace here, this one is deliberately *not* scoped to
 * a term. Applying to graduate school spans three of them.
 *
 * ## Statuses are notes, and the screen never forgets it
 *
 * "Submitted", "Accepted", "Reported received" — all of them are what the
 * student typed. They look exactly like a system-of-record status, which is
 * the danger, so every place one is drawn says whose claim it is. Changing
 * one alters a word on a card: it enrols nobody, moves no permission, and
 * touches no coursework.
 *
 * ## The cost table refuses to rank
 *
 * `compare` puts programmes side by side and stops there. It does not sort by
 * net cost, and it shows the currency and period beside every row rather than
 * converting — because two figures a student copied off two web pages, in two
 * currencies over two different periods, do not become comparable by being
 * put in the same column. Subtracting loans as "aid" is the other way that
 * table lies, so `netProgramCost` does not, and the field says so.
 */

const TABS = [
  { id: 'home' as const, label: 'Pathway' },
  { id: 'programs' as const, label: 'Programs' },
  { id: 'compare' as const, label: 'Costs' },
  { id: 'profile' as const, label: 'Profile' },
  { id: 'milestones' as const, label: 'Milestones' },
  { id: 'backup' as const, label: 'Backup' },
];

type Tab = (typeof TABS)[number]['id'] | 'edit';

/** The screens this one hands off to, with what each is for. */
const CONNECTED: [Screen, string][] = [
  ['degree', 'Degree plan'],
  ['yes', 'Registration'],
  ['study', 'Study'],
  ['write', 'Documents'],
  ['career', 'Career'],
  ['housing', 'Housing'],
  ['family', 'Family'],
  ['university', 'Official services'],
];

export function Pathway() {
  const { account } = useStore();
  // Not keyed by term: applying to graduate school spans several of them.
  return <Workspace key={account?.id || 'device'} storageKey={`semester.pathway.v1:${account?.id || 'device'}`} />;
}

function Workspace({ storageKey }: { storageKey: string }) {
  const { dispatch } = useStore();
  const lib = useDeviceLibrary(storageKey, readPathway, EMPTY_PATHWAY);

  const [tab, setTab] = useState<Tab>('home');
  const [query, setQuery] = useState('');
  const [programId, setProgramId] = useState('');
  const [program, setProgram] = useState<Program>(() => newProgram());
  const [projectId, setProjectId] = useState('');
  const [template, setTemplate] = useState('College application');
  const [material, setMaterial] = useState('');
  const [stepTitle, setStepTitle] = useState('');
  const [compare, setCompare] = useState<string[]>([]);
  const [notice, setNotice] = useState('');

  const project = lib.value.projects.find((p) => p.id === projectId);
  const selected = lib.value.programs.find((p) => p.id === programId);
  const programs = lib.value.programs.filter((p) =>
    `${p.school} ${p.program} ${p.location} ${p.degree}`.toLowerCase().includes(query.toLowerCase()),
  );

  const write = (title: string, body: string) =>
    dispatch({
      type: 'makeDocument',
      open: true,
      doc: {
        title,
        subtitle: 'Your own preparation · Verify every requirement with the institution',
        courseId: null,
        blocks: fromMarkdown(body),
      },
    });

  const patchProject = (patch: Partial<PathwayProject>, message?: string) =>
    lib.update((old) => ({
      ...old,
      projects: old.projects.map((p) =>
        p.id === projectId
          ? {
              ...p,
              ...patch,
              history: message
                ? [{ at: Date.now(), message }, ...p.history].slice(0, PATHWAY_LIMITS.history)
                : p.history,
            }
          : p,
      ),
    }));

  const line = { fontSize: 'var(--type-sm)', ...secondLine(), lineHeight: 'var(--leading-normal)' } as const;
  const field = { display: 'block', marginBottom: 'var(--sp-5)' } as const;
  const input = { width: '100%', marginTop: 'var(--sp-2)' } as const;
  const body = { fontSize: 'var(--type-base)', lineHeight: 'var(--leading-normal)' } as const;

  return (
    <Page>
      <p style={{ ...line, marginBlock: 0, textWrap: 'pretty' }}>
        Your own planning. A stage or status here changes nothing about your enrolment, your permissions or
        your coursework — and these plans stay with this account across terms.
      </p>

      <Segmented
        options={TABS}
        value={tab === 'edit' ? 'programs' : tab}
        onChange={setTab}
        style={{ marginBlock: 'var(--sp-5)' }}
      />

      {(lib.error || notice) && (
        <Notice>
          {lib.error || notice}
        </Notice>
      )}

      {tab === 'home' && (
        <>
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Where you are</span>
            <select
              value={lib.value.stage}
              onChange={(e) => lib.update((old) => ({ ...old, stage: e.target.value as PathwayLibrary['stage'] }))}
              style={input}
            >
              {LIFE_STAGES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>

          <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-4)' }}>Start something</SectionLabel>
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Checklist</span>
            <select value={template} onChange={(e) => setTemplate(e.target.value)} style={input}>
              {Object.keys(PATHWAY_TEMPLATES).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <ActionButton
            tone="primary"
            onClick={() => {
              const p = newPathwayProject(template);
              if (lib.update((old) => ({ ...old, projects: [p, ...old.projects] }))) {
                setProjectId(p.id);
                setTab('milestones');
              }
            }}
          >
            Create it
          </ActionButton>

          <SectionLabel
            aside={`${lib.value.programs.length} saved`}
            style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}
          >
            Where you stand
          </SectionLabel>
          <p style={body}>
            {lib.value.programs.filter((p) => programReadiness(p).missing > 0).length} programs still have
            materials in preparation.
          </p>
          {lib.value.projects.length > 0 && (
            <CardGrid min={150}>
              {lib.value.projects.slice(0, 4).map((p) => (
                <GridCard
                  key={p.id}
                  label={p.title}
                  meta={`${p.steps.filter((s) => s.done).length} of ${p.steps.length}`}
                  onClick={() => {
                    setProjectId(p.id);
                    setTab('milestones');
                  }}
                />
              ))}
            </CardGrid>
          )}

          <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}>Elsewhere in the app</SectionLabel>
          <CardGrid min={132}>
            {CONNECTED.map(([screen, label]) => (
              <GridCard key={screen} label={label} onClick={() => dispatch({ type: 'go', screen })} />
            ))}
          </CardGrid>
        </>
      )}

      {tab === 'programs' && (
        <>
          <input
            aria-label="Search saved programs"
            placeholder="School, program, degree or location"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{ width: '100%', marginBottom: 'var(--sp-4)' }}
          />
          <ActionButton
            tone="primary"
            onClick={() => {
              setProgram(newProgram());
              setProgramId('');
              setTab('edit');
            }}
          >
            Add a program
          </ActionButton>

          <SectionLabel aside={`${programs.length}`} style={{ marginBlock: 'var(--sp-6) var(--sp-4)' }}>
            Your shortlist
          </SectionLabel>
          {programs.length === 0 ? (
            <p style={{ ...body, ...secondLine(), textWrap: 'pretty' }}>
              Nothing yet. Add programs by hand, or import a catalog your school provided. Nothing here is
              labelled verified, because there is no institutional source behind it.
            </p>
          ) : (
            <CardGrid min={150}>
              {programs.map((p) => (
                <GridCard
                  key={p.id}
                  label={p.school}
                  meta={p.deadline || 'No deadline'}
                  selected={p.id === programId}
                  title={`${p.program} · ${p.degree} · you recorded: ${p.status}`}
                  onClick={() => {
                    setProgramId(p.id);
                    setProgram(structuredClone(p));
                  }}
                />
              ))}
            </CardGrid>
          )}

          {selected && (
            <>
              <SectionLabel
                aside={`You recorded: ${selected.status}`}
                style={{ marginBlock: 'var(--sp-7) var(--sp-4)' }}
              >
                {selected.school} · {selected.program}
              </SectionLabel>
              <p style={{ ...body, whiteSpace: 'pre-wrap' }}>
                {selected.requirements || 'Add the requirements from the program’s own instructions.'}
              </p>
              <p style={line}>
                {programReadiness(selected).missing} materials still in preparation
                {!selected.materials.length ? ' · none listed yet' : ''}
                {!selected.deadline ? ' · deadline missing' : ''}
              </p>

              <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-3)' }}>What it needs</SectionLabel>
              {selected.materials.map((m) => (
                <label key={m.id} style={field}>
                  <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>{m.title}</span>
                  <select
                    value={m.status}
                    onChange={(e) =>
                      lib.update((old) => ({
                        ...old,
                        programs: old.programs.map((p) =>
                          p.id === selected.id
                            ? {
                                ...p,
                                materials: p.materials.map((x) =>
                                  x.id === m.id ? { ...x, status: e.target.value as typeof m.status } : x,
                                ),
                              }
                            : p,
                        ),
                      }))
                    }
                    style={input}
                  >
                    {MATERIAL_STATES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </label>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!material.trim()) return;
                  const ok = lib.update((old) => ({
                    ...old,
                    programs: old.programs.map((p) =>
                      p.id === selected.id
                        ? {
                            ...p,
                            materials: [
                              ...p.materials,
                              { id: crypto.randomUUID(), title: material.trim(), status: 'Not started' as const, due: '' },
                            ],
                          }
                        : p,
                    ),
                  }));
                  if (ok) setMaterial('');
                }}
                style={{ display: 'flex', gap: 'var(--sp-4)' }}
              >
                <input
                  aria-label="New required material"
                  placeholder="Something else it asks for"
                  maxLength={250}
                  value={material}
                  onChange={(e) => setMaterial(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-secondary">
                  Add
                </button>
              </form>
              <p style={{ ...line, marginBlock: 'var(--sp-4)', textWrap: 'pretty' }}>
                "Reported received" records what you were told. It is not a school-verified status, and
                sensitive records belong in the service your school approved for them.
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
                <ActionButton
                  onClick={() => {
                    setProgram(structuredClone(selected));
                    setTab('edit');
                  }}
                  style={{ flex: '1 1 auto' }}
                >
                  Edit
                </ActionButton>
                <ActionButton
                  onClick={() =>
                    write(
                      `${selected.school} · Essay preparation`,
                      [
                        `# ${selected.program}`,
                        '',
                        '## What the program asks for',
                        selected.requirements,
                        '',
                        '## What I have actually done',
                        lib.value.profile.experience,
                        '',
                        '## The prompt',
                        '[Paste the exact prompt and its word limit.]',
                        '',
                        '## Outline',
                        '[Your own response. Check every claim against your own record.]',
                      ].join('\n'),
                    )
                  }
                  style={{ flex: '1 1 auto' }}
                >
                  Start the essay
                </ActionButton>
              </div>
              {selected.url && (
                <p style={{ marginTop: 'var(--sp-4)' }}>
                  <a href={selected.url} target="_blank" rel="noreferrer" style={body}>
                    Open the source you recorded ↗
                  </a>
                </p>
              )}
            </>
          )}
        </>
      )}

      {tab === 'edit' && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const ok = lib.update((old) => ({
              ...old,
              programs: [...old.programs.filter((p) => p.id !== program.id), program],
            }));
            if (!ok) return;
            setProgramId(program.id);
            setTab('programs');
            setNotice('Saved as your own planning record. Official decisions need a school connection.');
          }}
        >
          <fieldset disabled={lib.blocked} style={{ border: 0, padding: 0, minWidth: 0 }}>
            <SectionLabel style={{ marginBlock: '0 var(--sp-4)' }}>Program record</SectionLabel>
            {(['school', 'program', 'location', 'degree'] as const).map((k) => (
              <label key={k} style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine(), textTransform: 'capitalize' }}>{k}</span>
                <input
                  required={k === 'school' || k === 'program'}
                  maxLength={200}
                  value={program[k]}
                  onChange={(e) => setProgram((p) => ({ ...p, [k]: e.target.value }))}
                  style={input}
                />
              </label>
            ))}
            <label style={field}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Deadline</span>
              <input
                type="date"
                value={program.deadline}
                onChange={(e) => setProgram((p) => ({ ...p, deadline: e.target.value }))}
                style={input}
              />
            </label>
            <label style={field}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Where you think it stands</span>
              <select
                value={program.status}
                onChange={(e) => setProgram((p) => ({ ...p, status: e.target.value as Program['status'] }))}
                style={input}
              >
                {APPLICATION_STAGES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <label style={field}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Official source link</span>
              <input
                type="url"
                maxLength={2000}
                value={program.url}
                onChange={(e) => setProgram((p) => ({ ...p, url: e.target.value }))}
                style={input}
              />
            </label>
            <label style={field}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>
                Requirements, prompts and word limits
              </span>
              <textarea
                rows={5}
                maxLength={10_000}
                value={program.requirements}
                onChange={(e) => setProgram((p) => ({ ...p, requirements: e.target.value }))}
                style={input}
              />
            </label>
            <label style={field}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Notes</span>
              <textarea
                rows={5}
                maxLength={10_000}
                value={program.notes}
                onChange={(e) => setProgram((p) => ({ ...p, notes: e.target.value }))}
                style={input}
              />
            </label>

            <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-4)' }}>Cost estimates</SectionLabel>
            {(
              [
                ['tuition', 'Tuition and fees'],
                ['living', 'Housing and living'],
                ['other', 'Everything else'],
                ['aid', 'Grants and scholarships — not loans'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>{label}</span>
                <input
                  type="number"
                  min={0}
                  max={PATHWAY_LIMITS.money}
                  step="0.01"
                  value={program[k]}
                  onChange={(e) => setProgram((p) => ({ ...p, [k]: Number(e.target.value) }))}
                  style={input}
                />
              </label>
            ))}
            {(
              [
                ['currency', 'Currency'],
                ['period', 'Over what period'],
              ] as const
            ).map(([k, label]) => (
              <label key={k} style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>{label}</span>
                <input
                  maxLength={200}
                  value={program[k]}
                  onChange={(e) => setProgram((p) => ({ ...p, [k]: e.target.value }))}
                  style={input}
                />
              </label>
            ))}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)' }}>
              <button type="submit" className="btn btn-primary" style={{ flex: '1 1 auto' }}>
                Save
              </button>
              <ActionButton onClick={() => setTab('programs')} style={{ flex: '1 1 auto' }}>
                Back
              </ActionButton>
            </div>
          </fieldset>
        </form>
      )}

      {tab === 'compare' && (
        <>
          <p style={{ ...body, marginBlock: '0 var(--sp-5)', textWrap: 'pretty' }}>
            Estimates you entered, not aid offers. Loans are not subtracted as aid. Currencies and periods
            are shown rather than converted, and nothing is ranked — two numbers copied off two web pages do
            not become comparable by sharing a column.
          </p>
          {lib.value.programs.length > 0 && (
            <>
              <SectionLabel style={{ marginBlock: '0 var(--sp-4)' }}>Pick some</SectionLabel>
              <CardGrid min={150}>
                {lib.value.programs.map((p) => (
                  <GridCard
                    key={p.id}
                    label={p.school}
                    meta={compare.includes(p.id) ? 'Comparing' : 'Tap to compare'}
                    selected={compare.includes(p.id)}
                    title={p.program}
                    onClick={() =>
                      setCompare((ids) => (ids.includes(p.id) ? ids.filter((x) => x !== p.id) : [...ids, p.id]))
                    }
                  />
                ))}
              </CardGrid>
            </>
          )}
          {compare.length === 0 ? (
            <p style={{ ...body, ...secondLine(), marginTop: 'var(--sp-5)' }}>Choose one or more above.</p>
          ) : (
            <div style={{ overflowX: 'auto', marginTop: 'var(--sp-6)' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 'var(--type-sm)' }}>
                <thead>
                  <tr>
                    {['Program', 'Period', 'Tuition', 'Living', 'Other', 'Grants', 'Net'].map((h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: 'left',
                          padding: 'var(--sp-3)',
                          borderBottom: '1px solid var(--app-line)',
                          whiteSpace: 'nowrap',
                          ...secondLine(),
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lib.value.programs
                    .filter((p) => compare.includes(p.id))
                    .map((p) => (
                      <tr key={p.id}>
                        <th style={{ textAlign: 'left', padding: 'var(--sp-3)', fontWeight: 'inherit' }}>
                          {p.school}
                        </th>
                        <td style={{ padding: 'var(--sp-3)', whiteSpace: 'nowrap' }}>
                          {p.period} / {p.currency}
                        </td>
                        {([p.tuition, p.living, p.other, p.aid, netProgramCost(p)] as const).map((n, i) => (
                          <td key={i} style={{ padding: 'var(--sp-3)', whiteSpace: 'nowrap' }}>
                            {n.toFixed(2)}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'profile' && (
        <>
          <p style={{ ...line, marginBlock: '0 var(--sp-5)', textWrap: 'pretty' }}>
            The facts you keep having to write out. Nothing here is submitted anywhere or shared with
            family on its own.
          </p>
          {(
            [
              ['name', 'Name for drafts'],
              ['education', 'Education so far'],
              ['experience', 'What you have actually done'],
              ['goals', 'Goals and interests'],
            ] as const
          ).map(([k, label]) => (
            <label key={k} style={field}>
              <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>{label}</span>
              <textarea
                rows={k === 'name' ? 1 : 5}
                maxLength={10_000}
                value={lib.value.profile[k]}
                onChange={(e) => lib.update((old) => ({ ...old, profile: { ...old.profile, [k]: e.target.value } }))}
                style={input}
              />
            </label>
          ))}
          <ActionButton
            onClick={() =>
              write(
                'Reusable application profile',
                Object.entries(lib.value.profile)
                  .map(([k, v]) => `## ${k}\n${v}`)
                  .join('\n\n'),
              )
            }
          >
            Take a copy into Write
          </ActionButton>
        </>
      )}

      {tab === 'milestones' && (
        <>
          <label style={field}>
            <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Template</span>
            <select value={template} onChange={(e) => setTemplate(e.target.value)} style={input}>
              {Object.keys(PATHWAY_TEMPLATES).map((k) => (
                <option key={k}>{k}</option>
              ))}
            </select>
          </label>
          <ActionButton
            onClick={() => {
              const p = newPathwayProject(template);
              if (lib.update((old) => ({ ...old, projects: [p, ...old.projects] }))) setProjectId(p.id);
            }}
          >
            Create workflow
          </ActionButton>

          {lib.value.projects.length > 0 && (
            <>
              <SectionLabel style={{ marginBlock: 'var(--sp-6) var(--sp-4)' }}>Yours</SectionLabel>
              <CardGrid min={150}>
                {lib.value.projects.map((p) => (
                  <GridCard
                    key={p.id}
                    label={p.title}
                    meta={`${p.steps.filter((s) => s.done).length} of ${p.steps.length}`}
                    selected={p.id === projectId}
                    onClick={() => setProjectId(p.id)}
                  />
                ))}
              </CardGrid>
            </>
          )}

          {project && (
            <>
              <label style={{ ...field, marginTop: 'var(--sp-6)' }}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Title</span>
                <input
                  maxLength={200}
                  value={project.title}
                  onChange={(e) => patchProject({ title: e.target.value })}
                  style={input}
                />
              </label>
              <p style={{ ...line, marginBlock: '0 var(--sp-5)', textWrap: 'pretty' }}>
                Your own checklist. Ticking a step issues no signature, approves no research, and changes no
                official record.
              </p>
              <label style={field}>
                <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Notes</span>
                <textarea
                  rows={4}
                  maxLength={20_000}
                  value={project.notes}
                  onChange={(e) => patchProject({ notes: e.target.value })}
                  style={input}
                />
              </label>

              {project.steps.map((s, index) => (
                <details
                  key={s.id}
                  style={{
                    borderBottom: '1px solid var(--app-line)',
                    paddingBlock: 'var(--sp-3)',
                  }}
                >
                  <summary style={{ ...body, cursor: 'pointer', paddingBlock: 'var(--sp-2)' }}>
                    {index + 1}. {s.title} · {s.done ? 'Prepared' : 'To do'}
                  </summary>
                  <label style={{ ...field, marginTop: 'var(--sp-4)' }}>
                    <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Step</span>
                    <input
                      maxLength={300}
                      value={s.title}
                      onChange={(e) =>
                        patchProject({ steps: project.steps.map((x) => (x.id === s.id ? { ...x, title: e.target.value } : x)) })
                      }
                      style={input}
                    />
                  </label>
                  <label style={field}>
                    <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Who to ask</span>
                    <input
                      maxLength={200}
                      value={s.owner}
                      onChange={(e) =>
                        patchProject({ steps: project.steps.map((x) => (x.id === s.id ? { ...x, owner: e.target.value } : x)) })
                      }
                      style={input}
                    />
                  </label>
                  <label style={field}>
                    <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>By when</span>
                    <input
                      type="date"
                      value={s.due}
                      onChange={(e) =>
                        patchProject({ steps: project.steps.map((x) => (x.id === s.id ? { ...x, due: e.target.value } : x)) })
                      }
                      style={input}
                    />
                  </label>
                  <label style={field}>
                    <span style={{ fontSize: 'var(--type-sm)', ...secondLine() }}>Notes and references</span>
                    <textarea
                      rows={3}
                      maxLength={5000}
                      value={s.notes}
                      onChange={(e) =>
                        patchProject({ steps: project.steps.map((x) => (x.id === s.id ? { ...x, notes: e.target.value } : x)) })
                      }
                      style={input}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-4)', ...body }}>
                    <input
                      type="checkbox"
                      checked={s.done}
                      onChange={(e) =>
                        patchProject(
                          { steps: project.steps.map((x) => (x.id === s.id ? { ...x, done: e.target.checked } : x)) },
                          `${s.title}: you marked this ${e.target.checked ? 'prepared' : 'to do'}`,
                        )
                      }
                    />
                    <span>I have prepared this</span>
                  </label>
                </details>
              ))}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!stepTitle.trim()) return;
                  const ok = patchProject({
                    steps: [
                      ...project.steps,
                      { id: crypto.randomUUID(), title: stepTitle.trim(), owner: '', due: '', done: false, notes: '' },
                    ],
                  });
                  if (ok) setStepTitle('');
                }}
                style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-5)' }}
              >
                <input
                  aria-label="Add a step"
                  placeholder="Something else this needs"
                  maxLength={300}
                  value={stepTitle}
                  onChange={(e) => setStepTitle(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-secondary">
                  Add
                </button>
              </form>

              <ActionButton
                onClick={() =>
                  write(
                    project.title,
                    [
                      `# ${project.title}`,
                      project.notes,
                      '',
                      project.steps
                        .map((s) =>
                          [
                            `## ${s.title}`,
                            `Who: ${s.owner || 'not decided'}`,
                            `By: ${s.due || 'no date'}`,
                            `You marked it: ${s.done ? 'prepared' : 'to do'}`,
                            s.notes,
                          ].join('\n'),
                        )
                        .join('\n\n'),
                    ].join('\n'),
                  )
                }
                style={{ marginTop: 'var(--sp-5)' }}
              >
                Take a copy into Write
              </ActionButton>

              {project.history.length > 0 && (
                <details style={{ marginTop: 'var(--sp-5)' }}>
                  <summary style={{ ...line, cursor: 'pointer' }}>What you changed</summary>
                  <ul style={{ margin: 'var(--sp-3) 0 0', paddingLeft: 'var(--sp-7)' }}>
                    {project.history.map((h, i) => (
                      <li key={i} style={{ ...line, paddingBlock: 'var(--sp-2)' }}>
                        {new Date(h.at).toLocaleString()} · {h.message}
                      </li>
                    ))}
                  </ul>
                </details>
              )}
            </>
          )}
        </>
      )}

      {tab === 'backup' && (
        <>
          <p style={{ ...body, marginBlock: '0 var(--sp-5)', textWrap: 'pretty' }}>
            The stage selector changes what this screen shows you. It creates no account, removes no
            coursework, and an export is a planning record rather than a transcript or a credential.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-4)', marginBottom: 'var(--sp-5)' }}>
            <ActionButton
              onClick={() =>
                download({
                  name: 'Semester Pathway backup.json',
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
                  name: 'Semester program catalog template.json',
                  body: JSON.stringify(
                    {
                      version: 1,
                      programs: [
                        { ...newProgram(), school: 'Example institution — replace', program: 'Example — replace' },
                      ],
                    },
                    null,
                    2,
                  ),
                  mime: 'application/json',
                })
              }
              style={{ flex: '1 1 auto' }}
            >
              Catalog template
            </ActionButton>
            {lib.blocked && (
              <ActionButton
                onClick={() =>
                  download({ name: 'Pathway recovery.json', body: lib.recovery(), mime: 'application/json' })
                }
                style={{ flex: '1 1 auto' }}
              >
                Recovery copy
              </ActionButton>
            )}
          </div>
          <FilePick
            accept=".json"
            multiple={false}
            onPick={async (files) => {
              try {
                const f = files[0];
                if (!f) return;
                if (f.size > 3_000_000) throw new Error('Use a backup smaller than 3 MB.');
                const got = readPathway(JSON.parse(await f.text()));
                if (
                  lib.value.programs.length ||
                  lib.value.projects.length ||
                  Object.values(lib.value.profile).some(Boolean)
                ) {
                  throw new Error('Restore into an empty pathway workspace, so nothing you have is replaced.');
                }
                if (lib.update(got)) setNotice('Restored. No official status changed, because none can.');
              } catch (e) {
                setNotice((e as Error).message);
              }
            }}
          >
            Restore a backup
          </FilePick>
          <div style={{ marginTop: 'var(--sp-4)' }}>
            <FilePick
              accept=".json"
              multiple={false}
              onPick={async (files) => {
                try {
                  const f = files[0];
                  if (!f) return;
                  if (f.size > 2_000_000) throw new Error('Use a catalog under 2 MB.');
                  const raw = JSON.parse(await f.text());
                  const rows = readPrograms(Array.isArray(raw) ? raw : raw.programs);
                  // Fresh ids, so a catalog adds rather than replacing.
                  const ok = lib.update((old) => ({
                    ...old,
                    programs: [...old.programs, ...rows.map((p) => ({ ...p, id: crypto.randomUUID() }))],
                  }));
                  if (ok) setNotice('Imported as unverified planning copies.');
                } catch (e) {
                  setNotice((e as Error).message);
                }
              }}
            >
              Import a program catalog
            </FilePick>
          </div>
        </>
      )}
    </Page>
  );
}
