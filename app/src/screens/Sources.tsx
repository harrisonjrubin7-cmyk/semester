import { useMemo, useState } from 'react';
import { secondLine } from '../lib/dim';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { Page } from '../components/Page';
import { EmptyState, SectionLabel, Segmented } from '../components/ui';
import { PrintButton } from '../components/PrintButton';
import { FindSources } from '../components/FindSources';
import { download } from '../lib/deliver';
import {
  asLines,
  completeness,
  forCourse,
  gaps,
  listFile,
  listName,
  parse,
  projects,
  toBibtex,
  toMarkdown,
} from '../lib/sources';

/**
 * The sources you have, kept once instead of retyped every session.
 *
 * Four tools in this app refuse to invent a citation and ask for yours
 * instead. That refusal is right and it was also a repeated inconvenience —
 * the same six readings pasted into a textarea every time, from memory, with
 * the page numbers wrong. They live here now, per course and per project.
 *
 * Nothing on this screen generates a citation. A source is here because you
 * typed it or pasted it, and the line you gave is kept exactly as given: the
 * parser fills in a year, a quoted title and a URL where their shape is
 * unambiguous and leaves everything else alone, because a wrong author in a
 * bibliography is worse than no author. The raw line is right there to read;
 * a parsed field looks like it was checked.
 *
 * ## A third way in, which does not weaken that
 *
 * `components/FindSources.tsx` sits in the middle of this screen and searches
 * the open web. It is worth being precise about why that is not a breach of
 * the sentence above, because it looks like one.
 *
 * A generated citation is the model composing a plausible author, journal and
 * year for a paper that does not exist — the failure this screen was built
 * against. What the search hands back is a *URL that was opened*: the title is
 * the page's own, the address resolves, and the panel claims no author and no
 * year precisely because a search result does not reliably carry either. The
 * line it offers is built for you to correct, not to trust.
 *
 * And nothing it finds arrives here by itself. Each row has an Add beside it
 * and goes through the same path a pasted line does, so a source is still here
 * because you put it here. The field that earns marks — what it is for — is
 * left empty on what it adds, for the reason below: nothing that has read a
 * search result can honestly fill it in.
 *
 * The field that matters is "what it is for". It is the one that improves an
 * essay — a source you cannot say that about does not belong in the paper —
 * and the one nobody keeps.
 */
export function Sources() {
  const { state, dispatch, catalog } = useStore();

  const [courseId, setCourseId] = useState<string | null>(null);
  // Two separate things that were one field on the first pass, which meant
  // typing a project name for a new source silently re-filtered the list you
  // were looking at. `filter` is what you are looking at; `into` is where the
  // next source goes.
  const [filter, setFilter] = useState('');
  const [into, setInto] = useState('');
  const [entry, setEntry] = useState('');
  const [role, setRole] = useState('');
  const [copied, setCopied] = useState(false);

  const list = useMemo(() => {
    const forThisCourse = forCourse(state.sources, courseId);
    return filter ? forThisCourse.filter((s) => s.project === filter) : forThisCourse;
  }, [state.sources, courseId, filter]);

  const names = useMemo(() => projects(forCourse(state.sources, courseId)), [state.sources, courseId]);
  /*
   * The course as a word, and nothing when no course is chosen. The picker's
   * own first option says "Everything", and that label deliberately does not
   * come through here — `lib/sources.ts:listName` says why a picker's word and
   * a heading's word are two different jobs.
   */
  const code = (id: string | null) => (id ? (catalog.byId[id]?.code ?? id) : '');
  const heading = listName(code(courseId), filter);

  const add = () => {
    const text = entry.trim();
    if (!text) return;
    // One per line, so a whole reading list pastes in at once.
    for (const line of text.split('\n').map((l) => l.trim()).filter(Boolean)) {
      dispatch({
        type: 'addSource',
        source: { ...parse(line), role: role.trim(), courseId, project: into.trim() },
      });
    }
    setEntry('');
    setRole('');
  };

  return (
    <Page
      bottom={26}
      blurb="Nothing here invents a citation. A source is one you entered, or one a search actually opened and you chose to keep — kept exactly as it came. The tools that ask for your sources read from this list instead of asking again."
    >
        <>
          <SectionLabel>Course</SectionLabel>
          <select
            className="input"
            aria-label="Course"
            value={courseId ?? ''}
            onChange={(e) => {
              setCourseId(e.target.value || null);
              setFilter('');
            }}
            style={{ width: '100%' }}
          >
            <option value="">Everything</option>
            {catalog.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code}
              </option>
            ))}
          </select>

          {names.length > 0 && (
            <>
              <SectionLabel>Showing</SectionLabel>
              <Segmented
                options={[{ id: '', label: 'All' }, ...names.map((n) => ({ id: n, label: n }))]}
                value={filter}
                onChange={setFilter}
              />
            </>
          )}

          <SectionLabel>Add a source</SectionLabel>
          <textarea
            aria-label="The source"
            className="input"
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            placeholder="Paste it however you have it. One per line — a whole reading list goes in at once."
            style={{ width: '100%', minHeight: 84, resize: 'vertical', lineHeight: 'var(--leading-relaxed)' }}
          />
          <input
            aria-label="What it is for"
            className="input"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="What is it for? — “the counter-case to the growth-machine story”"
            style={{ width: '100%', marginTop: 'var(--sp-4)' }}
          />
          <input
            aria-label="The project it belongs to"
            className="input"
            value={into}
            onChange={(e) => setInto(e.target.value)}
            placeholder="File it under a project, if you like"
            style={{ width: '100%', marginTop: 'var(--sp-4)' }}
            list="known-projects"
          />
          <datalist id="known-projects">
            {names.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={add}
            disabled={!entry.trim()}
            style={{ height: 44, marginTop: 'var(--sp-5)' }}
          >
            Keep it
          </button>

          {/*
            The other way a source gets here, and it goes through the same Add.

            `components/FindSources.tsx` searches the open web and offers what
            it opened; nothing reaches the list until it is tapped. It draws
            nothing at all without a key, so the screen is unchanged for
            anybody not using the assistant.
          */}
          <FindSources />

          {list.length > 0 && <SectionLabel>{heading}</SectionLabel>}
          {/* `list`, not `list`: this is the screen saying you have no sources at
              all. A search that matched nothing is a different thing, and
              `<Page>` says so itself — showing both was two answers to one
              question, one of them wrong. */}
          {list.length === 0 ? (
            <EmptyState
              inline
              title="Nothing yet"
              body="Paste the readings from a syllabus, or the four things you actually used for a paper. The second is the more useful list."
            />
          ) : (
            <>
              <div style={{ fontSize: 'var(--type-sm-plus)', color: 'var(--app-dim)', marginBottom: 'var(--sp-5)', lineHeight: 'var(--leading-relaxed)' }}>
                {completeness(list)}
              </div>
              {list.map((s) => {
                const missing = gaps(s);
                return (
                  <Blueprint plain key={s.id} style={{ paddingBlock: 'calc(12px * var(--density, 1))', paddingInline: 'calc(13px * var(--density, 1))', marginBottom: 'var(--sp-4)' }}>
                    <div style={{ fontSize: 'var(--type-base-plus)', lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>{s.raw}</div>
                    {s.role.trim() ? (
                      <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)' }}>
                        For: {s.role}
                      </div>
                    ) : (
                      <input
                        aria-label="What this source is for"
                        className="input"
                        defaultValue=""
                        placeholder="What is it for?"
                        onBlur={(e) =>
                          e.target.value.trim() &&
                          dispatch({
                            type: 'patchSource',
                            id: s.id,
                            patch: { role: e.target.value.trim() },
                          })
                        }
                        style={{ width: '100%', marginTop: 'var(--sp-4)', fontSize: 'var(--type-sm-plus)' }}
                      />
                    )}
                    <div
                      style={{
                        display: 'flex',
                        gap: 'var(--sp-4)',
                        alignItems: 'center',
                        marginTop: 'var(--sp-4)',
                        flexWrap: 'wrap',
                      }}
                    >
                      {[s.author, s.year, s.title, s.project]
                        .filter(Boolean)
                        .map((bit) => (
                          <span key={bit} className="tag tag-outline" style={{ fontSize: 'var(--type-2xs-plus)' }}>
                            {bit}
                          </span>
                        ))}
                      <span style={{ flex: 1 }} />
                      <button
                        type="button"
                        className="bare"
                        onClick={() => dispatch({ type: 'dropSource', id: s.id })}
                        aria-label={`Remove ${s.raw.slice(0, 40)}`}
                        style={{ paddingBlock: 'calc(6px * var(--density, 1))', paddingInline: 'calc(10px * var(--density, 1))', color: 'var(--app-dim)', fontSize: 'var(--type-sm)' }}
                      >
                        Remove
                      </button>
                    </div>
                    {missing.length > 0 ? (
                      <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal-minus)' }}>
                        Missing {missing.join(', ')}. Kept as you wrote it either way.
                      </div>
                    ) : null}
                  </Blueprint>
                );
              })}

              <SectionLabel>Take it with you</SectionLabel>
              <div style={{ display: 'flex', gap: 'var(--sp-4)' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    download({
                      name: listFile(heading, 'bib'),
                      body: toBibtex(list),
                      mime: 'text/plain',
                    })
                  }
                  style={{ flex: 1, height: 42 }}
                >
                  BibTeX
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() =>
                    download({
                      name: listFile(heading, 'md'),
                      body: toMarkdown(list, heading),
                      mime: 'text/markdown',
                    })
                  }
                  style={{ flex: 1, height: 42 }}
                >
                  Reading list
                </button>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-block"
                onClick={() => {
                  void navigator.clipboard?.writeText(asLines(list));
                  setCopied(true);
                }}
                style={{ height: 42, marginTop: 'var(--sp-4)' }}
              >
                {copied ? 'Copied' : 'Copy for a drafting tool'}
              </button>
              <PrintButton label="Print the list" style={{ marginTop: 'var(--sp-4)' }} />
              <div style={{ fontSize: 'var(--type-xs)', ...secondLine(), marginTop: 'var(--sp-5)', lineHeight: 'var(--leading-normal)' }}>
                BibTeX is built from the fields you entered; anything the app does not have is left out
                rather than guessed, and the line you typed always goes in as a note. Opens in Zotero
                or Overleaf.
              </div>
            </>
          )}
        </>
    </Page>
  );
}
