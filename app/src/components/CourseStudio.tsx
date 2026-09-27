import { useEffect, useState } from 'react';
import { cloudConfigured } from '../lib/cloud';
import { loadPublications, type CoursePublication, type PackItem } from '../lib/courserules';
import {
  asPublished,
  draftOf,
  history,
  myCourses,
  packProblems,
  publishGuidance,
  publishPack,
  publishRules,
  rulesProblems,
  USE_ROWS,
  type PackDraft,
  type RulesDraft,
  type Stated,
  type Version,
} from '../lib/coursestudio';
import { MODULE_FLAGS, moduleOn } from '../lib/experience-flags';
import { card, fromInstructor, STATE_LABEL, usageLabel, type Use } from '../lib/toolkit/policy';
import { useStore } from '../state/store';
import { Segmented, SectionLabel } from './ui';

/**
 * Faculty Course Studio (docs/FACULTY-COURSE-STUDIO-DESIGN.md, D-100 slice 3).
 *
 * Offered only to an account the institution has made faculty on a course
 * (F1), behind the `course_studio` flag (F6). Everything published is shown
 * first exactly as students will see it, and published on a confirmation.
 * There is nothing here about students (F5): no roster, no counts, no reads.
 */

/** A publish time on the reader's own clock, to the minute. */
function localMinute(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16).replace('T', ' ');
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

const STATE_CHOICES: readonly { value: '' | Stated; label: string }[] = [
  { value: '', label: 'Not stated' },
  { value: 'allowed', label: STATE_LABEL.allowed },
  { value: 'limited', label: STATE_LABEL.limited },
  { value: 'required', label: 'Required — disclose how you used it' },
  { value: 'prohibited', label: STATE_LABEL.prohibited },
];

/** The student card, from a draft: the same engine the student's screens use. */
export function StudentCardPreview({ rules }: { rules: RulesDraft }) {
  const layer = fromInstructor(asPublished(rules, 'the day you publish'));
  const c = card([layer]);
  const list = (items: typeof c.all) => (
    <ul>
      {items.map((r) => (
        <li key={r.use}>{usageLabel(r.use)}</li>
      ))}
    </ul>
  );
  return (
    <div className="studio-preview" aria-label="What students will see">
      <p className="sharing-meta">What students will see</p>
      {!layer ? (
        <p>Nothing: these rules say nothing, so each student sees whatever they recorded from the syllabus.</p>
      ) : (
        <>
          <p className="sharing-meta">
            Set by your instructor · published on the day you publish{rules.effective ? ` · in effect from ${rules.effective}` : ''}.
            {rules.words.trim() ? ` “${rules.words.trim()}”` : ''}
          </p>
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
            </>
          )}
          {c.unavailable.length > 0 && (
            <>
              <h4>Not stated — left to each student’s own record of the syllabus</h4>
              {list(c.unavailable)}
            </>
          )}
        </>
      )}
    </div>
  );
}

function Confirm({ what, busy, onYes, onNo }: { what: string; busy: boolean; onYes: () => void; onNo: () => void }) {
  return (
    <div className="family-confirm">
      <p>{what}</p>
      <p className="sharing-meta">Students at your school see it from now, dated today. A published version is never changed; to change it, publish a new one.</p>
      <div className="portal-actions">
        <button type="button" className="btn btn-primary" disabled={busy} onClick={onYes}>
          Publish
        </button>
        <button type="button" className="btn btn-ghost" onClick={onNo}>
          Keep editing
        </button>
      </div>
    </div>
  );
}

function RulesTab({ code, term, current, onPublished }: { code: string; term: string; current?: CoursePublication; onPublished: (said: string) => void }) {
  const [draft, setDraft] = useState<RulesDraft>(() => draftOf(current?.rules));
  const [finalOk, setFinalOk] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const problems = rulesProblems(draft, finalOk);
  const fa = draft.uses['final-answers'];
  const setUse = (use: Use, value: '' | Stated) =>
    setDraft((d) => {
      const uses = { ...d.uses };
      if (value) uses[use] = value;
      else delete uses[use];
      return { ...d, uses };
    });

  return (
    <section aria-label="AI rules">
      <label className="family-claim">
        <span className="sharing-meta">For every use you do not name below</span>
        <select className="input" value={draft.blanket ?? ''} onChange={(e) => setDraft((d) => ({ ...d, blanket: (e.target.value || null) as Stated | null }))}>
          {STATE_CHOICES.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="studio-uses">
        <legend className="sharing-meta">Named uses — a named use beats the line above</legend>
        {USE_ROWS.map(([use, label]) => (
          <label key={use} className="studio-use">
            <span>{label}</span>
            <select className="input" value={draft.uses[use] ?? ''} onChange={(e) => setUse(use, e.target.value as '' | Stated)}>
              {STATE_CHOICES.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.value ? o.label : 'Follow the line above'}
                </option>
              ))}
            </select>
          </label>
        ))}
      </fieldset>
      {(fa === 'allowed' || fa === 'limited' || fa === 'required') && (
        <label className="studio-use">
          <input type="checkbox" checked={finalOk} onChange={(e) => setFinalOk(e.target.checked)} />
          <span>I mean it: AI may produce final answers for assessments in this course.</span>
        </label>
      )}
      <label className="family-claim">
        <span className="sharing-meta">In your own words (shown to students)</span>
        <textarea className="input" rows={3} maxLength={4000} value={draft.words} onChange={(e) => setDraft((d) => ({ ...d, words: e.target.value }))} />
      </label>
      <label className="family-claim">
        <span className="sharing-meta">Syllabus link (optional)</span>
        <input className="input" type="url" maxLength={500} value={draft.link} onChange={(e) => setDraft((d) => ({ ...d, link: e.target.value }))} />
      </label>
      <label className="family-claim">
        <span className="sharing-meta">In effect from (optional)</span>
        <input className="input" type="date" value={draft.effective} onChange={(e) => setDraft((d) => ({ ...d, effective: e.target.value }))} />
      </label>
      <StudentCardPreview rules={draft} />
      {problems.length > 0 && (
        <ul className="sharing-problems" aria-label="Before these rules can be published" aria-live="polite">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {confirming ? (
        <Confirm
          what={`Publish these AI rules for ${code}, ${term}?`}
          busy={busy}
          onNo={() => setConfirming(false)}
          onYes={async () => {
            setBusy(true);
            setSaid('');
            try {
              const v = await publishRules(code, term, draft);
              setConfirming(false);
              onPublished(`AI rules published for ${code} as version ${v}.`);
            } catch (e) {
              setSaid(`Not published: ${(e as Error).message}`);
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : (
        <button type="button" className="btn btn-secondary" disabled={problems.length > 0} onClick={() => setConfirming(true)}>
          Publish these rules
        </button>
      )}
      {said && <p role="alert" className="sharing-lead">{said}</p>}
    </section>
  );
}

function GuidanceTab({ code, term, current, onPublished }: { code: string; term: string; current?: CoursePublication; onPublished: (said: string) => void }) {
  const [body, setBody] = useState(current?.guidance?.body ?? '');
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const withdrawing = !body.trim();
  return (
    <section aria-label="Guidance">
      <label className="family-claim">
        <span className="sharing-meta">How to study for this course, and what to try before asking for help</span>
        <textarea className="input" rows={5} maxLength={4000} value={body} onChange={(e) => setBody(e.target.value)} />
      </label>
      <div className="studio-preview" aria-label="What students will see">
        <p className="sharing-meta">What students will see</p>
        {withdrawing ? <p>No guidance.</p> : (
          <div className="studio-guidance">
            <strong>From your instructor · published on the day you publish</strong>
            <p>{body.trim()}</p>
          </div>
        )}
      </div>
      {confirming ? (
        <Confirm
          what={withdrawing ? `Withdraw the guidance for ${code}, ${term}?` : `Publish this guidance for ${code}, ${term}?`}
          busy={busy}
          onNo={() => setConfirming(false)}
          onYes={async () => {
            setBusy(true);
            setSaid('');
            try {
              const v = await publishGuidance(code, term, body);
              setConfirming(false);
              onPublished(withdrawing ? `Guidance withdrawn for ${code} (version ${v}).` : `Guidance published for ${code} as version ${v}.`);
            } catch (e) {
              setSaid(`Not published: ${(e as Error).message}`);
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : (
        <button type="button" className="btn btn-secondary" disabled={withdrawing && !current?.guidance} onClick={() => setConfirming(true)}>
          {withdrawing ? 'Withdraw the guidance' : 'Publish this guidance'}
        </button>
      )}
      {said && <p role="alert" className="sharing-lead">{said}</p>}
    </section>
  );
}

const AUTHORITY_LABEL: Record<PackItem['authority'], string> = {
  authoritative: 'Authoritative',
  supplemental: 'Supplemental',
  prohibited: 'Do not use',
};

const blankItem = (): PackItem => ({ title: '', citation: '', link: '', authority: 'supplemental' });

function PacksTab({ code, term, current, onPublished }: { code: string; term: string; current?: CoursePublication; onPublished: (said: string) => void }) {
  const [draft, setDraft] = useState<PackDraft | null>(null);
  const [confirming, setConfirming] = useState<'publish' | 'retire' | null>(null);
  const [busy, setBusy] = useState(false);
  const [said, setSaid] = useState('');
  const packs = current?.packs ?? [];
  const setItem = (n: number, patch: Partial<PackItem>) => setDraft((d) => d && { ...d, items: d.items.map((i, k) => (k === n ? { ...i, ...patch } : i)) });
  const move = (n: number, by: number) =>
    setDraft((d) => {
      if (!d || n + by < 0 || n + by >= d.items.length) return d;
      const items = [...d.items];
      [items[n], items[n + by]] = [items[n + by], items[n]];
      return { ...d, items };
    });
  const problems = draft ? packProblems(draft) : [];

  const publish = async (retire: boolean) => {
    if (!draft) return;
    setBusy(true);
    setSaid('');
    try {
      await publishPack(code, term, draft, retire);
      setConfirming(null);
      setDraft(null);
      onPublished(retire ? `“${draft.title.trim()}” retired.` : `“${draft.title.trim()}” published.`);
    } catch (e) {
      setSaid(`Not published: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (!draft) {
    return (
      <section aria-label="Study packs">
        {packs.length === 0 ? <p className="sharing-lead">No packs for {code} this term.</p> : (
          <ul className="sharing-list">
            {packs.map((p) => (
              <li key={p.id}>
                <strong>{p.title}</strong>
                <div className="sharing-meta">
                  {p.items.length} {p.items.length === 1 ? 'reference' : 'references'} · published {p.published}
                </div>
                <button type="button" className="btn btn-ghost" onClick={() => setDraft({ id: p.id, title: p.title, note: p.note, items: p.items })}>
                  Edit {p.title}
                </button>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="btn btn-secondary" onClick={() => setDraft({ id: null, title: '', note: '', items: [blankItem()] })}>
          New pack
        </button>
      </section>
    );
  }

  return (
    <section aria-label="Study pack">
      <label className="family-claim">
        <span className="sharing-meta">Pack name</span>
        <input className="input" maxLength={120} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
      </label>
      <label className="family-claim">
        <span className="sharing-meta">Note for students</span>
        <textarea className="input" rows={3} maxLength={2000} value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} />
      </label>
      <p className="sharing-meta">References — links and citations, not files. Students open them where they already live.</p>
      <ol className="studio-items">
        {draft.items.map((i, n) => (
          <li key={n}>
            <label className="family-claim">
              <span className="sharing-meta">Title</span>
              <input className="input" maxLength={200} value={i.title} onChange={(e) => setItem(n, { title: e.target.value })} />
            </label>
            <label className="family-claim">
              <span className="sharing-meta">Citation (optional)</span>
              <input className="input" maxLength={200} value={i.citation} onChange={(e) => setItem(n, { citation: e.target.value })} />
            </label>
            <label className="family-claim">
              <span className="sharing-meta">Link (optional)</span>
              <input className="input" type="url" maxLength={500} value={i.link} onChange={(e) => setItem(n, { link: e.target.value })} />
            </label>
            <label className="family-claim">
              <span className="sharing-meta">Use it as</span>
              <select className="input" value={i.authority} onChange={(e) => setItem(n, { authority: e.target.value as PackItem['authority'] })}>
                {(Object.keys(AUTHORITY_LABEL) as PackItem['authority'][]).map((a) => (
                  <option key={a} value={a}>
                    {AUTHORITY_LABEL[a]}
                  </option>
                ))}
              </select>
            </label>
            <div className="portal-actions">
              <button type="button" className="btn btn-ghost" disabled={n === 0} onClick={() => move(n, -1)}>
                Move up
              </button>
              <button type="button" className="btn btn-ghost" disabled={n === draft.items.length - 1} onClick={() => move(n, 1)}>
                Move down
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setDraft({ ...draft, items: draft.items.filter((_, k) => k !== n) })}>
                Remove
              </button>
            </div>
          </li>
        ))}
      </ol>
      <button type="button" className="btn btn-ghost" disabled={draft.items.length >= 50} onClick={() => setDraft({ ...draft, items: [...draft.items, blankItem()] })}>
        Add a reference
      </button>
      <div className="studio-preview" aria-label="What students will see">
        <p className="sharing-meta">What students will see</p>
        <strong>{draft.title.trim() || 'Untitled pack'}</strong>
        {draft.note.trim() && <p>{draft.note.trim()}</p>}
        <ul className="sharing-list">
          {draft.items.map((i, n) => (
            <li key={n}>
              {i.title.trim() || 'Untitled'} <span className="sharing-meta">· {AUTHORITY_LABEL[i.authority]}{i.citation.trim() ? ` · ${i.citation.trim()}` : ''}</span>
            </li>
          ))}
        </ul>
        {draft.items.some((i) => i.authority === 'prohibited') && (
          <p className="sharing-meta">“Do not use” references are shown to students as such, and never sent to an AI.</p>
        )}
      </div>
      {problems.length > 0 && (
        <ul className="sharing-problems" aria-label="Before this pack can be published" aria-live="polite">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {confirming ? (
        <Confirm
          what={confirming === 'retire' ? `Retire “${draft.title.trim()}” for ${code}? Students stop seeing it.` : `Publish “${draft.title.trim()}” for ${code}, ${term}?`}
          busy={busy}
          onNo={() => setConfirming(null)}
          onYes={() => void publish(confirming === 'retire')}
        />
      ) : (
        <div className="portal-actions">
          <button type="button" className="btn btn-secondary" disabled={problems.length > 0} onClick={() => setConfirming('publish')}>
            Publish this pack
          </button>
          {draft.id && (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirming('retire')}>
              Retire this pack
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
            Back to packs
          </button>
        </div>
      )}
      {said && <p role="alert" className="sharing-lead">{said}</p>}
    </section>
  );
}

function HistoryTab({ code, term, stamp }: { code: string; term: string; stamp: number }) {
  const [rows, setRows] = useState<Version[] | null>(null);
  const [said, setSaid] = useState('');
  useEffect(() => {
    let alive = true;
    void history(code, term).then(
      (r) => alive && setRows(r),
      (e: Error) => alive && setSaid(`History could not be read: ${e.message}`),
    );
    return () => {
      alive = false;
    };
  }, [code, term, stamp]);
  if (said) return <p role="alert" className="sharing-lead">{said}</p>;
  if (!rows) return <p className="sharing-lead">Reading…</p>;
  if (!rows.length) return <p className="sharing-lead">Nothing published for {code} this term.</p>;
  return (
    <ul className="sharing-list" aria-label={`Everything published for ${code}`}>
      {rows.map((v) => (
        <li key={`${v.kind}${v.label}${v.version}`}>
          <strong>
            {v.label} · version {v.version}
          </strong>
          <div className="sharing-meta">
            {localMinute(v.published)} · {v.summary}
          </div>
        </li>
      ))}
    </ul>
  );
}

type Tab = 'rules' | 'guidance' | 'packs' | 'history';
const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'rules', label: 'AI rules' },
  { id: 'guidance', label: 'Guidance' },
  { id: 'packs', label: 'Study packs' },
  { id: 'history', label: 'History' },
];

export function CourseStudio({ courses, term }: { courses: string[]; term: string }) {
  const [code, setCode] = useState(courses[0] ?? '');
  const [tab, setTab] = useState<Tab>('rules');
  const [current, setCurrent] = useState<{ key: string; value?: CoursePublication } | null>(null);
  const [stamp, setStamp] = useState(0);
  const [said, setSaid] = useState('');
  const key = `${code}:${term}:${stamp}`;

  useEffect(() => {
    if (!code) return;
    let alive = true;
    void loadPublications([code], term).then(
      (p) => alive && setCurrent({ key, value: p[code] }),
      () => alive && setCurrent({ key }),
    );
    return () => {
      alive = false;
    };
  }, [code, term, key]);

  const ready = current?.key === key;
  const published = (line: string) => {
    setSaid(line);
    setStamp((n) => n + 1);
  };

  return (
    <section aria-labelledby="course-studio-title" className="course-studio">
      <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-3)' }}>
        <span id="course-studio-title">Course Studio</span>
      </SectionLabel>
      <p className="sharing-lead">
        What you publish here is shown to students at your school in {code || 'your course'}, dated, as yours. Nothing here shows
        you anything about students.
      </p>
      {courses.length > 1 && (
        <label className="family-claim">
          <span className="sharing-meta">Course</span>
          <select className="input" value={code} onChange={(e) => { setCode(e.target.value); setSaid(''); }}>
            {courses.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      )}
      <p className="sharing-meta">
        {code} · term {term}
      </p>
      <Segmented options={TABS} value={tab} onChange={setTab} style={{ marginBlock: 'var(--sp-4)' }} />
      {said && <p role="status" className="sharing-lead">{said}</p>}
      {!ready && tab !== 'history' ? (
        <p className="sharing-lead">Reading what is published…</p>
      ) : (
        <>
          {tab === 'rules' && <RulesTab key={key} code={code} term={term} current={current?.value} onPublished={published} />}
          {tab === 'guidance' && <GuidanceTab key={key} code={code} term={term} current={current?.value} onPublished={published} />}
          {tab === 'packs' && <PacksTab key={key} code={code} term={term} current={current?.value} onPublished={published} />}
          {tab === 'history' && <HistoryTab code={code} term={term} stamp={stamp} />}
        </>
      )}
    </section>
  );
}

/**
 * The way in, on Account. Nothing at all unless the module is on, somebody
 * is signed in, and the server says they may publish for at least one course.
 */
export function CourseStudioEntry({ on = moduleOn(MODULE_FLAGS.course_studio) }: { on?: boolean }) {
  const { account, state } = useStore();
  const [courses, setCourses] = useState<{ who: string; list: string[] } | null>(null);
  const [open, setOpen] = useState(false);
  const who = on && cloudConfigured && account ? account.id : '';

  useEffect(() => {
    if (!who) return;
    let alive = true;
    void myCourses().then(
      (list) => alive && setCourses({ who, list }),
      () => alive && setCourses({ who, list: [] }),
    );
    return () => {
      alive = false;
    };
  }, [who]);

  const list = who && courses?.who === who ? courses.list : [];
  if (!list.length) return null;
  return open ? (
    <CourseStudio courses={list} term={state.term} />
  ) : (
    <section aria-labelledby="course-studio-entry" className="family-invite">
      <SectionLabel style={{ marginBlock: 'var(--sp-7) var(--sp-3)' }}>
        <span id="course-studio-entry">Teaching</span>
      </SectionLabel>
      <p className="sharing-lead">You can publish AI rules, guidance and study packs for {list.join(', ')}.</p>
      <button type="button" className="btn btn-secondary" onClick={() => setOpen(true)}>
        Open Course Studio
      </button>
    </section>
  );
}
