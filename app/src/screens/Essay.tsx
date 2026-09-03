import { useMemo, useRef, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel, Segmented } from '../components/ui';
import { PrintButton } from '../components/PrintButton';
import { ask, configured } from '../lib/claude';
import { download } from '../lib/deliver';
import {
  DISCLOSURE,
  LENGTHS,
  SYSTEM,
  USES,
  VOICES,
  brief,
  fileName,
  gate,
  holes,
  readDraft,
  target,
  forUse,
  words,
  type Stance,
} from '../lib/essay';
import { asLines, forCourse } from '../lib/sources';

/**
 * Drafting, for the writing that is not coursework.
 *
 * The app has two writing tools and they are deliberately different objects.
 * The project file makes the document you write an essay *in* and refuses to
 * fill it. This one writes real prose — and so it is fenced off from
 * coursework, by `gate()` in `lib/essay.ts`, which is pure and tested so no
 * later rearrangement of this screen can route around it.
 *
 * The fence has one gap and it is deliberate: a course whose policy the
 * student has read and recorded as permitting drafting. Not recorded is a no.
 * "Limited" is a no, because the limit is nearly always the drafting.
 *
 * What the tool will never do is invent a fact about the writer. A cover
 * letter that invents an internship is a lie with their name on it and they
 * will not catch it, because it reads exactly like the rest. So facts come
 * from one box, everything else comes back as a bracketed blank, and the
 * blanks are counted underneath where they cannot be missed.
 */
export function Essay() {
  const { state, dispatch, catalog } = useStore();

  const [useId, setUseId] = useState(USES[0].id);
  const [courseId, setCourseId] = useState<string>(catalog.courses[0]?.id ?? '');
  const [attested, setAttested] = useState(false);
  const [audience, setAudience] = useState('');
  const [purpose, setPurpose] = useState('');
  const [facts, setFacts] = useState('');
  const [instructions, setInstructions] = useState('');
  const [sources, setSources] = useState('');
  const [lengthId, setLengthId] = useState('standard');
  const [voiceId, setVoiceId] = useState('plain');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [kept, setKept] = useState(false);
  const abort = useRef<AbortController | null>(null);

  const u = forUse(useId);
  const course = catalog.byId[courseId];
  const stance: Stance = (course?.ai?.stance ?? 'unstated') as Stance;
  // The four sample courses are compiled in, so their policy cannot be edited.
  const editable = Boolean(course && state.courses.some((c) => c.course.id === course.id));

  const verdict = useMemo(
    () =>
      gate({
        useId,
        attested,
        courseCode: u.coursework ? course?.code : undefined,
        stance: u.coursework ? stance : undefined,
      }),
    [useId, attested, u.coursework, course?.code, stance],
  );

  const draft = out ? readDraft(out) : '';
  const left = draft ? holes(draft) : [];
  const count = draft ? words(draft) : 0;
  const aim = target(lengthId);

  // Already-kept sources for the course chosen, or every one when this is not
  // coursework — the point is never having to retype them.
  const onFile = useMemo(
    () => forCourse(state.sources, u.coursework && course ? course.id : null),
    [state.sources, u.coursework, course],
  );

  const make = async () => {
    if (busy || !verdict.ok) return;
    setBusy(true);
    setError('');
    setOut('');
    setKept(false);
    abort.current = new AbortController();
    let sofar = '';
    try {
      await ask({
        signal: abort.current.signal,
        maxTokens: 4000,
        think: true,
        system: SYSTEM,
        messages: [
          {
            role: 'user',
            content: brief({
              useId,
              audience,
              purpose,
              facts,
              instructions,
              sources,
              lengthId,
              voiceId,
              courseCode: u.coursework ? course?.code : undefined,
            }),
          },
        ],
        onText: (chunk) => {
          sofar += chunk;
          setOut(sofar);
        },
      });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) {
        setError(e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusy(false);
    }
  };

  const title = purpose.trim() || `${u.label}${audience.trim() ? ` · ${audience.trim()}` : ''}`;

  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 12.5, opacity: 0.65, lineHeight: 1.5, textWrap: 'pretty' }}>
        A real draft, for the writing that is not coursework — the cover letter, the club
        newsletter, the scholarship statement, the memo. For a class, the project file under
        Work on it is the tool: it gives you the document to write in, not the writing.
      </div>

      <SectionLabel>What is this for</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {USES.map((option) => {
          const on = option.id === useId;
          return (
            <button
              key={option.id}
              type="button"
              className="bare tappable"
              aria-pressed={on}
              onClick={() => {
                setUseId(option.id);
                setAttested(false);
              }}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 'var(--r-md)',
                border: `1px solid ${on ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
                background: on ? 'var(--app-accent-wash)' : 'transparent',
              }}
            >
              <span style={{ display: 'block', fontSize: 14 }}>{option.label}</span>
              <span style={{ display: 'block', fontSize: 11.5, opacity: 0.55, marginTop: 2 }}>
                {option.blurb}
              </span>
            </button>
          );
        })}
      </div>

      {u.coursework && (
        <>
          <SectionLabel>Which course</SectionLabel>
          <select
            className="input"
            value={courseId}
            onChange={(e) => {
              setCourseId(e.target.value);
              setAttested(false);
            }}
            style={{ width: '100%' }}
          >
            {catalog.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>
          {course && (
            <Blueprint style={{ padding: '11px 13px', marginTop: 10 }}>
              <div className="kicker">Recorded policy</div>
              <div style={{ fontSize: 13, lineHeight: 1.5, marginTop: 5 }}>
                {course.ai?.note ??
                  'Nothing recorded. Read the syllabus and set it under Edit the course.'}
              </div>
              {editable ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    dispatch({ type: 'openGuide', id: course.id });
                    dispatch({ type: 'go', screen: 'edit' });
                  }}
                  style={{ height: 38, marginTop: 10, width: '100%' }}
                >
                  {course.ai ? 'Change what is recorded' : 'Record the policy'}
                </button>
              ) : (
                <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 8, lineHeight: 1.45 }}>
                  A sample course, so this is fixed. Your own courses record their own policy under
                  Edit the course.
                </div>
              )}
            </Blueprint>
          )}
        </>
      )}

      <label
        className="tappable"
        style={{
          display: 'flex',
          gap: 10,
          alignItems: 'flex-start',
          marginTop: 14,
          padding: '11px 12px',
          borderRadius: 'var(--r-md)',
          border: '1px solid var(--app-line)',
        }}
      >
        <input
          type="checkbox"
          checked={attested}
          onChange={(e) => setAttested(e.target.checked)}
          style={{ marginTop: 2, flex: 'none', width: 18, height: 18 }}
        />
        <span style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          {u.coursework
            ? 'I have read the syllabus and it permits a drafting tool for this assignment.'
            : 'I have checked that whoever receives this permits a drafting tool.'}
        </span>
      </label>

      {!verdict.ok && (
        <div
          style={{
            fontSize: 12.5,
            lineHeight: 1.5,
            marginTop: 10,
            padding: '11px 13px',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--app-line)',
            background: 'var(--app-panel)',
            textWrap: 'pretty',
          }}
        >
          {verdict.why}
        </div>
      )}

      <SectionLabel>Who reads it</SectionLabel>
      <input
        className="input"
        value={audience}
        onChange={(e) => setAudience(e.target.value)}
        placeholder="The office, the committee, the editor, your manager"
        style={{ width: '100%' }}
      />

      <SectionLabel>What it has to do</SectionLabel>
      <textarea
        className="input"
        value={purpose}
        onChange={(e) => setPurpose(e.target.value)}
        placeholder="Apply for the spring policy internship. Get them to read the attached memo."
        style={{ width: '100%', minHeight: 64, resize: 'vertical', lineHeight: 1.5 }}
      />

      <SectionLabel>The facts it may use</SectionLabel>
      <textarea
        className="input"
        value={facts}
        onChange={(e) => setFacts(e.target.value)}
        placeholder="Everything true about you it is allowed to say: what you have done, where, when, with whom, what came of it."
        style={{ width: '100%', minHeight: 110, resize: 'vertical', lineHeight: 1.5 }}
      />
      <div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 6, lineHeight: 1.45 }}>
        This list is the fence. Anything not on it comes back as a blank in square brackets rather
        than a guess — a letter that invents an internship reads exactly like one that does not.
      </div>

      <SectionLabel>What they asked for</SectionLabel>
      <textarea
        className="input"
        value={instructions}
        onChange={(e) => setInstructions(e.target.value)}
        placeholder="The job ad, the prompt, the call for pitches. Paste it."
        style={{ width: '100%', minHeight: 80, resize: 'vertical', lineHeight: 1.5 }}
      />

      <SectionLabel>Sources, if it needs any</SectionLabel>
      <textarea
        className="input"
        value={sources}
        onChange={(e) => setSources(e.target.value)}
        placeholder="One per line. Yours only — nothing here will invent one."
        style={{ width: '100%', minHeight: 64, resize: 'vertical', lineHeight: 1.5 }}
      />

      {onFile.length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSources((now) => (now.trim() ? `${now.trim()}\n${asLines(onFile)}` : asLines(onFile)))}
            style={{ flex: 1, height: 38, fontSize: 12.5 }}
          >
            Use my {onFile.length} kept {onFile.length === 1 ? 'source' : 'sources'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => dispatch({ type: 'go', screen: 'sources' })}
            style={{ flex: 'none', height: 38, fontSize: 12.5 }}
          >
            Manage
          </button>
        </div>
      )}

      <SectionLabel>How long</SectionLabel>
      <Segmented
        options={LENGTHS.map((l) => ({ id: l.id, label: l.label }))}
        value={lengthId}
        onChange={setLengthId}
      />
      <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 5 }}>
        About {aim} words. {LENGTHS.find((l) => l.id === lengthId)?.blurb}
      </div>

      <SectionLabel>Voice</SectionLabel>
      <Segmented
        options={VOICES.map((v) => ({ id: v.id, label: v.label }))}
        value={voiceId}
        onChange={setVoiceId}
      />

      {configured() ? (
        <button
          type="button"
          className="btn btn-primary btn-block"
          onClick={() => void make()}
          disabled={busy || !verdict.ok}
          style={{ height: 46, marginTop: 18, letterSpacing: '0.1em', textTransform: 'uppercase' }}
        >
          {busy ? 'Drafting…' : out ? 'Draft it again' : 'Write the draft'}
        </button>
      ) : (
        <div style={{ fontSize: 12.5, opacity: 0.6, marginTop: 16, lineHeight: 1.5 }}>
          Needs a key first — set one under Ask Claude → Settings.
        </div>
      )}

      {error ? (
        <div style={{ fontSize: 13, marginTop: 12, color: 'var(--app-warn)', lineHeight: 1.45 }}>
          {error}
        </div>
      ) : null}

      {draft && (
        <>
          <SectionLabel>The draft</SectionLabel>
          <div
            style={{
              fontSize: 14,
              lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
              padding: 14,
              borderRadius: 'var(--r-lg)',
              border: '1px solid var(--app-line)',
              background: 'var(--app-panel)',
            }}
          >
            {draft}
          </div>

          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 10, lineHeight: 1.55 }}>
            {count} words against {aim}.{' '}
            {left.length > 0
              ? `${left.length} ${left.length === 1 ? 'blank' : 'blanks'} left for you — fill every one before this goes anywhere.`
              : facts.trim().length < 40
                ? 'No blanks in it, on very few facts. Read it line by line: anything specific it says about you that you did not give it, it made up.'
                : 'No blanks left. Still read it line by line — it is your name on it.'}
          </div>

          {left.length > 0 && (
            <Blueprint style={{ padding: '11px 13px', marginTop: 10 }}>
              <div className="kicker">What it needs from you</div>
              {left.map((hole, i) => (
                <div key={`${hole}-${i}`} style={{ fontSize: 12.5, padding: '4px 0', lineHeight: 1.45 }}>
                  {hole.slice(1, -1)}
                </div>
              ))}
            </Blueprint>
          )}

          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                download({
                  name: fileName(audience, useId),
                  body: `${draft}\n\n---\n\n${DISCLOSURE}\n`,
                  mime: 'text/markdown',
                })
              }
              style={{ flex: 1, height: 42 }}
            >
              Save the file
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                dispatch({
                  type: 'keepNote',
                  title,
                  body: draft,
                  courseId: u.coursework && course ? course.id : null,
                });
                setKept(true);
              }}
              style={{ flex: 1, height: 42 }}
            >
              {kept ? 'Kept' : 'Keep as note'}
            </button>
          </div>
          <PrintButton label="Print it" style={{ marginTop: 8 }} />
          <div style={{ fontSize: 11, opacity: 0.45, marginTop: 10, lineHeight: 1.45 }}>
            The saved file carries a line at the bottom saying it was drafted and edited. Take it
            off if you like — it is there so that in a month you can still tell.
          </div>
        </>
      )}
      <div style={{ height: 26 }} />
    </div>
  );
}
