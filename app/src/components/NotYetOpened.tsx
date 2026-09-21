/**
 * Three things in the app you have not opened.
 *
 * Sixty places, and a student uses six. The other fifty-four are not hidden —
 * they are in the directory, in search, each with a sentence saying what it is
 * for — and they are still invisible, because nobody reads a directory of
 * sixty things looking for one they do not know exists.
 *
 * So: an honest count, and three of them, rotating by the day. Not a
 * marketing panel — the count is theirs, the three are ones they genuinely
 * have not been to, and the whole thing disappears for good once they have
 * seen most of the app. The rules are in `lib/unseen.ts`.
 */

import { useNow, useStore } from '../state/store';
import { SectionLabel } from './ui';
import { TabGlyph } from './TabIcon';
import { dayOf, offer, seenLine } from '../lib/unseen';
import { saysFor, type Destination } from '../lib/nav';
import { Folding } from './Fold';

/**
 * The pool is the caller's, and that is the whole of the fix.
 *
 * This read `DESTINATIONS` through `offerable()`, which is the registry
 * before any gate — so on a brand-new account the directory drew twelve
 * screens and this panel, directly underneath it, offered three of the
 * forty-six it was holding back, by name and with their sentences. Measured
 * on a fresh profile: the list said twelve and this said *Pathway, Career,
 * Family*, none of which was in it.
 *
 * Reveal is only the visible half. The registry is also every screen the app
 * has ever had before the school and the role have spoken, so the same panel
 * could offer a meal plan at a university with no meal plan. `lately`, the
 * list beside this one, has been gated since it was written; this one never
 * was, and nothing was comparing them.
 */
export function NotYetOpened({ pool }: { pool?: Destination[] }) {
  const { state, dispatch, school } = useStore();
  const now = useNow();

  const three = offer(state.visited, dayOf(now), pool);
  if (three.length === 0) return null;

  return (
    <Folding name="NotYetOpened">
      <SectionLabel
        style={{ marginTop: 'calc(26px * var(--density, 1))', marginInline: '0', marginBottom: 'calc(4px * var(--density, 1))' }}
      >
        Not opened yet
      </SectionLabel>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', color: 'var(--app-dim)', marginBottom: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
        {seenLine(state.visited, pool)} These three change each day.
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
        {three.map((d) => (
          <button
            key={d.screen}
            type="button"
            className="bare tappable"
            onClick={() => dispatch({ type: 'go', screen: d.screen })}
            style={{
              display: 'flex',
              gap: 'calc(11px * var(--density, 1))',
              alignItems: 'flex-start',
              textAlign: 'left',
              paddingBlock: 'calc(11px * var(--density, 1))', paddingInline: 'calc(12px * var(--density, 1))',
              borderRadius: 'var(--r-md)',
              border: '1px solid var(--app-line)',
            }}
          >
            <span style={{ flex: 'none', color: 'var(--app-dim)', paddingTop: 'calc(1px * var(--density, 1))' }}>
              <TabGlyph screen={d.screen} size={16} />
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 'calc(13.5px * var(--text-scale, 1))' }}>{saysFor(d, school.capabilities).label}</span>
              {/* The directory's own sentence, not a second one written for
                  here — two descriptions of the same screen would drift. */}
              <span
                style={{
                  display: 'block',
                  fontSize: 'calc(11.5px * var(--text-scale, 1))',
                  color: 'var(--app-dim)',
                  marginTop: 'var(--sp-1)',
                  lineHeight: 1.4,
                }}
              >
                {saysFor(d, school.capabilities).blurb}
              </span>
            </span>
          </button>
        ))}
      </div>
    </Folding>
  );
}
