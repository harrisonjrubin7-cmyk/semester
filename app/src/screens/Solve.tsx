import { useRef, useState } from 'react';
import { Produced } from '../components/Produced';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { useDraft } from '../lib/draft.hook';
import { DraftNote } from '../components/DraftNote';
import { Dictate } from '../components/Dictate';
import { useLive } from '../lib/live';
import { ActionButton, FilePick, SectionLabel } from '../components/ui';
import { Trouble } from '../components/Trouble';
import { useTrouble } from '../lib/trouble';
import { PrintButton } from '../components/PrintButton';
import { ask } from '../lib/claude';
import { configured } from '../lib/assistant';
import { MAX_SHOTS, tooMany, toShots } from '../lib/shots';
import { APPROACHES, READ_SYSTEM, READ_WORK_SYSTEM, SYSTEM, approach as byId, brief } from '../lib/solve';
import { NeedsKey } from '../components/NeedsKey';

/**
 * Work the problem.
 *
 * The hard part of quantitative coursework is rarely the arithmetic. It is not
 * knowing which method a question is asking for, and — when the answer comes
 * out wrong — not being able to find the step where it went wrong. Both are
 * things a careful reader is good at and a tired student at 1am is not.
 *
 * So the screen offers those, and works a parallel problem rather than handing
 * over the answer to the one being marked. That line is stated once here and
 * nowhere else, because a tool that repeats its own scruples is exhausting.
 *
 * The camera is on it because a problem set is a piece of paper. Transcribing
 * a page of subscripts by hand is enough friction to stop somebody using the
 * thing at all — and the transcription is told to mark what it cannot read
 * rather than guess, since a guessed exponent quietly turns the problem into a
 * different one.
 *
 * ## Both boxes, and why the second one was the one that needed it
 *
 * The camera was on "The problem" alone, which is the field that needs it
 * least: a problem statement is usually already typeset, on a handout or a PDF
 * the student could paste. Their working never is. It is on paper, in their
 * handwriting, full of fractions and subscripts and things crossed out, and it
 * is what two of the five approaches are entirely about.
 *
 * Worse than missing, it was misrouted. Every transcription landed in
 * `problem`, so a student on "Check my working" who photographed their working
 * — the obvious thing to do, and what the button appeared to offer — sent it
 * under the heading "The problem:" with the working left empty, and `brief`
 * then appended "They have not shown their working. Ask for it in one line."
 * The reply asked them for the thing they had just photographed.
 *
 * So the destination is now part of the request rather than a constant, and
 * each box has its own camera above it. The two reads use different prompts:
 * transcribing somebody's attempt must not correct it, or the step that is
 * wrong is gone before anything looks for it. See `READ_WORK_SYSTEM`.
 */
/** Which of the two boxes a batch of photographs is being read into. */
type Into = 'problem' | 'work';

/**
 * What the button says while it reads, per box.
 *
 * Distinct strings rather than one "Reading it…", because `busy` is also what
 * decides which of the two buttons shows the label. One string put it on both,
 * so photographing your working said the app was reading the problem.
 */
const READING: Record<Into, string> = {
  problem: 'Reading the problem…',
  work: 'Reading your working…',
};

export function Solve() {
  const { state, catalog } = useStore();
  const { guide } = useLive(state.guideId);

  const [aid, setAid] = useState(APPROACHES[0].id);
  const [problem, setProblem] = useState('');
  const workField = useDraft('solve', 'work');
  const work = workField.value;
  const setWork = workField.set;
  const [expected, setExpected] = useState('');
  const [out, setOut] = useState('');
  const [busy, setBusy] = useState('');
  const trouble = useTrouble();
  const abort = useRef<AbortController | null>(null);
  const a = byId(aid);

  const course = catalog.courses.length > 0 ? `${guide.code} — ${guide.name}` : '';

  /**
   * Read a batch of photographs into one of the two boxes.
   *
   * `into` is the whole of the difference, and it decides two things that have
   * to agree: which prompt reads the picture, and which field the text lands
   * in. They were a constant and a constant, which is how a photograph of a
   * student's working ended up transcribed as though it were the question and
   * filed where nothing would look for it.
   */
  const readPhoto = async (files: File[], into: Into) => {
    if (files.length === 0) return;
    trouble.clear();
    setBusy(READING[into]);
    try {
      const { shots, errors } = await toShots(files.slice(0, MAX_SHOTS));
      // Some of the photos would not open, and some were never opened: past
      // twelve they are cut off. Both said alongside whatever happens to the
      // ones that did, because a transcription of three pages out of four
      // looks complete and is not — and the ones cut off are the easier case
      // to miss, since nothing went wrong to say so.
      const over = tooMany(files.length, MAX_SHOTS);
      if (over) errors.push(over);
      if (errors.length) trouble.wrong(errors.join(' '));
      if (shots.length === 0) return;
      abort.current = new AbortController();
      const text = await ask({
        about: 'solving',
        signal: abort.current.signal,
        images: shots.map((sh) => sh.shot),
        think: true,
        maxTokens: 2000,
        system: into === 'work' ? READ_WORK_SYSTEM : READ_SYSTEM,
        messages: [
          {
            role: 'user',
            content:
              into === 'work'
                ? 'Transcribe the working in these, exactly as written.'
                : 'Transcribe the problem in these.',
          },
        ],
      });
      // Appended rather than replacing, so a second batch is the next pages
      // rather than the only ones — the same behaviour both boxes had when
      // there was one of them.
      const add = (prior: string) => (prior.trim() ? `${prior.trim()}\n\n${text.trim()}` : text.trim());
      if (into === 'work') setWork(add(work));
      else setProblem(add);
    } catch (e) {
      // Reading the same photos again is the right retry here — not `run`,
      // which is a different request against a problem that never arrived.
      trouble.failed(e, () => void readPhoto(files, into));
    } finally {
      setBusy('');
    }
  };

  const run = async () => {
    if (busy || !problem.trim()) return;
    setBusy('Working…');
    trouble.clear();
    setOut('');
    abort.current = new AbortController();
    let sofar = '';
    try {
      await ask({
        about: 'solving',
        signal: abort.current.signal,
        maxTokens: 3000,
        think: true,
        system: SYSTEM,
        messages: [
          { role: 'user', content: brief({ approach: a, problem, work, expected, course }) },
        ],
        onText: (chunk) => {
          sofar += chunk;
          setOut(sofar);
        },
      });
    } catch (e) {
      trouble.failed(e, () => void run());
    } finally {
      setBusy('');
    }
  };

  if (!configured()) return <NeedsKey frame />;

  return (
    <Page bottom={26}>
      <div style={{ fontSize: 'var(--type-base)', color: 'var(--app-dim)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        Working on {guide.code}. It will not write the answer you are handing in — for a maths
        question the worked solution is the submitted work. It will teach the method on numbers
        that are not yours, and read your attempt and find the first step that is wrong.
      </div>

      <SectionLabel>What do you need</SectionLabel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'calc(7px * var(--density, 1))' }}>
        {APPROACHES.map((option) => {
          const on = option.id === aid;
          return (
            <button
              key={option.id}
              type="button"
              className="bare tappable"
              onClick={() => setAid(option.id)}
              aria-pressed={on}
              style={{
                textAlign: 'left',
                paddingBlock: 'calc(11px * var(--density, 1))', paddingInline: 'calc(13px * var(--density, 1))',
                borderRadius: 'var(--r-md)',
                border: `1px solid ${on ? 'var(--app-accent-deep)' : 'var(--app-line)'}`,
                background: on ? 'var(--app-accent-wash)' : 'transparent',
              }}
            >
              <span style={{ display: 'block', fontSize: 'var(--type-md)' }}>{option.label}</span>
              <span
                style={{
                  display: 'block',
                  fontSize: 'var(--type-xs-plus)',
                  color: 'var(--app-dim)',
                  marginTop: 'var(--sp-1)',
                  lineHeight: 'var(--leading-normal-minus)',
                }}
              >
                {option.blurb}
              </span>
            </button>
          );
        })}
      </div>

      <SectionLabel>The problem</SectionLabel>
      <textarea
        aria-label="The problem"
        className="input"
        value={problem}
        onChange={(e) => setProblem(e.target.value)}
        placeholder="Type it, or photograph it below."
        style={{ width: '100%', minHeight: 110, resize: 'vertical', lineHeight: 'var(--leading-relaxed-plus)' }}
      />
      <Dictate compact current={problem} onText={setProblem} label="Read the problem out" />
      <FilePick
        accept="image/*"
        capture="environment"
        disabled={!!busy}
        onPick={(picked) => void readPhoto(picked, 'problem')}
        style={{
          height: 42,
          marginTop: 'var(--sp-4)',
          fontSize: 'var(--type-sm)',
          letterSpacing: '0.08em',
          textTransform: 'none',
        }}
      >
        {busy === READING.problem ? busy : 'Photograph the problem'}
      </FilePick>
      <div style={{ fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
        Anything the photo cannot show clearly comes back as [?] rather than a guess — a guessed
        exponent turns it into a different problem without telling you.
      </div>

      {a.wantsWork && (
        <>
          <SectionLabel>What you did</SectionLabel>
          <textarea
            aria-label="What you did"
            className="input"
            value={work}
            onChange={(e) => setWork(e.target.value)}
            placeholder="Type it, or photograph it below. Rough is fine."
            style={{ width: '100%', minHeight: 110, resize: 'vertical', lineHeight: 'var(--leading-relaxed-plus)' }}
          />
          <DraftNote field={workField} />
          <FilePick
            accept="image/*"
            capture="environment"
            disabled={!!busy}
            onPick={(picked) => void readPhoto(picked, 'work')}
            style={{
              height: 42,
              marginTop: 'var(--sp-4)',
              fontSize: 'var(--type-sm)',
              letterSpacing: '0.08em',
              textTransform: 'none',
            }}
          >
            {busy === READING.work ? busy : 'Photograph your working'}
          </FilePick>
          <div style={{ fontSize: 'var(--type-xs-plus)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
            Copied down as written, mistakes and all — including anything you crossed out, which is
            often where it first went wrong. Nothing is corrected on the way in, or there would be
            nothing left to find.
          </div>
        </>
      )}

      {a.id === 'wrong' && (
        <>
          <SectionLabel>The answer you expected</SectionLabel>
          <input
            aria-label="The answer you expected"
            className="input"
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            placeholder="What the book or the key says."
            style={{ width: '100%' }}
          />
        </>
      )}

      <ActionButton
        onClick={() => void run()}
        disabled={!!busy || !problem.trim()}
        tone="primary"
        style={{ marginTop: 'var(--sp-7)' }}
      >
        {busy === 'Working…' ? 'Working…' : out ? 'Do it again' : a.label}
      </ActionButton>

      <Trouble said={trouble.said} onRetry={trouble.again} />

      {out && (
        <>
          <SectionLabel>{a.label}</SectionLabel>
          <Produced style={{ background: 'var(--app-panel)' }}>{out}</Produced>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => void navigator.clipboard.writeText(out).catch(() => {})}
            style={{ height: 42, marginTop: 'var(--sp-4)' }}
          >
            Copy
          </button>
        </>
      )}
      {out ? <PrintButton label="Print this" style={{ marginTop: 'var(--sp-4)' }} /> : null}
    </Page>
  );
}
