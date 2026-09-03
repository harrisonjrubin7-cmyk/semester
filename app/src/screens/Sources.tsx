import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel, Segmented } from '../components/ui';
import { PrintButton } from '../components/PrintButton';
import { download } from '../lib/deliver';
import {
  asLines,
  completeness,
  forCourse,
  gaps,
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
  const code = (id: string | null) => (id ? (catalog.byId[id]?.code ?? id) : 'Everything');
  const heading = `${code(courseId)}${filter ? ` · ${filter}` : ''} sources`;

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
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 12.5, opacity: 0.65, lineHeight: 1.5, textWrap: 'pretty' }}>
        Nothing here invents a citation — every source is one you entered, kept exactly as you
        wrote it. The tools that ask for your sources read from this list instead of asking again.
      </div>

      <SectionLabel>Course</SectionLabel>
      <select
        className="input"
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
        className="input"
        value={entry}
        onChange={(e) => setEntry(e.target.value)}
        placeholder="Paste it however you have it. One per line — a whole reading list goes in at once."
        style={{ width: '100%', minHeight: 84, resize: 'vertical', lineHeight: 1.5 }}
      />
      <input
        className="input"
        value={role}
        onChange={(e) => setRole(e.target.value)}
        placeholder="What is it for? — “the counter-case to the growth-machine story”"
        style={{ width: '100%', marginTop: 8 }}
      />
      <input
        className="input"
        value={into}
        onChange={(e) => setInto(e.target.value)}
        placeholder="File it under a project, if you like"
        style={{ width: '100%', marginTop: 8 }}
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
        style={{ height: 44, marginTop: 10 }}
      >
        Keep it
      </button>

      <SectionLabel>{list.length === 0 ? 'Nothing yet' : heading}</SectionLabel>
      {list.length === 0 ? (
        <div style={{ fontSize: 13, opacity: 0.6, lineHeight: 1.5, textWrap: 'pretty' }}>
          Paste the readings from a syllabus, or the four things you actually used for a paper.
          The second is the more useful list.
        </div>
      ) : (
        <>
          <div style={{ fontSize: 12.5, opacity: 0.65, marginBottom: 10, lineHeight: 1.5 }}>
            {completeness(list)}
          </div>
          {list.map((s) => {
            const missing = gaps(s);
            return (
              <Blueprint key={s.id} style={{ padding: '12px 13px', marginBottom: 8 }}>
                <div style={{ fontSize: 13.5, lineHeight: 1.45, textWrap: 'pretty' }}>{s.raw}</div>
                {s.role.trim() ? (
                  <div style={{ fontSize: 12, opacity: 0.7, marginTop: 6, lineHeight: 1.45 }}>
                    For: {s.role}
                  </div>
                ) : (
                  <input
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
                    style={{ width: '100%', marginTop: 8, fontSize: 12.5 }}
                  />
                )}
                <div
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    marginTop: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  {[s.author, s.year, s.title, s.project]
                    .filter(Boolean)
                    .map((bit) => (
                      <span key={bit} className="tag tag-outline" style={{ fontSize: 10.5 }}>
                        {bit}
                      </span>
                    ))}
                  <span style={{ flex: 1 }} />
                  <button
                    type="button"
                    className="bare"
                    onClick={() => dispatch({ type: 'dropSource', id: s.id })}
                    aria-label={`Remove ${s.raw.slice(0, 40)}`}
                    style={{ padding: '6px 10px', opacity: 0.5, fontSize: 12 }}
                  >
                    Remove
                  </button>
                </div>
                {missing.length > 0 ? (
                  <div style={{ fontSize: 11, opacity: 0.45, marginTop: 6, lineHeight: 1.4 }}>
                    Missing {missing.join(', ')}. Kept as you wrote it either way.
                  </div>
                ) : null}
              </Blueprint>
            );
          })}

          <SectionLabel>Take it with you</SectionLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() =>
                download({
                  name: `${heading.toLowerCase().replace(/[^\w]+/g, '-')}.bib`,
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
                  name: `${heading.toLowerCase().replace(/[^\w]+/g, '-')}.md`,
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
            style={{ height: 42, marginTop: 8 }}
          >
            {copied ? 'Copied' : 'Copy for a drafting tool'}
          </button>
          <PrintButton label="Print the list" style={{ marginTop: 8 }} />
          <div style={{ fontSize: 11, opacity: 0.45, marginTop: 10, lineHeight: 1.45 }}>
            BibTeX is built from the fields you entered; anything the app does not have is left out
            rather than guessed, and the line you typed always goes in as a note. Opens in Zotero
            or Overleaf.
          </div>
        </>
      )}
      <div style={{ height: 26 }} />
    </div>
  );
}
