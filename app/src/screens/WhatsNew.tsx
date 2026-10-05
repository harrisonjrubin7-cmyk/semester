import { useMemo } from 'react';
import { FeedbackPanelSlot } from '../components/FeedbackPanel';
import { Page } from '../components/Page';
import { Group as Panel, NavRow } from '../components/shell/Rows';
import { MODULE_FLAGS } from '../lib/experience-flags';
import { formatDate } from '../lib/locale';
import { DESTINATIONS } from '../lib/nav';
import { knownIssues, visible, type Note } from '../lib/whatsnew';
import { useStore } from '../state/store';

/**
 * What changed, in the app.
 *
 * The notes in `lib/whatsnew.ts`, filtered to the modules this build has on,
 * newest first: what you will see, what to do, and where. Known issues are
 * listed apart, and "none" is said out loud rather than left to be inferred
 * from an empty space.
 */
export function WhatsNew() {
  const { dispatch } = useStore();
  const notes = useMemo(() => visible(MODULE_FLAGS), []);
  const known = knownIssues(notes);
  const labels = useMemo(() => new Map(DESTINATIONS.map((d) => [d.screen, d.short ?? d.label])), []);

  return (
    <Page blurb="Anything you can notice, dated by when it reached the live page — including things taken away again. Only the parts of the app your school has switched on are listed.">
      <section aria-labelledby="wn-known" style={{ marginBottom: 'var(--sp-7)' }}>
        <Kicker id="wn-known">Known issues</Kicker>
        {known.length === 0 ? (
          <p style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', margin: 0 }}>None known. If something is wrong, say so from any screen’s About this screen, or from Help.</p>
        ) : (
          known.map((n) => <NoteCard key={`${n.date}-${n.title}`} note={n} labels={labels} onOpen={(s) => dispatch({ type: 'go', screen: s })} />)
        )}
      </section>

      <section aria-labelledby="wn-new" style={{ marginBottom: 'var(--sp-7)' }}>
        <Kicker id="wn-new">What’s new</Kicker>
        <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--sp-4)' }}>
          {notes.filter((n) => !n.known).map((n) => (
            <li key={`${n.date}-${n.title}`}>
              <NoteCard note={n} labels={labels} onOpen={(s) => dispatch({ type: 'go', screen: s })} />
            </li>
          ))}
        </ol>
      </section>

      {/* Off unless VITE_ME_MOMENT_FEEDBACK is set; see lib/momentfeedback.ts. */}
      <FeedbackPanelSlot />

      <Panel>
        <NavRow label="Say something" sub="Report a problem, or ask for what is missing" onClick={() => dispatch({ type: 'go', screen: 'setAbout' })} />
        <NavRow label="How this works" sub="The guide to every screen" onClick={() => dispatch({ type: 'go', screen: 'help' })} />
      </Panel>
    </Page>
  );
}

function Kicker({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 var(--sp-4)', fontFamily: 'var(--font-heading)' }}>
      {children}
    </h2>
  );
}

function NoteCard({ note, labels, onOpen }: { note: Note; labels: Map<string, string>; onOpen: (screen: Note['screens'][number]) => void }) {
  return (
    <article
      aria-label={note.title}
      style={{ padding: 'var(--sp-4) var(--sp-5)', border: '1px solid var(--app-line)', borderRadius: 'var(--r-md)', background: 'var(--app-panel)' }}
    >
      <div style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', letterSpacing: '0.08em' }}>{formatDate(new Date(`${note.date}T12:00:00`), { day: 'numeric', month: 'long' })}</div>
      <h3 style={{ fontFamily: 'var(--font-heading)', fontSize: 'var(--type-md)', margin: 'var(--sp-1) 0 var(--sp-3)', lineHeight: 'var(--leading-display)' }}>{note.title}</h3>
      <p style={{ fontSize: 'var(--type-sm)', margin: '0 0 var(--sp-3)', lineHeight: 'var(--leading-relaxed)' }}>{note.sees}</p>
      <p style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', margin: 0 }}>{note.doTo}</p>
      <p style={{ margin: 'var(--sp-3) 0 0', display: 'flex', flexWrap: 'wrap', gap: 'var(--sp-3)' }}>
        {note.screens.filter((s) => labels.has(s)).map((s) => (
          <button key={s} type="button" className="bare" onClick={() => onOpen(s)} style={{ width: 'auto', fontSize: 'var(--type-xs)', letterSpacing: '0.08em', color: 'var(--app-accent)' }}>
            OPEN {labels.get(s)!.toUpperCase()}
          </button>
        ))}
      </p>
    </article>
  );
}
