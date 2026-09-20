/**
 * Where two of your courses are teaching the same word.
 *
 * The rest of Study is organised by course, because that is how a term is
 * organised and how an exam is sat. The cost of that, never paid until now, is
 * that four courses look like four sealed boxes — and they are not. A student
 * taking research methods beside a marketing course meets *margin of error*
 * twice in a fortnight and is never told, so they learn it twice, badly, and
 * find out at the exam that one of the two courses meant something slightly
 * different by it.
 *
 * The arithmetic is in `lib/meet.ts`, and everything careful about this screen
 * follows from one property of it: **it matches words, not ideas.** So the
 * screen never says "these are the same". It shows both courses' own
 * definitions side by side, says what kind of evidence put them on one row,
 * and lets the reader decide. A pair that turns out to disagree is the most
 * valuable row on the page, and a coincidence is visible in a second.
 *
 * Ordered strongest evidence first, and the weak tiers are behind their own
 * headings rather than mixed in — a row where one course merely uses a word is
 * worth seeing and is not worth the same as two definitions.
 */

import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { FirstRun } from './FirstRun';
import { Blueprint } from '../components/Blueprint';
import { EmptyState, SectionLabel } from '../components/ui';
import { liveGuide } from '../lib/live';
import {
  meetPrompt,
  meetings,
  pairings,
  readSame,
  whyLine,
  type Meeting,
  type Sided,
  type Why,
} from '../lib/meet';
import { ask } from '../lib/claude';
import { configured } from '../lib/assistant';
import { ActionButton } from '../components/ui';
import { Trouble } from '../components/Trouble';
import { useTrouble } from '../lib/trouble';

/**
 * The headings, strongest first, each with the sentence that says how much to
 * trust what is under it.
 */
const TIERS: { why: Why; label: string; note: string }[] = [
  {
    why: 'both-define',
    label: 'Both courses define it',
    note: 'Two glossary entries for one term. Read the pair: where they differ, the difference is the exam question.',
  },
  {
    why: 'one-inside-the-other',
    label: 'One phrase inside the other',
    note: 'One course’s term sits whole inside the other’s — usually the general case and the applied one.',
  },
  {
    why: 'defined-and-used',
    label: 'Defined in one, used in the other',
    note: 'The second course uses the word in its own material without defining it. Weaker, and the sentence it was found in is quoted so you can judge.',
  },
  {
    why: 'a-word-in-common',
    label: 'One word in common',
    note: 'Two different terms sharing one distinctive word. The weakest thing on this screen, and the likeliest to be a coincidence.',
  },
  {
    why: 'means-the-same',
    label: 'Read as the same idea',
    note: 'Two entries that share no word at all, put on one row by a reading of both glossaries rather than by a match. Weaker than everything above it, because nothing here can name the word that did it — each course’s own definition is shown, and the judgement is yours.',
  },
];

export function Meet() {
  const { state, dispatch, catalog, tint } = useStore();

  /*
   * Live guides, not the compiled ones.
   *
   * A reading pasted in last week is part of the course, and a screen that
   * read the shipped module would say two courses do not meet on a word that
   * is in both of them today. Same merge every study screen uses.
   */
  const sides = useMemo<Sided[]>(
    () =>
      catalog.courses
        .map((c) => ({
          courseId: c.id,
          code: c.code,
          guide: state.updates.length
            ? liveGuide(catalog, c.id, state.updates)
            : (catalog.guides[c.id] ?? { units: [], terms: [] as never[] } as never),
        }))
        .filter((s) => s.guide),
    [catalog, state.updates],
  );

  const matched = useMemo(() => meetings(sides), [sides]);

  /**
   * The fifth grade, read rather than matched.
   *
   * Held in the screen and not in the store, for the reason the runway's scope
   * proposal is: this is a reading offered on the screen somebody asked for it
   * on. It is thrown away on navigation, which is right — a suggestion that
   * survived a reload would start to look like a finding, and the four grades
   * above it are the ones that have earned that.
   */
  const [read, setRead] = useState<Meeting[] | null>(null);
  const [reading, setReading] = useState(false);
  const trouble = useTrouble();

  /** The four, then the fifth under them. `meetings` never produces the fifth. */
  const found = useMemo(() => [...matched, ...(read ?? [])], [matched, read]);

  const readAcross = async () => {
    if (reading || sides.length < 2) return;
    setReading(true);
    trouble.clear();
    let sofar = '';
    try {
      await ask({
        about: 'meeting notes',
        maxTokens: 2000,
        system: meetPrompt(sides),
        messages: [{ role: 'user', content: 'Find the pairs, or answer with none.' }],
        onText: (chunk) => {
          sofar += chunk;
        },
      });
      let parsed: unknown = null;
      try {
        const m = /\{[\s\S]*\}/.exec(sofar);
        parsed = m ? JSON.parse(m[0]) : null;
      } catch {
        parsed = null;
      }
      // `matched`, so a pair one of the four grades already holds is dropped
      // rather than shown twice in two strengths.
      setRead(readSame(parsed, sides, matched));
    } catch (e) {
      trouble.failed(e, () => void readAcross());
    } finally {
      setReading(false);
    }
  };

  const pairs = useMemo(() => pairings(found), [found]);

  if (catalog.empty) return <FirstRun where="to compare" />;

  if (catalog.courses.length < 2) {
    return (
      <Page>
        <EmptyState
          title="One course cannot meet anything"
          body="This screen compares the glossaries and cards of two courses against each other. Add a second course and it has something to do."
        />
      </Page>
    );
  }

  const open = (courseId: string, unit: number | null) =>
    dispatch({
      type: 'openGuide',
      id: courseId as never,
      // A unit is where the cards are, so that is what opening one should give
      // you. A sighting with no unit — a glossary, the frames, the case files —
      // has no cards to open, so the whole document is the honest destination.
      mode: unit === null ? 'field' : 'cards',
      unit: unit ?? undefined,
    });

  return (
    <Page
      blurb="Your courses compared with each other rather than one at a time. It is matching words, not ideas — so where both courses define a term, both definitions are here and the judgement is yours."
    >
      <Blueprint style={{ padding: 'var(--sp-7)' }}>
        <div className="kicker">Across {catalog.courses.length} courses</div>
        <div
          className="chrome-text"
          style={{
            marginTop: 'var(--sp-3)',
            fontSize: 'var(--type-lg)',
            lineHeight: 'var(--leading-normal)',
            textWrap: 'pretty',
          }}
        >
          {found.length === 0
            ? 'Nothing your courses hold in common, on the words they actually use.'
            : `${found.length} ${found.length === 1 ? 'place' : 'places'} they meet.`}
        </div>
        {pairs.length > 0 && (
          <div
            style={{
              marginTop: 'var(--sp-4)',
              fontSize: 'var(--type-xs)',
              color: 'var(--app-dim)',
              lineHeight: 'var(--leading-relaxed)',
              textWrap: 'pretty',
            }}
          >
            {pairs.map((p) => `${p.a} and ${p.b}: ${p.count}`).join(' · ')}
          </div>
        )}
      </Blueprint>

      {found.length === 0 && (
        <div
          style={{
            marginTop: 'var(--sp-6)',
            fontSize: 'var(--type-base)',
            color: 'var(--app-dim)',
            lineHeight: 'var(--leading-relaxed)',
            textWrap: 'pretty',
          }}
        >
          That is a real answer and not a failure: four courses in four
          departments often share nothing but the furniture of an academic
          glossary, and this screen refuses to join them on <em>data</em>,{' '}
          <em>model</em> or <em>value</em>. It will find more as you add
          readings to your courses.
        </div>
      )}

      {TIERS.map(({ why, label, note }) => {
        const rows = found.filter((m) => m.why === why);
        if (rows.length === 0) return null;
        return (
          <div key={why}>
            <SectionLabel style={{ marginTop: 'var(--sp-7)', marginBottom: 'var(--sp-4)' }}>{label}</SectionLabel>
            <div
              style={{
                fontSize: 'var(--type-xs)',
                color: 'var(--app-dim)',
                marginBottom: 'var(--sp-4)',
                lineHeight: 'var(--leading-relaxed)',
                textWrap: 'pretty',
              }}
            >
              {note}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
              {rows.map((m) => (
                <Row key={m.key} meeting={m} tint={tint} onOpen={open} />
              ))}
            </div>
          </div>
        );
      })}

      {/*
        The offer, under the four grades and above nothing.

        Placed after the matched rows rather than beside them because the
        order on this screen is the order of how much a row is worth, and a
        reading is worth less than every match above it. Offered once — a
        second press would re-read the same glossaries for the same answer.
      */}
      {configured() && sides.length >= 2 && read === null ? (
        <div style={{ marginTop: 'var(--sp-7)' }}>
          <ActionButton onClick={() => void readAcross()} disabled={reading}>
            {reading ? 'Reading both glossaries…' : 'Look for the same idea in different words'}
          </ActionButton>
          <div
            style={{
              fontSize: 'var(--type-xs)',
              color: 'var(--app-dim)',
              marginTop: 'var(--sp-3)',
              lineHeight: 'var(--leading-normal)',
              textWrap: 'pretty',
            }}
          >
            Everything above is string matching, which finds a shared word and nothing else. This
            reads your glossaries for pairs that share no word — a suggestion, shown with each
            course’s own definition.
          </div>
          <Trouble said={trouble.said} onRetry={trouble.again} />
        </div>
      ) : null}

      {read !== null && read.length === 0 ? (
        <div
          style={{
            fontSize: 'var(--type-xs)',
            color: 'var(--app-dim)',
            marginTop: 'var(--sp-7)',
            lineHeight: 'var(--leading-relaxed)',
            textWrap: 'pretty',
          }}
        >
          Nothing found beyond the matches above — which is the ordinary answer between courses in
          different departments, and a better one than a stretched analogy.
        </div>
      ) : null}
    </Page>
  );
}

function Row({
  meeting,
  tint,
  onOpen,
}: {
  meeting: Meeting;
  tint: ReturnType<typeof useStore>['tint'];
  onOpen: (courseId: string, unit: number | null) => void;
}) {
  return (
    <div
      style={{
        border: '1px solid var(--app-line)',
        borderRadius: 'var(--r-md)',
        padding: 'var(--sp-6)',
      }}
    >
      <div
        className="chrome-text"
        style={{
          fontSize: 'var(--type-md)',
          lineHeight: 'var(--leading-tight)',
          textWrap: 'pretty',
        }}
      >
        {meeting.label}
      </div>
      <div
        style={{
          marginTop: 'var(--sp-2)',
          fontSize: 'var(--type-xs)',
          color: 'var(--app-dim)',
          lineHeight: 'var(--leading-relaxed)',
          textWrap: 'pretty',
        }}
      >
        {whyLine(meeting)}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-3)', marginTop: 'var(--sp-4)' }}>
        {meeting.sides.map((s) => (
          <button
            key={s.courseId}
            type="button"
            className="bare tappable"
            onClick={() => onOpen(s.courseId, s.unit)}
            style={{
              display: 'block',
              width: '100%',
              textAlign: 'left',
              padding: 'var(--sp-5)',
              borderRadius: 'var(--r-sm)',
              // The colour is the course's, so which side is which is legible
              // before the code is read. Same stripe the course list uses.
              borderLeft: `3px solid ${tint(s.courseId).edge}`,
              background: 'var(--app-inset, transparent)',
            }}
          >
            <span
              style={{
                display: 'flex',
                gap: 'var(--sp-3)',
                alignItems: 'baseline',
                justifyContent: 'space-between',
              }}
            >
              <span className="kicker">{s.code}</span>
              <span
                style={{
                  fontSize: 'var(--type-xs)',
                  color: 'var(--app-dim)',
                  textAlign: 'right',
                }}
              >
                {s.where}
              </span>
            </span>
            <span
              style={{
                display: 'block',
                marginTop: 'var(--sp-2)',
                fontSize: 'var(--type-base)',
                lineHeight: 'var(--leading-relaxed)',
                textWrap: 'pretty',
              }}
            >
              {s.kind === 'defines' ? (
                <>
                  <strong style={{ fontWeight: 600 }}>{s.term?.t}</strong>
                  {s.term?.d ? ` — ${s.term.d}` : null}
                </>
              ) : (
                // Quoted rather than paraphrased: the claim being made is only
                // that this course's own material says the word, and the way to
                // support that claim is to show the sentence.
                <em style={{ color: 'var(--app-dim)' }}>“{s.quote ?? s.where}”</em>
              )}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
