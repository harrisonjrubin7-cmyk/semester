import type { CSSProperties, ReactNode } from 'react';
import { faintLine } from '../lib/dim';
import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { ChevronRight, Plus } from '../components/Icons';
import { SEED_SUMMARY } from '../data/seed';
import { ActionButton } from '../components/ui';
import { configured, provider } from '../lib/assistant';
import { costLine } from '../lib/allowance';

/** The footnote under a route — why it is there, or what it costs. */
const NOTE: CSSProperties = {
  fontSize: 'var(--type-xs-plus)',
  color: 'var(--app-dim)',
  lineHeight: 'var(--leading-relaxed)',
  marginTop: 'var(--sp-4)',
  textWrap: 'pretty',
};

/**
 * A way in, as a card you press.
 *
 * One component because there are two of them now, and they are the same
 * object: a plus, a name, a line of what it takes, a chevron. Written out
 * twice this was also two copies of the off-scale 17px, the `15px 16px`
 * shorthand and the chevron's hand-written `opacity` — three things the style
 * audit counts per file, and the reason it failed on the second card.
 */
function Door({
  title,
  takes,
  onClick,
  lead = false,
}: {
  title: string;
  takes: ReactNode;
  onClick: () => void;
  /** The first route on the screen, which gets the raised ground. */
  lead?: boolean;
}) {
  return (
    <Blueprint
      onClick={onClick}
      style={{
        paddingBlock: 'calc(15px * var(--density, 1))', paddingInline: 'calc(16px * var(--density, 1))',
        marginTop: lead ? 'var(--sp-7)' : 'var(--sp-5)',
        display: 'flex',
        gap: 'var(--sp-6)',
        alignItems: 'center',
        ...(lead ? { background: 'var(--app-hero)' } : null),
      }}
    >
      <Plus size={18} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: 'var(--font-heading)', fontSize: 'calc(17px * var(--text-scale, 1))' }}>
          {title}
        </span>
        <span style={{ display: 'block', fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-1)' }}>
          {takes}
        </span>
      </span>
      <ChevronRight size={16} style={{ ...faintLine(), flex: 'none' }} />
    </Blueprint>
  );
}

/**
 * What an account with no courses sees.
 *
 * An empty app should say what to do next, not pretend the semester is clear.
 * Two routes out: upload a syllabus and have the course built from it, or
 * switch on the sample and look around someone else's finished one first.
 *
 * ## The third route, and who it is for
 *
 * Both of those were the wrong answer for one particular person, and it is
 * the person this app is about to be piloted on: a student on a fresh
 * install, not signed in, with no Anthropic key. Seven screens send them
 * here. This screen named three doors — "PDF, Word, or paste the text" — and
 * all three end at `generateCourse`, which needs a key. The only other route
 * out was somebody else's four courses. So the app's answer to "I have
 * nothing yet" was an upload that stops at a gate and a sample semester, and
 * the student whose own course this is about could not add it.
 *
 * A course added by hand needs no key, no syllabus and no network, and has
 * done since `ByHand` on the import screen — it was just never named where
 * the app tells somebody what to do first. That is the whole of this: the
 * route existed, and the screen that exists to say what to do next did not
 * mention it.
 *
 * It is offered only when there is no key, and that is deliberate rather than
 * shy. With a key the syllabus route is better — it is the product — and a
 * second card beside it would be a choice nobody benefits from making.
 */
export function FirstRun({ where = 'here' }: { where?: string }) {
  const { state, dispatch } = useStore();
  const go = () => dispatch({ type: 'go', screen: 'import' });
  /*
   * What the three doors in the lead card actually need.
   *
   * `configured()` is true for a proxy, an own key, or a signed-in account on
   * the shared key. Asking it here rather than keeping a second rule means
   * this screen and the import screen's own gate cannot come to disagree
   * about whether the upload will work.
   */
  const keyed = configured();

  return (
    <Page>
      <div className="kicker">Nothing {where} yet</div>
      <div
        className="chrome-text"
        style={{ fontSize: 'calc(30px * var(--text-scale, 1))', lineHeight: 1.08, marginTop: 'var(--sp-4)', textWrap: 'pretty' }}
      >
        Start with a syllabus.
      </div>
      <div style={{ fontSize: 'var(--type-md)', color: 'var(--app-dim)', marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        Upload the PDF your professor posted — the readings too, if you have them — and the app
        builds the course from it: every dated obligation with the sentence it came from, a study
        guide, cards, a quiz and slides.
      </div>

      <Door lead title="Add your first course" takes="PDF, Word, or paste the text" onClick={go} />

      {/*
        The door that opens with nothing set up.

        Same screen as the card above, because that is where both doors are —
        and `ByHand` there opens itself when there is no key, so this lands on
        the field rather than on a link to it. The two are a pair: promising a
        form here and delivering a 12.5px aside at 0.65 opacity would be worse
        than saying nothing. `screens/keyless.test.tsx` holds the pair
        together, from both ends.
      */}
      {!keyed && (
        <>
          <Door
            title="Add a course by hand"
            takes="Just the code — no syllabus, nothing to set up"
            onClick={go}
          />
          <div style={NOTE}>
            Reading a syllabus for you needs {provider()} — sign in to use the shared key, or add
            your own under Settings. A course added by hand needs neither, and the syllabus can be
            imported over it later without losing anything you have ticked off.
          </div>
        </>
      )}

      {/*
        What the whole thing costs, on the screen where somebody is deciding
        whether to start.

        Here rather than only in onboarding because onboarding is skippable and
        this screen is not: it is what at least eight screens show when the
        catalogue is empty, so it is the page a student who skipped the
        introduction actually reads. The full sentence, allowance included —
        the short form is for the promise screen. See `lib/allowance.ts`.
      */}
      <div style={{ ...NOTE, marginTop: 'var(--sp-7)' }}>{costLine()}</div>

      {!state.sample && (
        <>
          <ActionButton
            onClick={() => dispatch({ type: 'setSample', on: true })}
            style={{ fontSize: 'var(--type-sm)', marginTop: 'var(--sp-6)' }}
          >
            Look at the sample semester
          </ActionButton>
          <div style={NOTE}>
            {SEED_SUMMARY.courses} real courses — {SEED_SUMMARY.units} units, {SEED_SUMMARY.cards}{' '}
            cards and {SEED_SUMMARY.lessons} narrated lessons — to see what a finished one looks
            like. Switch it off again in Settings.
          </div>
        </>
      )}
    </Page>
  );
}
