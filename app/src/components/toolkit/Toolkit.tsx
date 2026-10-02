import { useMemo, useState } from 'react';
import { useNow } from '../../state/store';
import type { CoursePolicy, Screen } from '../../lib/types';
import { download } from '../../lib/deliver';
import { BOUNDARIES, entitle, SUBJECTS, subjectOf, toolsFor, UNIVERSAL, type Subject } from '../../lib/toolkit/catalog';
import { interpretationGaps } from '../../lib/toolkit/data';
import { on, TOOLKIT_FLAGS, type ToolkitFlags } from '../../lib/toolkit/flags';
import { card, fromCourse, redirect, STATE_LABEL, usageLabel } from '../../lib/toolkit/policy';
import { courseLayers, type CoursePublication } from '../../lib/courserules';
import { GOALS, labelOf, recommend, subjectFor, type Goal, type Recommendation } from '../../lib/toolkit/recommend';
import { boundaryNotice } from '../../lib/toolkit/safety';
import { progress, TEMPLATE_IDS, TEMPLATES, type TemplateId } from '../../lib/toolkit/templates';
import { TabList } from '../ui';
import { ErrorState } from '../unity/States';
import { AssignmentPanel, RubricPanel } from './AssignmentPanel';
import { DataPanel } from './DataPanel';
import { DisclosurePanel } from './DisclosurePanel';
import { ResearchPanel } from './ResearchPanel';
import { useToolkit, useToolkitData } from './store';

/**
 * The AI Toolkit: start from the course and the goal, not from a chat box.
 *
 * Every section is the student's own work, kept on this device. The toolkit
 * generates nothing in this slice — the workspaces structure the work, check
 * it against the rules in `lib/toolkit/`, and hand off to the Semester
 * screens that already exist for the parts they do (analysis, study guides,
 * documents). That is deliberate: the brief's first rule is "not a generic
 * answer generator", and the surest way to keep that is to ship the
 * structure first and add generation later behind its own review.
 */

export interface ToolkitCourse {
  code: string;
  name: string;
  ai?: CoursePolicy;
}

type Section = 'start' | 'assignment' | 'research' | 'data' | 'rubric' | 'policy' | 'catalog';

export function Toolkit({
  courses,
  accountId,
  onOpen,
  onClose,
  flags = TOOLKIT_FLAGS,
  now: nowProp,
  published,
}: {
  courses: readonly ToolkitCourse[];
  /** The signed-in account, whose own toolkit this is. Undefined is "this device, nobody signed in". */
  accountId?: string;
  onOpen: (screen: Screen) => void;
  onClose: () => void;
  flags?: ToolkitFlags;
  now?: Date;
  /** What instructors published for these courses (Course Studio), keyed by normalised code. */
  published?: Record<string, CoursePublication>;
}) {
  const clock = useNow();
  const now = nowProp ?? clock;
  const library = useToolkit(accountId);
  const dataLibrary = useToolkitData(accountId);
  const store = library.value;
  const [section, setSection] = useState<Section>('start');
  const [goal, setGoal] = useState<Goal | null>(null);
  const [courseCode, setCourseCode] = useState(courses[0]?.code ?? '');
  const [subjectId, setSubjectId] = useState('');
  const [assignment, setAssignment] = useState<TemplateId | ''>('');
  const [due, setDue] = useState('');
  const [topic, setTopic] = useState('');
  const [openTemplate, setOpenTemplate] = useState<TemplateId | null>(null);

  const course = courses.find((c) => c.code === courseCode);
  const layers = useMemo(() => courseLayers(course?.code ?? '', course?.ai, published ?? {}), [course, published]);
  const subject = subjectFor({ courseCode, subjectId });
  const fromCode = subjectOf(courseCode);
  const dueInDays = due ? Math.round((Date.parse(`${due}T12:00:00`) - now.getTime()) / 86_400_000) : undefined;
  const notice = topic.trim() ? boundaryNotice(topic) : null;

  const tabs: { id: Section; label: string }[] = [
    { id: 'start', label: 'Start' },
    { id: 'assignment', label: 'Assignments' },
    ...(on(flags.researchStudio) ? [{ id: 'research' as const, label: 'Research Studio' }] : []),
    ...(on(flags.dataStudio) ? [{ id: 'data' as const, label: 'Data Studio' }] : []),
    { id: 'rubric', label: 'Rubric self-check' },
    { id: 'policy', label: 'AI-use policy' },
    { id: 'catalog', label: 'All tools' },
  ];

  const reachable = (r: Recommendation) =>
    (r.workspace.opens !== 'research' || on(flags.researchStudio)) &&
    (r.workspace.opens !== 'data' || on(flags.dataStudio)) &&
    (!r.workspace.id.startsWith('subject-') || on(flags.subjectWorkbenches));

  const recs = goal
    ? recommend({ goal, courseCode, subjectId, assignment: assignment || undefined, dueInDays, hidden: store.hidden, showLess: store.showLess }).filter(reachable)
    : [];

  const open = (r: Recommendation) => {
    const w = r.workspace;
    if (w.opens === 'screen' && w.screen) onOpen(w.screen as Screen);
    else if (w.opens === 'assignment') {
      setOpenTemplate(w.template ?? null);
      setSection('assignment');
    } else if (w.opens === 'disclosure') setSection('policy');
    else setSection(w.opens as Section);
  };

  const hide = (id: string) => library.update((s) => ({ ...s, hidden: [...new Set([...s.hidden, id])] }));

  const today = [
    ...store.workspaces
      .map((w) => ({ w, p: progress(w) }))
      .filter(({ p }) => p.next)
      .slice(0, 3)
      .map(({ w, p }) => ({ key: `ws-${w.id}`, text: `${w.title}: ${p.next!.label}`, go: () => setSection('assignment') })),
    ...(on(flags.researchStudio)
      ? store.research
          .map((r) => ({ r, n: r.evidence.filter((e) => !e.verified && e.screening !== 'exclude').length }))
          .filter(({ n }) => n)
          .slice(0, 2)
          .map(({ r, n }) => ({ key: `rs-${r.id}`, text: `Verify ${n} source${n === 1 ? '' : 's'} for “${r.question || 'your research question'}”`, go: () => setSection('research') }))
      : []),
    ...(on(flags.dataStudio)
      ? dataLibrary.value
          .filter((p) => interpretationGaps(p).length)
          .slice(0, 2)
          .map((p) => ({ key: `ds-${p.id}`, text: `Finish the interpretation for ${p.name}`, go: () => setSection('data') }))
      : []),
  ].slice(0, 5);

  return (
    <div className="toolkit portal-workspace">
      <div className="portal-heading">
        <div>
          <span className="portal-eyebrow">AI Toolkit · {flags.aiToolkit === 'production' ? 'On this device' : 'Preview'}</span>
          <h2>What are you working on?</h2>
          <p>Start from your course and your goal. Everything here stays on this device and is private to you.</p>
        </div>
        <button onClick={onClose}>← Back to study</button>
      </div>

      {library.error ? (
        <ErrorState
          title="Could not save on this device"
          body={library.error}
          recover={{
            label: 'Download recovery copy',
            run: () => download({ name: 'Semester toolkit recovery.json', body: library.recovery(), mime: 'application/json' }),
          }}
        />
      ) : null}

      <TabList label="Toolkit sections" className="portal-tabs" tabs={tabs} value={section} onChange={setSection} />

      {section === 'start' && (
        <>
          <section className="portal-panel" aria-labelledby="toolkit-goal">
            <h3 id="toolkit-goal">Your goal</h3>
            <div className="portal-actions" role="group" aria-label="Goal">
              {GOALS.map(([id, label]) => (
                <button key={id} aria-pressed={goal === id} className={goal === id ? 'portal-primary' : undefined} onClick={() => setGoal(id)}>
                  {label}
                </button>
              ))}
            </div>
            <div className="portal-form-grid">
              <label>
                Course or project
                <select className="input" value={courseCode} onChange={(e) => setCourseCode(e.target.value)}>
                  {courses.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.code} · {c.name}
                    </option>
                  ))}
                  <option value="">Independent project</option>
                </select>
              </label>
              {fromCode ? (
                <p className="portal-muted">
                  Subject: <strong>{fromCode.name}</strong>, from the course code {courseCode.trim()}.
                </p>
              ) : (
                <label>
                  Subject (choose one)
                  <select className="input" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>
                    <option value="">No subject</option>
                    {SUBJECTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Assignment type (optional)
                <select className="input" value={assignment} onChange={(e) => setAssignment(e.target.value as TemplateId | '')}>
                  <option value="">None</option>
                  {TEMPLATE_IDS.map((id) => (
                    <option key={id} value={id}>
                      {TEMPLATES[id].name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Due date (optional)
                <input className="input" type="date" value={due} onChange={(e) => setDue(e.target.value)} />
              </label>
              <label>
                Topic (optional)
                <input className="input" value={topic} maxLength={300} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. sleep and memory in first-year students" />
              </label>
            </div>
            {notice && (
              <p className="portal-warning" role="status">
                {notice.text}
              </p>
            )}
          </section>

          <section className="portal-panel" aria-labelledby="toolkit-recs">
            <h3 id="toolkit-recs">Recommended workspace</h3>
            {!goal ? (
              <p className="portal-muted">Choose a goal above. Recommendations use only your goal, course, assignment type, due date and choices here — never grades, health, location or anything inferred about you.</p>
            ) : recs.length ? (
              <ul className="toolkit-recs">
                {recs.map((r) => (
                  <li key={r.workspace.id}>
                    <strong>{r.workspace.name}</strong>
                    <details>
                      <summary>Why this workspace?</summary>
                      <ul>
                        {r.why.map((w) => (
                          <li key={w}>{w}</li>
                        ))}
                      </ul>
                    </details>
                    <div className="portal-actions">
                      <button className="portal-primary" onClick={() => open(r)}>
                        Open {r.workspace.name}
                      </button>
                      <button onClick={() => hide(r.workspace.id)} aria-label={`Hide ${r.workspace.name}`}>
                        Hide
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p>Nothing left to recommend for “{labelOf(goal)}” — you hid everything. Browse all tools instead.</p>
            )}
            <div className="portal-actions">
              <button aria-pressed={store.showLess} onClick={() => library.update((s) => ({ ...s, showLess: !s.showLess }))}>
                {store.showLess ? 'Show more suggestions' : 'Show fewer suggestions'}
              </button>
              {store.hidden.length > 0 && <button onClick={() => library.update((s) => ({ ...s, hidden: [] }))}>Show hidden ({store.hidden.length})</button>}
              <button onClick={() => setSection('catalog')}>Browse all tools</button>
            </div>
          </section>

          <section className="portal-panel" aria-labelledby="toolkit-today">
            <h3 id="toolkit-today">Today’s work</h3>
            {today.length ? (
              <ul>
                {today.map((t) => (
                  <li key={t.key}>
                    <button onClick={t.go}>{t.text}</button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="portal-muted">Nothing in progress. Start a workspace and its next stage will show here.</p>
            )}
          </section>

          <section className="portal-panel" aria-labelledby="toolkit-help">
            <h3 id="toolkit-help">Accessibility, focus and help</h3>
            <div className="portal-actions">
              <button onClick={() => { setOpenTemplate('office_hours'); setSection('assignment'); }}>Prepare office-hours questions</button>
              <button onClick={() => onOpen('behind')}>Plan a way back after missed work</button>
              <button onClick={() => onOpen('settings')}>Text size, contrast and motion</button>
              <button onClick={() => onOpen('links')}>Your school’s help links</button>
            </div>
          </section>
        </>
      )}

      {section === 'assignment' && (
        <AssignmentPanel
          key={openTemplate ?? 'none'}
          library={library}
          courseCode={courseCode}
          layers={layers}
          initialTemplate={openTemplate}
          now={now}
          onLeave={onClose}
        />
      )}
      {section === 'research' && on(flags.researchStudio) && <ResearchPanel library={library} />}
      {section === 'data' && on(flags.dataStudio) && <DataPanel library={dataLibrary} uploadOn={on(flags.dataUpload)} layers={layers} now={now} onOpen={onOpen} />}
      {section === 'rubric' && <RubricPanel />}
      {section === 'policy' && (
        <>
          <PolicyCard course={course} layers={layers} onEdit={() => onOpen('edit')} />
          {on(flags.aiDisclosure) && <DisclosurePanel library={library} course={course?.code ?? ''} />}
        </>
      )}
      {section === 'catalog' && <Catalog subject={subject} workbenchesOn={on(flags.subjectWorkbenches)} onOpen={onOpen} onSection={(s) => setSection(s)} />}
    </div>
  );
}

function PolicyCard({ course, layers, onEdit }: { course?: ToolkitCourse; layers: ReturnType<typeof fromCourse>[]; onEdit: () => void }) {
  const c = card(layers);
  const from = layers.find(Boolean);
  const list = (items: typeof c.all) => (
    <ul>
      {items.map((r) => (
        <li key={r.use}>{usageLabel(r.use)}</li>
      ))}
    </ul>
  );
  return (
    <section className="portal-panel" aria-labelledby="toolkit-policy">
      <h3 id="toolkit-policy">AI use for {course ? course.code : 'this project'}</h3>
      {from?.by === 'instructor' ? (
        <p className="portal-muted">
          Set by your instructor{from.lastVerified ? ` · published ${from.lastVerified}` : ''}
          {from.effective ? ` · in effect from ${from.effective}` : ''}.{from.text ? ` “${from.text}”` : ''}{' '}
          {from.link && (
            <a href={from.link} target="_blank" rel="noreferrer noopener">
              The syllabus
            </a>
          )}
        </p>
      ) : from ? (
        <p className="portal-muted">
          Source: {from.by === 'student-record' ? 'your own record of the syllabus — not verified by the instructor' : from.by}.
          {from.text ? ` “${from.text}”` : ''} No link or effective date is on file.
        </p>
      ) : (
        <p className="portal-warning">Policy unavailable — ask your instructor. Semester does not assume AI is allowed when nothing is recorded.</p>
      )}
      {c.allowed.length > 0 && (
        <>
          <h4>{STATE_LABEL.allowed}</h4>
          {list(c.allowed)}
        </>
      )}
      {c.disclose.length > 0 && (
        <>
          <h4>Requires disclosure</h4>
          {list(c.disclose)}
        </>
      )}
      {c.prohibited.length > 0 && (
        <>
          <h4>{STATE_LABEL.prohibited}</h4>
          {list(c.prohibited)}
          <p>Instead, you can:</p>
          <ul>
            {redirect(layers).map((r) => (
              <li key={r.label}>{r.label}</li>
            ))}
          </ul>
        </>
      )}
      {c.unavailable.length > 0 && (
        <>
          <h4>{from ? STATE_LABEL.unavailable : 'Uses with no policy on file'}</h4>
          {list(c.unavailable)}
        </>
      )}
      <div className="portal-actions">
        <button onClick={onEdit}>Record or update the course policy</button>
      </div>
    </section>
  );
}

function Catalog({
  subject,
  workbenchesOn,
  onOpen,
  onSection,
}: {
  subject?: Subject;
  workbenchesOn: boolean;
  onOpen: (s: Screen) => void;
  onSection: (s: Section) => void;
}) {
  const [picked, setPicked] = useState(subject?.id ?? '');
  const chosen = SUBJECTS.find((s) => s.id === picked);
  const tools = workbenchesOn && chosen ? toolsFor([chosen]) : [...UNIVERSAL];
  const approved = new Set<string>();
  return (
    <section className="portal-panel" aria-labelledby="toolkit-catalog">
      <h3 id="toolkit-catalog">All tools</h3>
      {workbenchesOn ? (
        <label>
          Subject workbench
          <select className="input" value={picked} onChange={(e) => setPicked(e.target.value)}>
            <option value="">Tools every subject uses</option>
            {SUBJECTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.family} · {s.name}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <p className="portal-muted">Subject workbenches are switched off here. These tools work for every subject.</p>
      )}
      <ul className="toolkit-catalog">
        {tools.map((tool) => {
          const e = entitle(tool, approved, workbenchesOn);
          return (
            <li key={tool.id}>
              <strong>{tool.name}</strong> <span className="portal-tag">{e.label}</span>
              <p>{tool.purpose}</p>
              {tool.boundary && <p className="portal-muted">{BOUNDARIES[tool.boundary]}</p>}
              {e.available ? (
                <button onClick={() => (tool.screen ? onOpen(tool.screen) : onSection((tool.opens === 'disclosure' ? 'policy' : tool.opens) as Section))}>Open {tool.name}</button>
              ) : (
                <p className="portal-muted">{e.reason}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
