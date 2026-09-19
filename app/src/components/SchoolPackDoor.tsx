import { useRef, useState } from 'react';
import { FilePick, Notice, SectionLabel } from './ui';
import { useStore } from '../state/store';
import { download } from '../lib/deliver';
import { PACK_TEMPLATE, readPack, writePack, type PackRead } from '../lib/schoolpack';

/**
 * The door a university's own data comes through.
 *
 * `SchoolPicker` has two ways to answer "where do you study" and both assume
 * the answer is short: find your school in a list, or type eight answers
 * about it. That is the right shape for one student filling in their own
 * university, and it is the wrong shape for the thing a partnership actually
 * produces — a registrar's term calendar, an estates team's two hundred
 * buildings, dining's plan tiers. Nobody types that.
 *
 * So this is the third door, and it is the one that makes the whole thing
 * work without a code change: a school exports a file, somebody loads it, and
 * the screens that were switched off come on. See `lib/schoolpack.ts` for the
 * format and what it refuses.
 *
 * ## Nothing lands before somebody has read what is in it
 *
 * Choosing a file does not import it. It shows what the file turned out to
 * contain — the school's name, when it was written, how many terms and
 * deadlines and buildings survived, and every part that did not — and then
 * asks. That is the same review-then-confirm the syllabus importer and the
 * registrar's paste door already keep, and it matters more here, because a
 * pack silently replaces dates a student is already planning around.
 *
 * ## The problems are the feature, not an error state
 *
 * A partner's first export is never clean. Fourteen buildings will have no
 * coordinates because one spreadsheet column was never filled in. Listing
 * every one of those by name, while loading everything else, is what turns a
 * failed import into a short email back to whoever sent it. A screen that
 * said "imported successfully" and quietly held 186 of 200 buildings would be
 * the worse outcome by a distance.
 */
export function SchoolPackDoor() {
  const { state, dispatch, school } = useStore();
  const [read, setRead] = useState<PackRead | null>(null);
  const [pasting, setPasting] = useState(false);
  const [pasted, setPasted] = useState('');
  const [showAll, setShowAll] = useState(false);
  const busy = useRef(false);

  const loaded = state.schoolPack;

  const take = (source: string) => {
    setRead(readPack(source));
    setShowAll(false);
    setPasting(false);
    setPasted('');
  };

  const onPick = (files: File[]) => {
    const file = files[0];
    if (!file || busy.current) return;
    busy.current = true;
    file
      .text()
      .then(take)
      // A file the browser cannot read at all — a directory, a revoked
      // permission — comes back as a sentence rather than as nothing
      // happening, which is what an unhandled rejection looks like here.
      .catch(() => setRead(readPack('')))
      .finally(() => {
        busy.current = false;
      });
  };

  const quiet = {
    width: 'auto' as const,
    textDecoration: 'underline',
    fontSize: 'var(--type-xs)',
    color: 'var(--app-dim)',
  };

  // ── What is in the file, before anything is kept ──────────────────────

  if (read) {
    if (!read.ok) {
      return (
        <div>
          <SectionLabel>That file could not be read</SectionLabel>
          <Notice alert>{read.problems[0].says}</Notice>
          <button type="button" className="btn btn-secondary btn-block" onClick={() => setRead(null)}>
            Try another file
          </button>
        </div>
      );
    }

    const { school: incoming, counts, problems, importedAt } = read;
    const lines: string[] = [];
    if (counts.terms) lines.push(`${counts.terms} ${counts.terms === 1 ? 'term' : 'terms'}`);
    if (counts.deadlines) lines.push(`${counts.deadlines} dated ${counts.deadlines === 1 ? 'deadline' : 'deadlines'}`);
    if (counts.buildings) lines.push(`${counts.buildings} ${counts.buildings === 1 ? 'building' : 'buildings'}`);
    if (counts.tiers) lines.push(`${counts.tiers} meal ${counts.tiers === 1 ? 'plan' : 'plans'}`);
    const shown = showAll ? problems : problems.slice(0, 8);

    return (
      <div>
        <SectionLabel>Before this is kept</SectionLabel>
        <div style={{ fontSize: 'var(--type-md)', marginTop: 'var(--sp-3)' }}>{incoming.name}</div>
        <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-2)', lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
          {lines.length ? lines.join(' · ') : 'Names and links only — no calendar, buildings or meal plans in this one.'}
          {/* Provenance, not decoration. These dates are drawn with total
              confidence once they are in, and this is the only thing on any
              screen that says how old they are. */}
          {importedAt ? ` · written ${importedAt}` : ' · this file does not say when it was written'}
        </div>

        {problems.length > 0 && (
          // Announced, not just drawn. Choosing a file is the action; how much
          // of it could not be used is the outcome, and somebody using a
          // screen reader has to hear it rather than find it.
          <div role="status" style={{ marginTop: 'var(--sp-5)' }}>
            <div style={{ fontSize: 'var(--type-sm)', lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
              {problems.length === 1 ? 'One part of this file could not be used' : `${problems.length} parts of this file could not be used`}. Everything
              else loads. Send this list back to whoever sent you the file.
            </div>
            <ul style={{ margin: 'var(--sp-3) 0 0', paddingInlineStart: '1.1em' }}>
              {shown.map((p, i) => (
                <li key={`${p.where}-${i}`} style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', marginTop: 'var(--sp-2)', lineHeight: 'var(--leading-normal)' }}>
                  <strong style={{ color: 'var(--app-fg)', fontWeight: 500 }}>{p.where}</strong> — {p.says}
                </li>
              ))}
            </ul>
            {problems.length > shown.length && (
              <button type="button" className="bare tappable" onClick={() => setShowAll(true)} style={{ ...quiet, marginTop: 'var(--sp-3)' }}>
                Show the other {problems.length - shown.length}
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-6)' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setRead(null)} style={{ flex: 1, height: 44 }}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              dispatch({ type: 'importSchoolPack', school: incoming, importedAt });
              setRead(null);
            }}
            style={{ flex: 1, height: 44 }}
          >
            Use this
          </button>
        </div>
      </div>
    );
  }

  // ── The resting state ────────────────────────────────────────────────

  return (
    <div>
      <SectionLabel>A file from your university</SectionLabel>
      <div style={{ fontSize: 'var(--type-sm)', color: 'var(--app-dim)', marginTop: 'var(--sp-3)', lineHeight: 'var(--leading-normal)', textWrap: 'pretty' }}>
        If your university has sent you its term calendar, buildings or meal plans as a Semester
        pack, load it here. You see what is in it before anything is kept, and removing it puts
        everything back.
      </div>

      {loaded && (
        <div style={{ marginTop: 'var(--sp-4)', padding: 'var(--sp-4)', border: '1px solid var(--app-line)', borderRadius: 'var(--r-md)' }}>
          <div style={{ fontSize: 'var(--type-base)' }}>{loaded.school.name}</div>
          <div style={{ fontSize: 'var(--type-xs)', color: 'var(--app-dim)', marginTop: 'var(--sp-2)', lineHeight: 'var(--leading-normal)' }}>
            Loaded from a file{loaded.importedAt ? ` written ${loaded.importedAt}` : ''}. It is a
            snapshot, not a connection — these dates were true when the file was written and the
            app has no way to notice when they stop being.
          </div>
          <button
            type="button"
            className="bare tappable"
            onClick={() => dispatch({ type: 'forgetSchoolPack' })}
            style={{ ...quiet, marginTop: 'var(--sp-3)' }}
          >
            Remove this file
          </button>
        </div>
      )}

      {pasting ? (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <textarea
            className="input"
            value={pasted}
            aria-label="Paste the pack"
            placeholder="Paste the contents of the file"
            onChange={(e) => setPasted(e.target.value)}
            style={{ minHeight: 140, fontFamily: 'var(--font-mono, monospace)', fontSize: 'var(--type-xs)' }}
          />
          <div style={{ display: 'flex', gap: 'var(--sp-4)', marginTop: 'var(--sp-4)' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setPasting(false)} style={{ flex: 1, height: 44 }}>
              Back
            </button>
            <button type="button" className="btn btn-primary" disabled={!pasted.trim()} onClick={() => take(pasted)} style={{ flex: 1, height: 44 }}>
              Read it
            </button>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 'var(--sp-4)' }}>
          <FilePick accept="application/json,.json" multiple={false} onPick={onPick}>
            {loaded ? 'Load a different file' : 'Choose the file'}
          </FilePick>
          <div style={{ display: 'flex', gap: 'var(--sp-5)', marginTop: 'var(--sp-4)', flexWrap: 'wrap' }}>
            <button type="button" className="bare tappable" onClick={() => setPasting(true)} style={quiet}>
              Paste it instead
            </button>
            {/* Two exports, and the second is the one that matters. A partner
                filling in a pack from a specification is authoring a file; a
                partner handed their own school back with the flags and
                addresses already in it is correcting one. */}
            <button
              type="button"
              className="bare tappable"
              onClick={() => download({ name: 'semester-school-pack-template.json', body: `${JSON.stringify(PACK_TEMPLATE, null, 2)}\n`, mime: 'application/json' })}
              style={quiet}
            >
              Download a blank template
            </button>
            {school.id !== '' && (
              <button
                type="button"
                className="bare tappable"
                onClick={() => download({ name: `${school.id}-pack.json`, body: writePack(school), mime: 'application/json' })}
                style={quiet}
              >
                Save {school.shortName || school.name} as a pack
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
