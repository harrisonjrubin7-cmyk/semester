import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { ChevronRight, Plus } from '../components/Icons';
import { SEED_SUMMARY } from '../data/seed';

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
    <div style={{ padding: 18 }}>
      <div className="kicker">Nothing {where} yet</div>
      <div
        className="chrome-text"
        style={{ fontSize: 30, lineHeight: 1.08, marginTop: 8, textWrap: 'pretty' }}
      >
        Start with a syllabus.
      </div>
      <div style={{ fontSize: 14, opacity: 0.72, marginTop: 8, lineHeight: 1.5, textWrap: 'pretty' }}>
        Upload the PDF your professor posted — the readings too, if you have them — and the app
        builds the course from it: every dated obligation with the sentence it came from, a study
        guide, cards, a quiz and slides.
      </div>

      <Blueprint
        onClick={() => dispatch({ type: 'go', screen: 'import' })}
        style={{
          padding: '15px 16px',
          marginTop: 16,
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          background: 'var(--app-hero)',
        }}
      >
        <Plus size={18} />
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: 'var(--font-heading)', fontSize: 17 }}>
            Add your first course
          </span>
          <span style={{ display: 'block', fontSize: 12, opacity: 0.6, marginTop: 2 }}>
            PDF, Word, or paste the text
          </span>
        </span>
        <ChevronRight size={16} style={{ opacity: 0.4, flex: 'none' }} />
      </Blueprint>

      {!state.sample && (
        <>
          <button
            type="button"
            className="btn btn-secondary btn-block"
            onClick={() => dispatch({ type: 'setSample', on: true })}
            style={{
              height: 44,
              fontSize: 12,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              marginTop: 12,
            }}
          >
            Look at the sample semester
          </button>
          <div style={{ fontSize: 11.5, opacity: 0.55, lineHeight: 1.5, marginTop: 8 }}>
            {SEED_SUMMARY.courses} real courses — {SEED_SUMMARY.units} units, {SEED_SUMMARY.cards}{' '}
            cards and {SEED_SUMMARY.lessons} narrated lessons — to see what a finished one looks
            like. Switch it off again in Settings.
          </div>
        </>
      )}
      <div style={{ height: 22 }} />
    </div>
  );
}
