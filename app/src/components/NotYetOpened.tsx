/**
 * Three things in the app you have not opened.
 *
 * Forty-two places, and a student uses six. The other thirty-six are not
 * hidden — they are in the directory, in search, each with a sentence saying
 * what it is for — and they are still invisible, because nobody reads a
 * directory of forty-two things looking for one they do not know exists.
 *
 * So: an honest count, and three of them, rotating by the day. Not a
 * marketing panel — the count is theirs, the three are ones they genuinely
 * have not been to, and the whole thing disappears for good once they have
 * seen most of the app. The rules are in `lib/unseen.ts`.
 */

import { useStore } from '../state/store';
import { SectionLabel } from './ui';
import { TabGlyph } from './TabIcon';
import { dayOf, offer, seenLine } from '../lib/unseen';

export function NotYetOpened() {
  const { state, dispatch, now } = useStore();

  const three = offer(state.visited, dayOf(now));
  if (three.length === 0) return null;

  return (
    <>
      <SectionLabel
        style={{ margin: 'calc(26px * var(--density, 1)) 0 calc(4px * var(--density, 1))' }}
      >
        Not opened yet
      </SectionLabel>
      <div style={{ fontSize: 12.5, opacity: 0.6, marginBottom: 10, lineHeight: 1.45 }}>
        {seenLine(state.visited)} These three change each day.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {three.map((d) => (
          <button
            key={d.screen}
            type="button"
            className="bare tappable"
            onClick={() => dispatch({ type: 'go', screen: d.screen })}
            style={{
              display: 'flex',
              gap: 11,
              alignItems: 'flex-start',
              textAlign: 'left',
              padding: '11px 12px',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--app-line)',
            }}
          >
            <span style={{ flex: 'none', opacity: 0.5, paddingTop: 1 }}>
              <TabGlyph screen={d.screen} size={16} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13.5 }}>{d.label}</span>
              {/* The directory's own sentence, not a second one written for
                  here — two descriptions of the same screen would drift. */}
              <span
                style={{
                  display: 'block',
                  fontSize: 11.5,
                  opacity: 0.55,
                  marginTop: 2,
                  lineHeight: 1.4,
                }}
              >
                {d.blurb}
              </span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
