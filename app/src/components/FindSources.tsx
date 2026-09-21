import { useRef, useState } from 'react';
import { Produced } from './Produced';
import { useStore } from '../state/store';
import { useLive } from '../lib/live';
import { ActionButton, SectionLabel } from './ui';
import { Trouble } from './Trouble';
import { useTrouble } from '../lib/trouble';
import { configured } from '../lib/assistant';
import { ask } from '../lib/claude';
import { RESEARCH_SYSTEM, asSource, brief, dedupe, type Found } from '../lib/research';
import { useRowStyle } from './shell/useShell';

/**
 * Sources from outside what the course set.
 *
 * Every other assistant surface in this app is grounded in the student's own
 * material and says so. That is right for "what is due" and for "explain
 * elasticity", and it is the wrong shape for the thing a paper needs: three
 * sources the professor did not assign, which by definition are not in the
 * syllabus the rest of the app is reading.
 *
 * So this is the one place that talks to anything but the API —
 * `lib/research.ts` has the whole account, including why a *found* source is a
 * different kind of thing from a generated one, which is the distinction
 * `screens/Sources.tsx` is built on and this must not break.
 *
 * ## Why it is part of that screen rather than its own
 *
 * It was written as a screen first, and the registry refused it: every shelf
 * in `lib/nav.ts` is full at eight, and a ninth on Courses is a shelf that no
 * longer draws as one row. That constraint is doing its job here rather than
 * getting in the way. Finding a source and keeping one are one job split
 * across two moments, and the app's own rule is that a thing has one home —
 * so this lives on the screen the sources live on, and a search result
 * reaches the list through the same Add a pasted line goes through.
 *
 * ## Nothing lands in your sources by itself
 *
 * The briefing is an answer; the rows under it are offers. Each has an Add
 * beside it and nothing is written until it is tapped, which is the shape
 * every proposal in this app has — `ai/prompt.ts` gives the reason, and it
 * holds harder here than anywhere: a bibliography that filled itself would be
 * a bibliography nobody had read.
 *
 * The "what it is for" field stays empty on what is added, deliberately. It is
 * the field that earns marks and the one this screen has no honest way to
 * fill: knowing a paper is relevant is what reading it is for.
 */
export function FindSources() {
  const { state, dispatch, catalog } = useStore();
  const { guide } = useLive(state.guideId);

  const [question, setQuestion] = useState('');
  const [out, setOut] = useState('');
  const [found, setFound] = useState<Found[]>([]);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const [project, setProject] = useState('');
  const [busy, setBusy] = useState(false);
  const trouble = useTrouble();
  const abort = useRef<AbortController | null>(null);
  const row = useRowStyle(11);

  const courseId = catalog.courses.length > 0 ? state.guideId : null;
  const course = catalog.courses.length > 0 ? `${guide.code} — ${guide.name}` : '';

  const run = async () => {
    if (busy || !question.trim()) return;
    setBusy(true);
    trouble.clear();
    setOut('');
    setFound([]);
    setAdded({});
    abort.current = new AbortController();
    let sofar = '';
    try {
      await ask({
        about: 'research',
        courseId,
        signal: abort.current.signal,
        maxTokens: 4000,
        think: true,
        search: true,
        system: RESEARCH_SYSTEM,
        messages: [{ role: 'user', content: brief(question, course) }],
        // Appended and de-duplicated as they arrive: five searches on one
        // question turn up the same paper three times, and three identical
        // rows with three Add buttons is a list nobody trusts.
        onFound: (rows) => setFound((was) => dedupe([...was, ...rows])),
        /*
         * A failed search is not a failed request — it arrives inside a
         * successful one, so it is shown beside the answer rather than
         * replacing it. The model usually says something useful about not
         * having searched, and throwing that away would leave the screen
         * blank with an error on it.
         */
        onSearchTrouble: (said) => trouble.wrong(said),
        onText: (chunk) => {
          sofar += chunk;
          setOut(sofar);
        },
      });
    } catch (e) {
      trouble.failed(e, () => void run());
    } finally {
      setBusy(false);
    }
  };

  // The panel simply is not there without a key. The screen around it is
  // fully usable — typing and pasting a source needs no assistant at all —
  // so an explanation of a missing key would be answering a question nobody
  // on this screen has asked.
  if (!configured()) return null;

  return (
    <div>
      {/*
        A label of its own, which a screenshot asked for: without it the
        paragraph below sat directly under the "Keep it" button and read as a
        footnote to that button rather than as the start of a second way in.
      */}
      <SectionLabel>Or find some</SectionLabel>
      <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        The one part of this app that reads the open web. It searches, tells you what it actually
        found, and hands you the pages — nothing is added to your sources until you tap Add, and it
        will say when there is little worth citing rather than filling a list.
      </div>

      <SectionLabel>What do you need sources on</SectionLabel>
      <textarea
        aria-label="What do you need sources on"
        className="input"
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Does deterrence actually prevent conflict, or just delay it?"
        style={{ width: '100%', minHeight: 96, resize: 'vertical', lineHeight: 'var(--leading-relaxed-plus)' }}
      />

      <SectionLabel>For which paper</SectionLabel>
      <input
        aria-label="For which paper"
        className="input"
        value={project}
        onChange={(e) => setProject(e.target.value)}
        placeholder="Optional — groups what you add, on the Sources screen."
        style={{ width: '100%' }}
      />

      <ActionButton
        onClick={() => void run()}
        disabled={busy || !question.trim()}
        tone="primary"
        style={{ marginTop: 'var(--sp-7)' }}
      >
        {busy ? 'Searching…' : 'Find sources'}
      </ActionButton>

      <Trouble said={trouble.said} onRetry={trouble.again} />

      {out && (
        <>
          <SectionLabel>What it found</SectionLabel>
          <Produced style={{ background: 'var(--app-panel)' }}>{out}</Produced>
        </>
      )}

      {found.length > 0 && (
        <>
          <SectionLabel>The pages it opened</SectionLabel>
          <div style={{ fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)', marginBottom: 'var(--sp-4)', lineHeight: 'var(--leading-normal)' }}>
            Real addresses the search returned, not a bibliography it wrote. Open one before you
            cite it — and fill in what it is for once you have, which is the field that earns marks.
          </div>
          {found.map((f) => (
            <div key={f.url} style={{ ...row, display: 'flex', gap: 'calc(9px * var(--density, 1))', alignItems: 'flex-start' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <a
                  href={f.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  style={{ fontSize: 'var(--type-base)', color: 'var(--app-fg)', textWrap: 'pretty' }}
                >
                  {f.title}
                </a>
                <div style={{ fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)', marginTop: 'var(--sp-1)' }}>
                  {f.site}
                </div>
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!!added[f.url]}
                onClick={() => {
                  dispatch({ type: 'addSource', source: asSource(f, courseId, project) });
                  setAdded((was) => ({ ...was, [f.url]: true }));
                }}
                aria-label={added[f.url] ? `Added: ${f.title}` : `Add to your sources: ${f.title}`}
                style={{ flex: 'none', paddingInline: 'var(--sp-5)', height: 34, fontSize: 'var(--type-xs)' }}
              >
                {added[f.url] ? 'Added' : 'Add'}
              </button>
            </div>
          ))}
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => dispatch({ type: 'go', screen: 'sources' })}
            style={{ height: 42, marginTop: 'var(--sp-6)' }}
          >
            Open your sources
          </button>
        </>
      )}
    </div>
  );
}
