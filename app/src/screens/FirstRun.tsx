import { useStore } from '../state/store';
import { Page } from '../components/Page';
import { Blueprint } from '../components/Blueprint';
import { ChevronRight, Plus } from '../components/Icons';
import { SEED_SUMMARY } from '../data/seed';
import { ActionButton } from '../components/ui';

/**
 * What an account with no courses sees.
 *
 * An empty app should say what to do next, not pretend the semester is clear.
 * Two routes out: upload a syllabus and have the course built from it, or
 * switch on the sample and look around someone else's finished one first.
 */
export function FirstRun({ where = 'here' }: { where?: string }) {
  const { state, dispatch } = useStore();

  return (
    <Page>
      <div className="kicker">Nothing {where} yet</div>
      <div
        className="chrome-text"
        style={{ fontSize: 'calc(30px * var(--text-scale, 1))', lineHeight: 1.08, marginTop: 'var(--sp-4)', textWrap: 'pretty' }}
      >
        Start with a syllabus.
      </div>
      <div style={{ fontSize: 'var(--type-md)', opacity: 0.72, marginTop: 'var(--sp-4)', lineHeight: 'var(--leading-relaxed)', textWrap: 'pretty' }}>
        Upload the PDF your professor posted — the readings too, if you have them — and the app
        builds the course from it: every dated obligation with the sentence it came from, a study
        guide, cards, a quiz and slides.
      </div>

      <Blueprint
        onClick={() => dispatch({ type: 'go', screen: 'import' })}
        style={{
          padding: '15px 16px',
          marginTop: 'var(--sp-7)',
          display: 'flex',
          gap: 'var(--sp-6)',
          alignItems: 'center',
          background: 'var(--app-hero)',
        }}
      >
        <Plus size={18} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: 'var(--font-heading)', fontSize: 'calc(17px * var(--text-scale, 1))' }}>
            Add your first course
          </span>
          <span style={{ display: 'block', fontSize: 'var(--type-sm)', opacity: 0.6, marginTop: 'var(--sp-1)' }}>
            PDF, Word, or paste the text
          </span>
        </span>
        <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
      </Blueprint>

      {!state.sample && (
        <>
          <ActionButton
            onClick={() => dispatch({ type: 'setSample', on: true })}
            style={{ fontSize: 'var(--type-sm)', marginTop: 'var(--sp-6)' }}
          >
            Look at the sample semester
          </ActionButton>
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, lineHeight: 'var(--leading-relaxed)', marginTop: 'var(--sp-4)' }}>
            {SEED_SUMMARY.courses} real courses — {SEED_SUMMARY.units} units, {SEED_SUMMARY.cards}{' '}
            cards and {SEED_SUMMARY.lessons} narrated lessons — to see what a finished one looks
            like. Switch it off again in Settings.
          </div>
        </>
      )}
    </Page>
  );
}
