import { useState } from 'react';
import { Capture } from './Capture';
import { ActionButton, Notice, PickChips, SectionLabel } from './ui';
import { Blueprint } from './Blueprint';
import { Trouble } from './Trouble';
import { useTrouble } from '../lib/trouble';
import { useStore } from '../state/store';
import { readPages } from '../lib/claude';
import { categoryFor, scoresIn, NOTHING_READ, type Found } from '../lib/readout';
import type { ShotFile } from '../lib/shots';
import type { GradeSystem } from '../lib/cutoffs';

/**
 * Photograph a score somewhere else, and file it here.
 *
 * `TOPHAT.md` sizes this as the smallest real piece of open work the Top Hat
 * audit found, and says why it is small: the expensive half already ships. The
 * camera is `components/Capture.tsx`, the transcriber is
 * `lib/claude.ts:readPages`, and its prompt already asks for tables kept as
 * tables with their percentages exactly as written. What was missing was a
 * destination — every shot this app took went to the course importer and came
 * back a course, which is the wrong answer for a student holding up their Top
 * Hat page to copy one number off it.
 *
 * ## The model transcribes; the app reads
 *
 * `readPages` is asked for the text on the screen and nothing else. Which of
 * those words is a score is decided by `lib/readout.ts`, in code, against
 * rules a test can hold.
 *
 * The alternative — asking the model for the score directly — is one round
 * trip shorter and has no floor under it. A blurred 8 comes back as a
 * confident 9 with nothing to check it against, and a page with no grade on it
 * comes back with a number anyway, because that is what it was asked for.
 * Reading the transcript instead means a photograph with nothing in it says
 * so, which is the answer that keeps the feature trustworthy.
 *
 * ## Nothing is filled in on anybody's behalf
 *
 * Settings › About tells every student, in the app's own words, that what they
 * enter is theirs and "nothing is filled in on your behalf". So this proposes
 * and never writes: a candidate is tapped, a category is confirmed, and only
 * then does anything reach `setGrade`. The category is pre-selected where the
 * line names one and left empty where it does not — see `categoryFor`, which
 * refuses a tie rather than opening on an arbitrary row.
 */
export function ScoreShot({
  categories,
  system,
  onFile,
}: {
  /** The course's grading rows, in their own order. */
  categories: string[];
  system: GradeSystem;
  /** Called with the category's index and the score to store against it. */
  onFile: (index: number, value: string) => void;
}) {
  const { say } = useStore();
  const trouble = useTrouble();
  const [shots, setShots] = useState<ShotFile[]>([]);
  const [reading, setReading] = useState(false);
  const [found, setFound] = useState<Found[] | null>(null);
  const [picked, setPicked] = useState<Found | null>(null);
  const [where, setWhere] = useState<number | null>(null);
  const [filed, setFiled] = useState('');

  const read = async () => {
    if (shots.length === 0 || reading) return;
    setReading(true);
    trouble.clear();
    setFiled('');
    try {
      const text = await readPages(shots.map((s) => s.shot));
      const scores = scoresIn(text, system);
      setFound(scores);
      // One candidate is not an answer, but it is the only one, so save the
      // student a tap they have no choice in.
      if (scores.length === 1) choose(scores[0]);
    } catch (e) {
      trouble.failed(e, () => void read());
    } finally {
      setReading(false);
    }
  };

  const choose = (f: Found) => {
    setPicked(f);
    setWhere(categoryFor(f.line, categories));
  };

  const file = () => {
    if (!picked || where === null) return;
    // What goes in is what was on their screen, not what this made of it —
    // `components/ScoreField.tsx` reads "13/14" the same way it reads a typed
    // one, and a student who opens the field later sees what they photographed.
    onFile(where, picked.saw);
    /*
      Announced, because it is an outcome and nothing else here is going to
      say so.

      `components/ScoreField.tsx` announces a grade when the field it owns
      loses focus. This writes the same state without that field ever being
      touched, so without this line the one change on the screen a reader
      cannot see is the one that happened. House format is "Lead · detail" —
      see `components/Said.tsx`.
    */
    say(`Grade saved · ${categories[where]}: ${picked.saw}`);
    setFiled(`${picked.saw} filed against ${categories[where]}.`);
    setShots([]);
    setFound(null);
    setPicked(null);
    setWhere(null);
  };

  return (
    <div style={{ marginTop: 'calc(18px * var(--density, 1))' }}>
      <SectionLabel style={{ marginInline: '0' }}>From a photo</SectionLabel>
      <div
        style={{
          fontSize: 'var(--type-xs)',
          color: 'var(--app-dim)',
          lineHeight: 'var(--leading-relaxed)',
          marginBottom: 'var(--sp-4)',
          textWrap: 'pretty',
        }}
      >
        Top Hat, iClicker and the rest have no way to hand this app your score — so photograph
        the screen that shows it and the number comes across. You pick which one and where it
        goes; nothing is filed until you do.
      </div>

      <Capture shots={shots} onChange={setShots} label="Photograph the score" />

      {shots.length > 0 && (
        <ActionButton
          onClick={() => void read()}
          disabled={reading}
          style={{ marginTop: 'var(--sp-4)' }}
        >
          {reading ? 'Reading it…' : 'Read the score'}
        </ActionButton>
      )}

      <Trouble said={trouble.said} onRetry={trouble.again} busy={reading} />
      {found !== null && found.length === 0 && <Notice>{NOTHING_READ}</Notice>}

      {found !== null && found.length > 0 && (
        <Proposal
          found={found}
          categories={categories}
          picked={picked}
          where={where}
          onChoose={choose}
          onWhere={setWhere}
          onFile={file}
        />
      )}

      {filed && <Notice>{filed}</Notice>}
    </div>
  );
}


/**
 * The candidates, and where each one would go.
 *
 * Separate from the camera above it because it has nothing to do with one: it
 * takes lines of text that have already been read and turns them into a choice.
 * That is also what makes it testable — jsdom has no canvas, so a shot cannot
 * be prepared in a test, and a proposal that could only be exercised through a
 * camera could only be exercised by a probe that did not really press
 * anything. See `components/scoreshot.test.tsx`.
 */
function Proposal({
  found,
  categories,
  picked,
  where,
  onChoose,
  onWhere,
  onFile,
}: {
  found: Found[];
  categories: string[];
  picked: Found | null;
  where: number | null;
  onChoose: (f: Found) => void;
  onWhere: (i: number) => void;
  onFile: () => void;
}) {
  return (
    <>
      <div style={{ marginTop: 'var(--sp-5)' }}>
        <SectionLabel style={{ marginInline: '0' }}>
          {found.length === 1 ? 'What it read' : 'Which number is yours'}
        </SectionLabel>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'calc(9px * var(--density, 1))',
            marginTop: 'var(--sp-3)',
          }}
        >
          {found.map((f, i) => {
            const on = picked === f;
            return (
              <button
                key={`${f.saw}-${i}`}
                type="button"
                className="bare"
                aria-pressed={on}
                aria-label={`${f.saw}, from the line ${f.line}`}
                onClick={() => onChoose(f)}
                style={{
                  display: 'flex',
                  gap: 'var(--sp-5)',
                  alignItems: 'baseline',
                  textAlign: 'left',
                  paddingBlock: 'calc(11px * var(--density, 1))',
                  paddingInline: 'calc(13px * var(--density, 1))',
                  border: `1px solid ${on ? 'var(--app-accent)' : 'var(--app-line)'}`,
                  background: on ? 'var(--app-accent-wash)' : 'transparent',
                }}
              >
                <span style={{ flex: 'none', fontSize: 'var(--type-md)' }}>{f.saw}</span>
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: 'var(--type-xs)',
                    color: on ? undefined : 'var(--app-dim)',
                    textWrap: 'pretty',
                  }}
                >
                  {f.line}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {picked && (
        <Blueprint
          style={{
            marginTop: 'var(--sp-5)',
            paddingBlock: 'calc(13px * var(--density, 1))',
            paddingInline: 'calc(14px * var(--density, 1))',
          }}
        >
          <div className="kicker">Which category</div>
          {where === null && (
            <div
              style={{
                fontSize: 'var(--type-xs)',
                color: 'var(--app-dim)',
                marginBlock: 'var(--sp-3)',
                textWrap: 'pretty',
              }}
            >
              Nothing on that line names one of your categories, so this is yours to say.
            </div>
          )}
          <PickChips
            options={categories.map((_, i) => i)}
            value={where ?? -1}
            onChange={onWhere}
            labels={(i) => categories[i] ?? ''}
            style={{ marginTop: 'var(--sp-3)' }}
          />
          <ActionButton
            onClick={onFile}
            disabled={where === null}
            tone="primary"
            style={{ marginTop: 'var(--sp-5)' }}
          >
            {where === null ? 'Pick a category' : `File ${picked.saw} there`}
          </ActionButton>
        </Blueprint>
      )}
    </>
  );
}

export { Proposal };
