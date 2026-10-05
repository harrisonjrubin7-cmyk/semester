import { useMemo } from 'react';
import { Page } from '../components/Page';
import { EmptyState } from '../components/ui';
import { Group as Panel, NavRow } from '../components/shell/Rows';
import { byDay, line, readJournal, type Entry } from '../lib/journal';
import { formatDate, formatTime } from '../lib/locale';
import { useStore } from '../state/store';

/**
 * Your own activity, in order.
 *
 * What `lib/journal.ts` holds, drawn by day, newest first: what you did and
 * what you shared, each with where it came from, who can see it and whether
 * it still stands. Nothing here is content, and nothing here is the app
 * talking to you — it is your trail, and you can check it.
 */
export function Activity() {
  const { account, dispatch } = useStore();
  const id = account?.id ?? null;
  const days = useMemo(() => byDay(readJournal(id)), [id]);

  return (
    <Page blurb="What you did and what you shared, in order. Each entry says where it came from, who can see it and whether it still stands. It stays on this device and holds no content — a plan was saved, not what was in it.">
      {days.length === 0 ? (
        <EmptyState
          title="Nothing recorded yet."
          body="Saving a plan, sharing an agenda, letting support in or asking for an export will each leave a line here."
        />
      ) : (
        days.map(({ day, entries }) => (
          <section key={day} aria-label={formatDate(new Date(`${day}T12:00:00`), { weekday: 'long', day: 'numeric', month: 'long' })} style={{ marginBottom: 'var(--sp-7)' }}>
            <h2
              style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', letterSpacing: '0.1em', textTransform: 'uppercase', margin: '0 0 var(--sp-4)', fontFamily: 'var(--font-heading)' }}
            >
              {formatDate(new Date(`${day}T12:00:00`), { weekday: 'long', day: 'numeric', month: 'long' })}
            </h2>
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 'var(--sp-4)' }}>
              {entries.map((e, i) => <Row key={`${e.at}-${i}`} entry={e} />)}
            </ol>
          </section>
        ))
      )}
      <Panel>
        <NavRow label="Sharing and support access" sub="Take back anything here that should not stand" onClick={() => dispatch({ type: 'go', screen: 'privacy' })} />
        <NavRow label="Recovery" sub="If something you did is not here, or went missing" onClick={() => dispatch({ type: 'go', screen: 'recovery' })} />
      </Panel>
    </Page>
  );
}

function Row({ entry }: { entry: Entry }) {
  const p = entry.provenance;
  return (
    <li
      style={{
        padding: 'var(--sp-4) var(--sp-5)',
        border: '1px solid var(--app-line)',
        borderRadius: 'var(--r-md)',
        background: 'var(--app-panel)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--sp-4)', alignItems: 'baseline' }}>
        <span style={{ fontSize: 'var(--type-base)' }}>{line(entry)}</span>
        <time dateTime={new Date(entry.at).toISOString()} style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', flex: 'none' }}>
          {formatTime(entry.at)}
        </time>
      </div>
      {entry.about ? <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-1)' }}>{entry.about.label}</div> : null}
      <dl
        aria-label="Source, scope and status"
        style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 'var(--sp-1) var(--sp-4)', margin: 'var(--sp-3) 0 0', fontSize: 'var(--type-xs)', color: 'var(--app-dim)' }}
      >
        <dt>Source</dt><dd style={{ margin: 0 }}>{p.source}</dd>
        <dt>Scope</dt><dd style={{ margin: 0 }}>{p.scope}</dd>
        <dt>Status</dt><dd style={{ margin: 0 }}>{p.status}</dd>
      </dl>
    </li>
  );
}
