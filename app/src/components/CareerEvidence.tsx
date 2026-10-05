import { useId, useState } from 'react';
import type { Application } from '../lib/apply';
import type { CareerLibrary, Opportunity } from '../lib/career';
import {
  ARTIFACT_KINDS,
  EMPTY_EVIDENCE,
  evidenceKey,
  METRIC_PROMPTS,
  TEMPLATES,
  addOwnSkill,
  composeBullet,
  confirmedSkills,
  decide,
  interviewCards,
  missingPrompts,
  pitchDraft,
  readEvidence,
  renderResume,
  reviewedSkills,
  saveArtifact,
  saveBullet,
  saveEmployer,
  saveVersion,
  slug,
  type Artifact,
  type Evidence,
  type EvidenceRef,
  type TemplateId,
} from '../lib/career-evidence';
import { useDeviceLibrary } from '../lib/device-library';
import type { SkillClaim } from '../lib/skills-graph';
import { useStore } from '../state/store';
import { ConfirmDialog } from './ConfirmDialog';
import { TabList } from './ui';

const SECTIONS = [
  ['skills', 'Skills'],
  ['portfolio', 'Portfolio'],
  ['bullets', 'Bullets'],
  ['versions', 'Résumé versions'],
  ['interviews', 'Interviews'],
  ['fairs', 'Fair plans'],
] as const;
type Section = (typeof SECTIONS)[number][0];

export { evidenceKey };

/**
 * Career Evidence (`career_evidence`, Phase I), the Evidence tab in Career.
 *
 * Six small sections over one device store. What the student confirms and
 * writes is all that ever reaches a résumé: suggested skills wait for a
 * decision, bullets are made only from their answers, and every artifact and
 * added skill points at something they did. Nothing is sent or applied for.
 */
export function CareerEvidence({
  career,
  claims,
  courses,
  events,
  onWrite,
}: {
  career: CareerLibrary;
  claims: SkillClaim[];
  courses: { id: string; label: string }[];
  events: Opportunity[];
  onWrite: (title: string, body: string) => void;
}) {
  const { state, account } = useStore();
  const store = useDeviceLibrary(evidenceKey(account?.id, state.term), readEvidence, EMPTY_EVIDENCE);
  const ev = store.value;
  const [section, setSection] = useState<Section>('skills');
  const [said, setSaid] = useState('');
  const confirmed = confirmedSkills(claims, ev);
  const known = { experiences: career.experiences, courseIds: courses.map((c) => c.id), confirmed };
  const refs: EvidenceRef[] = [
    ...career.experiences.map((e) => ({ kind: 'experience' as const, id: e.id, label: `${e.title}${e.organization ? ` · ${e.organization}` : ''}` })),
    ...courses.map((c) => ({ kind: 'course' as const, id: c.id, label: c.label })),
  ];
  const apply = (change: (e: Evidence) => Evidence, ok: string) => {
    try {
      if (store.update(change)) setSaid(ok);
    } catch (e) {
      setSaid(e instanceof Error ? e.message : 'That could not be saved.');
    }
  };

  return (
    <section className="career-evidence" aria-label="Career evidence">
      <p className="portal-muted">
        Only what you confirm or write here reaches a résumé. Semester suggests skills from your courses and entries; it never adds an
        experience, employer, number or award, and it never applies anywhere for you.
      </p>
      <TabList label="Career evidence" className="portal-tabs" value={section} onChange={(id) => { setSection(id as Section); setSaid(''); }} tabs={SECTIONS.map(([id, label]) => ({ id, label }))} />
      {store.error ? <p role="alert">{store.error}</p> : null}
      {said ? <p role="status" className="balance-said">{said}</p> : null}
      {section === 'skills' ? <Skills claims={claims} ev={ev} refs={refs} apply={apply} known={known} /> : null}
      {section === 'portfolio' ? <Portfolio ev={ev} refs={refs} confirmed={confirmed} apply={apply} known={known} /> : null}
      {section === 'bullets' ? <Bullets ev={ev} career={career} apply={apply} /> : null}
      {section === 'versions' ? <Versions ev={ev} career={career} confirmed={confirmed} apply={apply} onWrite={onWrite} /> : null}
      {section === 'interviews' ? <Interviews apps={state.applications} ev={ev} apply={apply} /> : null}
      {section === 'fairs' ? <Fairs events={events} ev={ev} career={career} confirmed={confirmed} apply={apply} /> : null}
    </section>
  );
}

type Apply = (change: (e: Evidence) => Evidence, ok: string) => void;
type Known = { experiences: CareerLibrary['experiences']; courseIds: string[]; confirmed: string[] };

function Skills({ claims, ev, refs, apply, known }: { claims: SkillClaim[]; ev: Evidence; refs: EvidenceRef[]; apply: Apply; known: Known }) {
  const [renaming, setRenaming] = useState<{ key: string; name: string } | null>(null);
  const [own, setOwn] = useState({ name: '', ref: '' });
  const skills = reviewedSkills(claims, ev);
  const claimOf = (key: string) => claims.find((c) => slug(c.skill) === key)!;
  return (
    <>
      <h3 className="balance-heading">Suggested skills — yours to confirm</h3>
      {skills.length ? (
        <ul className="evidence-list">
          {skills.map((s) => (
            <li key={s.key} data-state={s.state}>
              <strong>{s.name}</strong> — {s.state === 'suggested' ? 'Suggested, not on your résumé' : s.state === 'confirmed' ? 'Confirmed' : 'Rejected'}
              {s.origin === 'added' ? ' · added by you' : ''}
              <p className="portal-muted">Because of: {s.evidence.map((e) => e.label).join('; ')}</p>
              {s.origin === 'suggested' ? (
                <div className="course-v2-actions">
                  {s.state !== 'confirmed' ? <button type="button" className="balance-button" onClick={() => apply((e) => decide(e, claimOf(s.key), 'confirmed', s.name, Date.now()), `${s.name} confirmed.`)}>Confirm</button> : null}
                  <button type="button" className="balance-button" onClick={() => setRenaming({ key: s.key, name: s.name })}>Edit name</button>
                  {s.state !== 'rejected' ? <button type="button" className="balance-button" onClick={() => apply((e) => decide(e, claimOf(s.key), 'rejected', s.name, Date.now()), `${s.name} rejected. It will not be suggested again.`)}>Reject</button> : null}
                  {s.state !== 'suggested' ? <button type="button" className="balance-button" onClick={() => apply((e) => decide(e, claimOf(s.key), null, undefined, Date.now()), `${s.name} is back to suggested.`)}>Undo</button> : null}
                </div>
              ) : null}
              {renaming?.key === s.key ? (
                <div className="portal-filter-row">
                  <label className="portal-check">
                    Skill name, in your words
                    <input className="input" maxLength={60} value={renaming.name} onChange={(e) => setRenaming({ ...renaming, name: e.target.value })} />
                  </label>
                  <button type="button" className="balance-button" onClick={() => { apply((e) => decide(e, claimOf(s.key), 'confirmed', renaming.name, Date.now()), 'Renamed and confirmed.'); setRenaming(null); }}>Save and confirm</button>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="portal-muted">No suggestions yet. They come from your courses and the entries on your résumé.</p>
      )}
      <h3 className="balance-heading">Add a skill of your own</h3>
      <div className="portal-filter-row">
        <label className="portal-check">
          Skill
          <input className="input" maxLength={60} value={own.name} onChange={(e) => setOwn({ ...own, name: e.target.value })} />
        </label>
        <label className="portal-check">
          Shown by
          <select className="input" value={own.ref} onChange={(e) => setOwn({ ...own, ref: e.target.value })}>
            <option value="">Choose a course or entry</option>
            {refs.map((r) => <option key={`${r.kind}:${r.id}`} value={`${r.kind}:${r.id}`}>{r.label}</option>)}
          </select>
        </label>
        <button
          type="button"
          className="balance-button"
          disabled={!own.name.trim() || !own.ref}
          onClick={() => {
            const r = refs.find((x) => `${x.kind}:${x.id}` === own.ref)!;
            apply((e) => addOwnSkill(e, own.name, r, known, Date.now()), `${own.name.trim()} added.`);
            setOwn({ name: '', ref: '' });
          }}
        >
          Add skill
        </button>
      </div>
    </>
  );
}

function Portfolio({ ev, refs, confirmed, apply, known }: { ev: Evidence; refs: EvidenceRef[]; confirmed: string[]; apply: Apply; known: Known }) {
  const blank = { title: '', kind: 'Project' as Artifact['kind'], date: '', description: '', url: '', ref: '', skills: [] as string[] };
  const [draft, setDraft] = useState(blank);
  const id = useId();
  return (
    <>
      <h3 className="balance-heading">Portfolio</h3>
      {ev.artifacts.length ? (
        <ul className="evidence-list">
          {ev.artifacts.map((a) => (
            <li key={a.id}>
              <strong>{a.title}</strong> — {a.kind}{a.date ? `, ${a.date}` : ''} · from {a.evidence.label}
              {a.skills.length ? <p className="portal-muted">Skills: {a.skills.join(', ')}</p> : null}
              {a.url ? <p className="portal-muted">{a.url}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p className="portal-muted">Nothing captured yet. Add a paper, project, deck or analysis you made — tied to the course or entry it came from.</p>
      )}
      <fieldset className="evidence-form" aria-labelledby={id}>
        <legend id={id}>Capture an artifact</legend>
        <label className="portal-check">Title<input className="input" maxLength={300} value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} /></label>
        <label className="portal-check">Kind<select className="input" value={draft.kind} onChange={(e) => setDraft({ ...draft, kind: e.target.value as Artifact['kind'] })}>{ARTIFACT_KINDS.map((k) => <option key={k}>{k}</option>)}</select></label>
        <label className="portal-check">Month<input className="input" type="month" value={draft.date} onChange={(e) => setDraft({ ...draft, date: e.target.value })} /></label>
        <label className="portal-check">Made in<select className="input" value={draft.ref} onChange={(e) => setDraft({ ...draft, ref: e.target.value })}><option value="">Choose a course or entry</option>{refs.map((r) => <option key={`${r.kind}:${r.id}`} value={`${r.kind}:${r.id}`}>{r.label}</option>)}</select></label>
        <label className="portal-check">Link (https, optional)<input className="input" value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} /></label>
        <label className="portal-check">What it is<textarea className="input" rows={2} maxLength={2000} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} /></label>
        {confirmed.length ? (
          <fieldset className="advisor-attach"><legend>Confirmed skills it shows</legend>
            {confirmed.map((s) => (
              <label key={s} className="portal-check"><input type="checkbox" checked={draft.skills.includes(s)} onChange={(e) => setDraft({ ...draft, skills: e.target.checked ? [...draft.skills, s] : draft.skills.filter((x) => x !== s) })} />{s}</label>
            ))}
          </fieldset>
        ) : <p className="portal-muted">Confirm skills first to tag them here.</p>}
        <button
          type="button"
          className="balance-button"
          disabled={!draft.title.trim() || !draft.ref}
          onClick={() => {
            const r = refs.find((x) => `${x.kind}:${x.id}` === draft.ref)!;
            apply((e) => saveArtifact(e, { title: draft.title, kind: draft.kind, date: draft.date, description: draft.description, url: draft.url, evidence: r, skills: draft.skills }, known), 'Artifact saved.');
            setDraft(blank);
          }}
        >
          Save artifact
        </button>
      </fieldset>
    </>
  );
}

function Bullets({ ev, career, apply }: { ev: Evidence; career: CareerLibrary; apply: Apply }) {
  const blank = { id: undefined as string | undefined, experienceId: '', did: '', people: '', tools: '', outcome: '', final: false };
  const [b, setB] = useState(blank);
  const preview = composeBullet(b);
  const missing = missingPrompts(b);
  return (
    <>
      <h3 className="balance-heading">Bullet builder</h3>
      {!career.experiences.length ? <p className="portal-muted">Add an entry on the Résumé tab first — every bullet belongs to something you did.</p> : null}
      <div className="evidence-form">
        <label className="portal-check">Entry<select className="input" value={b.experienceId} onChange={(e) => setB({ ...b, experienceId: e.target.value })}><option value="">Choose an entry</option>{career.experiences.map((x) => <option key={x.id} value={x.id}>{x.title}{x.organization ? ` · ${x.organization}` : ''}</option>)}</select></label>
        <label className="portal-check">What did you do?<input className="input" maxLength={300} placeholder="e.g. Rebuilt the club’s sign-up process" value={b.did} onChange={(e) => setB({ ...b, did: e.target.value })} /></label>
        <label className="portal-check">{METRIC_PROMPTS.people}<input className="input" inputMode="numeric" maxLength={20} placeholder="Leave blank if you don’t know" value={b.people} onChange={(e) => setB({ ...b, people: e.target.value })} /></label>
        <label className="portal-check">{METRIC_PROMPTS.tools}<input className="input" maxLength={300} value={b.tools} onChange={(e) => setB({ ...b, tools: e.target.value })} /></label>
        <label className="portal-check">{METRIC_PROMPTS.outcome}<input className="input" maxLength={300} value={b.outcome} onChange={(e) => setB({ ...b, outcome: e.target.value })} /></label>
        <p className="evidence-preview" aria-live="polite">{preview || 'Your bullet appears here as you answer.'}</p>
        {preview && missing.length ? <p className="portal-muted">Left out until you answer: {missing.join(' · ')} Semester never fills these in.</p> : null}
        <label className="portal-check"><input type="checkbox" checked={b.final} onChange={(e) => setB({ ...b, final: e.target.checked })} />Finished — use it in résumé versions</label>
        <button type="button" className="balance-button" disabled={!b.experienceId || !b.did.trim()} onClick={() => { apply((e) => saveBullet(e, b, career.experiences, Date.now()), 'Bullet saved.'); setB(blank); }}>Save bullet</button>
      </div>
      {ev.bullets.length ? (
        <ul className="evidence-list">
          {ev.bullets.map((x) => (
            <li key={x.id}>
              {composeBullet(x)} <span className="portal-muted">{x.final ? '· Finished' : '· Draft'}</span>{' '}
              <button type="button" className="balance-button" onClick={() => setB({ id: x.id, experienceId: x.experienceId, did: x.did, people: x.people, tools: x.tools, outcome: x.outcome, final: x.final })}>Edit</button>
            </li>
          ))}
        </ul>
      ) : null}
    </>
  );
}

function Versions({ ev, career, confirmed, apply, onWrite }: { ev: Evidence; career: CareerLibrary; confirmed: string[]; apply: Apply; onWrite: (title: string, body: string) => void }) {
  const blank = { id: undefined as string | undefined, name: '', template: 'chronological' as TemplateId, experienceIds: career.experiences.map((e) => e.id), bulletIds: ev.bullets.filter((b) => b.final).map((b) => b.id), artifactIds: [] as string[] };
  const [v, setV] = useState(blank);
  const [preview, setPreview] = useState<string | null>(null);
  const toggle = (list: string[], id: string, on: boolean) => (on ? [...list, id] : list.filter((x) => x !== id));
  return (
    <>
      <h3 className="balance-heading">Résumé versions</h3>
      <div className="evidence-form">
        <label className="portal-check">Version name<input className="input" maxLength={80} placeholder="e.g. Consulting internships" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} /></label>
        <fieldset className="advisor-attach"><legend>Template</legend>
          {TEMPLATES.map((t) => <label key={t.id} className="portal-check"><input type="radio" name="resume-template" checked={v.template === t.id} onChange={() => setV({ ...v, template: t.id })} />{t.label} — {t.blurb}</label>)}
        </fieldset>
        <fieldset className="advisor-attach"><legend>Entries</legend>
          {career.experiences.map((e) => <label key={e.id} className="portal-check"><input type="checkbox" checked={v.experienceIds.includes(e.id)} onChange={(x) => setV({ ...v, experienceIds: toggle(v.experienceIds, e.id, x.target.checked) })} />{e.title}</label>)}
        </fieldset>
        <fieldset className="advisor-attach"><legend>Finished bullets</legend>
          {ev.bullets.filter((b) => b.final).map((b) => <label key={b.id} className="portal-check"><input type="checkbox" checked={v.bulletIds.includes(b.id)} onChange={(x) => setV({ ...v, bulletIds: toggle(v.bulletIds, b.id, x.target.checked) })} />{composeBullet(b)}</label>)}
          {!ev.bullets.some((b) => b.final) ? <p className="portal-muted">Mark bullets Finished to use them.</p> : null}
        </fieldset>
        {ev.artifacts.length ? (
          <fieldset className="advisor-attach"><legend>Portfolio</legend>
            {ev.artifacts.map((a) => <label key={a.id} className="portal-check"><input type="checkbox" checked={v.artifactIds.includes(a.id)} onChange={(x) => setV({ ...v, artifactIds: toggle(v.artifactIds, a.id, x.target.checked) })} />{a.title}</label>)}
          </fieldset>
        ) : null}
        <p className="portal-muted">Skills listed: confirmed only{confirmed.length ? ` (${confirmed.join(', ')})` : ' — none confirmed yet'}.</p>
        <div className="course-v2-actions">
          <button type="button" className="balance-button" disabled={!v.name.trim()} onClick={() => apply((e) => saveVersion(e, v, Date.now()), 'Version saved.')}>Save version</button>
          <button type="button" className="balance-button" onClick={() => setPreview(renderResume({ ...v, id: v.id ?? 'preview', updated: 0 }, career, ev, confirmed))}>Preview and open in Write…</button>
        </div>
      </div>
      {ev.versions.length ? (
        <ul className="evidence-list">
          {ev.versions.map((x) => (
            <li key={x.id}>
              <strong>{x.name}</strong> — {TEMPLATES.find((t) => t.id === x.template)?.label} · {x.experienceIds.length} entries, {x.bulletIds.length} bullets{' '}
              <button type="button" className="balance-button" onClick={() => setV({ id: x.id, name: x.name, template: x.template, experienceIds: x.experienceIds, bulletIds: x.bulletIds, artifactIds: x.artifactIds })}>Edit</button>
            </li>
          ))}
        </ul>
      ) : null}
      {preview !== null ? (
        <ConfirmDialog
          title="Open this résumé in Write?"
          preview={<><pre className="advisor-summary">{preview}</pre><p>It becomes a document you can edit. Nothing is sent anywhere.</p></>}
          confirmLabel="Open in Write"
          onConfirm={() => { onWrite(`${v.name.trim() || 'Résumé'} — résumé`, preview); setPreview(null); }}
          onCancel={() => setPreview(null)}
        />
      ) : null}
    </>
  );
}

function Interviews({ apps, ev, apply }: { apps: Application[]; ev: Evidence; apply: Apply }) {
  const cards = interviewCards(apps, ev);
  return (
    <>
      <h3 className="balance-heading">Interview preparation</h3>
      {cards.length ? (
        cards.map((c) => {
          const done = ev.interviewDone[c.applicationId] ?? [];
          return (
            <article key={c.applicationId} className="readiness-next" aria-label={`Interview: ${c.title}`}>
              <h4>{c.title}</h4>
              {c.by ? <p className="portal-muted">Next step by {c.by}</p> : null}
              <ul className="evidence-list">
                {c.steps.map((s) => (
                  <li key={s.id}>
                    <label className="portal-check">
                      <input
                        type="checkbox"
                        checked={done.includes(s.id)}
                        onChange={(e) => apply((x) => ({ ...x, interviewDone: { ...x.interviewDone, [c.applicationId]: e.target.checked ? [...done, s.id] : done.filter((d) => d !== s.id) } }), 'Saved.')}
                      />
                      {s.text}
                    </label>
                  </li>
                ))}
              </ul>
            </article>
          );
        })
      ) : (
        <p className="portal-muted">A card appears here when an application in your tracker reaches the interview stage.</p>
      )}
    </>
  );
}

function Fairs({ events, ev, career, confirmed, apply }: { events: Opportunity[]; ev: Evidence; career: CareerLibrary; confirmed: string[]; apply: Apply }) {
  const { dispatch } = useStore();
  const [fairId, setFairId] = useState(events[0]?.id ?? '');
  const [emp, setEmp] = useState({ name: '', why: '', question: '' });
  const plan = ev.fairs[fairId] ?? { employers: [], pitch: '' };
  if (!events.length) return <p className="portal-muted">Add a career fair on the Fairs tab to plan for it here.</p>;
  const fair = events.find((e) => e.id === fairId) ?? events[0];
  return (
    <>
      <h3 className="balance-heading">Fair plans</h3>
      <label className="portal-check">Fair<select className="input" value={fair.id} onChange={(e) => setFairId(e.target.value)}>{events.map((e) => <option key={e.id} value={e.id}>{e.title}{e.deadline ? ` · ${e.deadline}` : ''}</option>)}</select></label>
      <label className="portal-check">Your pitch
        <textarea className="input" rows={3} maxLength={2000} value={plan.pitch} onChange={(e) => apply((x) => ({ ...x, fairs: { ...x.fairs, [fair.id]: { ...plan, pitch: e.target.value } } }), 'Pitch saved.')} />
      </label>
      <button type="button" className="balance-button" onClick={() => apply((x) => ({ ...x, fairs: { ...x.fairs, [fair.id]: { ...plan, pitch: pitchDraft(career, confirmed) } } }), 'A starting pitch from your own details. Fill the [bracketed] parts.')}>Start from my details</button>
      <h4 className="balance-heading">Employers to visit</h4>
      <ul className="evidence-list">
        {plan.employers.map((e) => (
          <li key={e.id}>
            <label className="portal-check"><input type="checkbox" checked={e.visited} onChange={(x) => apply((s) => saveEmployer(s, fair.id, { ...e, visited: x.target.checked }), 'Saved.')} /><strong>{e.name}</strong></label>
            {e.why ? <p className="portal-muted">Why: {e.why}</p> : null}
            {e.question ? <p className="portal-muted">Ask: {e.question}</p> : null}
            {e.visited ? (
              <div className="portal-filter-row">
                <label className="portal-check">Follow-up<input className="input" maxLength={300} value={e.followUp} onChange={(x) => apply((s) => saveEmployer(s, fair.id, { ...e, followUp: x.target.value }), 'Saved.')} /></label>
                <button type="button" className="balance-button" onClick={() => dispatch({ type: 'addApplication', patch: { org: e.name, kind: 'job', stage: 'found', note: `Met at ${fair.title}.${e.followUp ? ` ${e.followUp}` : ''}` } })}>Add to my tracker</button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="portal-filter-row">
        <label className="portal-check">Employer<input className="input" maxLength={120} value={emp.name} onChange={(e) => setEmp({ ...emp, name: e.target.value })} /></label>
        <label className="portal-check">Why them<input className="input" maxLength={300} value={emp.why} onChange={(e) => setEmp({ ...emp, why: e.target.value })} /></label>
        <label className="portal-check">A question to ask<input className="input" maxLength={300} value={emp.question} onChange={(e) => setEmp({ ...emp, question: e.target.value })} /></label>
        <button type="button" className="balance-button" disabled={!emp.name.trim()} onClick={() => { apply((s) => saveEmployer(s, fair.id, { ...emp, visited: false, followUp: '' }), `${emp.name.trim()} added.`); setEmp({ name: '', why: '', question: '' }); }}>Add employer</button>
      </div>
      <p className="portal-muted">Adding to your tracker only records it for you. Semester does not apply anywhere.</p>
    </>
  );
}
