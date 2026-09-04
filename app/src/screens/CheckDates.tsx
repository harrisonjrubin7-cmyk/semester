import { useMemo, useState } from 'react';
import { useStore } from '../state/store';
import { Blueprint } from '../components/Blueprint';
import { SectionLabel, Segmented } from '../components/ui';
import { PrintButton } from '../components/PrintButton';
import { datedItems } from '../lib/select';
import { parseIcs } from '../lib/ics';
import { asItemDate, compare, movedLine, summary, type Moved } from '../lib/reconcile';
import { patchItem } from '../lib/edit';
import type { FeedEvent } from '../lib/types';

/**
 * The app's dates, checked against the ones the LMS is showing today.
 *
 * Every deadline here came out of a syllabus read once, before term started.
 * Syllabi move, and until now the app went on stating the old date with
 * complete confidence — the worst way to be wrong, because nothing on the
 * screen suggests checking.
 *
 * The comparison is in `lib/reconcile.ts` and it is deliberately cautious:
 * where a pairing is not clearly right it reports two separate findings rather
 * than one confident wrong match, because "these might be the same thing" is
 * checkable in five seconds and a wrong pairing sends somebody to change a
 * date that was already correct.
 *
 * Nothing is applied automatically. Both dates are shown in full, the course
 * and the feed's own wording are shown beside them, and changing a date is one
 * deliberate tap per deadline.
 */
export function CheckDates() {
  const { state, dispatch, now, catalog } = useStore();

  const [source, setSource] = useState<'feed' | 'paste'>(
    state.feedEvents.length > 0 ? 'feed' : 'paste',
  );
  const [pasted, setPasted] = useState('');
  const [applied, setApplied] = useState<Record<string, string>>({});
  const [error, setError] = useState('');

  const items = useMemo(() => datedItems(catalog, now), [catalog, now]);

  const events: FeedEvent[] = useMemo(() => {
    if (source === 'feed') return state.feedEvents;
    if (!pasted.trim()) return [];
    try {
      return parseIcs(catalog.courses, pasted, 'pasted').events;
    } catch {
      return [];
    }
  }, [source, pasted, state.feedEvents, catalog.courses]);

  const report = useMemo(() => compare(items, events), [items, events]);

  const code = (id: string) => catalog.byId[id]?.code ?? id;

  /**
   * A date moved, in the course that owns it.
   *
   * Only a course you own can be changed — the four sample courses are
   * compiled in — so the button says so rather than failing quietly.
   */
  const owned = (courseId: string) => state.courses.find((c) => c.course.id === courseId);

  const apply = (m: Moved) => {
    const module = owned(m.item.c);
    if (!module) {
      setError(
        `${code(m.item.c)} is a sample course, so its dates are fixed. Import your own copy of it to change one.`,
      );
      return;
    }
    const date = asItemDate(m.now);
    if (!date) {
      setError(`"${m.now}" is not a date this app can store.`);
      return;
    }
    setError('');
    dispatch({ type: 'replaceCourse', module: patchItem(module, m.item.id, date) });
    setApplied((all) => ({ ...all, [m.item.id]: m.now }));
  };

  const nothing = events.length === 0;

  return (
    <div style={{ padding: 18 }}>
      <div style={{ fontSize: 'calc(12.5px * var(--text-scale, 1))', opacity: 0.65, lineHeight: 1.5, textWrap: 'pretty' }}>
        Every deadline here was read off a syllabus once, before term started. This checks them
        against what your LMS calendar says today, and shows both dates before changing anything.
      </div>

      <Segmented
        options={[
          { id: 'feed', label: 'A connected feed' },
          { id: 'paste', label: 'Paste a calendar' },
        ]}
        value={source}
        onChange={setSource}
        style={{ marginTop: 14 }}
      />

      {source === 'feed' ? (
        <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.55, marginTop: 10, lineHeight: 1.5 }}>
          {state.feedEvents.length > 0 ? (
            <>
              {state.feedEvents.length} entries from the calendars you have connected. Add or
              refresh one under Connect accounts.
            </>
          ) : (
            <>
              No calendar is connected yet. Connect Brightspace under Connect accounts, or paste
              its .ics here instead.
            </>
          )}
        </div>
      ) : (
        <>
          <SectionLabel>The calendar file</SectionLabel>
          <textarea
            className="input"
            value={pasted}
            onChange={(e) => setPasted(e.target.value)}
            placeholder="Paste the contents of an .ics file — Brightspace, Canvas, Google Calendar, anything."
            style={{
              width: '100%',
              minHeight: 130,
              resize: 'vertical',
              lineHeight: 1.4,
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: 'calc(12px * var(--text-scale, 1))',
            }}
          />
          <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
            Read here in your browser and never sent anywhere. {events.length > 0
              ? `${events.length} entries read.`
              : pasted.trim()
                ? 'Nothing readable in that yet.'
                : ''}
          </div>
        </>
      )}

      {error ? (
        <div style={{ fontSize: 'calc(13px * var(--text-scale, 1))', marginTop: 12, color: 'var(--app-warn)', lineHeight: 1.45 }}>
          {error}
        </div>
      ) : null}

      {!nothing && (
        <>
          <Blueprint style={{ padding: '15px 16px', marginTop: 16 }}>
            <div className="kicker">Against {events.length} calendar entries</div>
            <div
              className="chrome-text"
              style={{ fontSize: 'calc(22px * var(--text-scale, 1))', lineHeight: 1.2, marginTop: 6, textWrap: 'pretty' }}
            >
              {summary(report)}
            </div>
            <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55, marginTop: 8, lineHeight: 1.45 }}>
              {report.agreed} matched and agreed · {report.onlyHere.length} here with no match in
              the feed
            </div>
          </Blueprint>

          {report.moved.length > 0 && (
            <>
              <SectionLabel>Dates that disagree</SectionLabel>
              {report.moved.map((m) => {
                const done = applied[m.item.id];
                return (
                  <Blueprint key={m.item.id} style={{ padding: '13px 14px', marginBottom: 9 }}>
                    <div className="kicker">{code(m.item.c)}</div>
                    <div style={{ fontSize: 'calc(15px * var(--text-scale, 1))', lineHeight: 1.3, marginTop: 4, textWrap: 'pretty' }}>
                      {m.item.title}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        gap: 10,
                        alignItems: 'baseline',
                        marginTop: 9,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      <span style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))', opacity: 0.6, textDecoration: 'line-through' }}>
                        {m.was}
                      </span>
                      <span style={{ fontSize: 'calc(13.5px * var(--text-scale, 1))' }}>{m.now}</span>
                      <span style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.55 }}>{movedLine(m)}</span>
                    </div>
                    <div style={{ fontSize: 'calc(11.5px * var(--text-scale, 1))', opacity: 0.5, marginTop: 6, lineHeight: 1.45 }}>
                      The feed calls it “{m.event.title}”.
                    </div>
                    <button
                      type="button"
                      className="btn btn-secondary btn-block"
                      disabled={Boolean(done)}
                      onClick={() => apply(m)}
                      style={{ height: 40, marginTop: 10 }}
                    >
                      {done ? `Moved to ${done}` : 'Use the calendar’s date'}
                    </button>
                  </Blueprint>
                );
              })}
            </>
          )}

          {report.onlyThere.length > 0 && (
            <>
              <SectionLabel>In the feed, not in the app</SectionLabel>
              <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginBottom: 8, lineHeight: 1.5 }}>
                Either something added after the syllabus was written, or something the matcher
                could not line up. Add anything real under Edit the course.
              </div>
              {report.onlyThere.map((e) => (
                <div
                  key={e.id}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'baseline',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--app-line)',
                  }}
                >
                  <span
                    style={{
                      flex: 'none',
                      width: 82,
                      fontSize: 'calc(11.5px * var(--text-scale, 1))',
                      opacity: 0.55,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {e.date}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.35 }}>
                    {e.title}
                    {e.courseId ? (
                      <span style={{ opacity: 0.5 }}> · {code(e.courseId)}</span>
                    ) : null}
                  </span>
                </div>
              ))}
            </>
          )}

          {report.onlyHere.length > 0 && (
            <>
              <SectionLabel>Here, with nothing in the feed</SectionLabel>
              <div style={{ fontSize: 'calc(12px * var(--text-scale, 1))', opacity: 0.6, marginBottom: 8, lineHeight: 1.5 }}>
                Usually fine — plenty of syllabus work never appears on an LMS calendar. Worth a
                look only if something you expected to see is on this list.
              </div>
              {report.onlyHere.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  className="bare tappable"
                  onClick={() => dispatch({ type: 'openItem', id: i.id })}
                  style={{
                    display: 'flex',
                    gap: 12,
                    alignItems: 'baseline',
                    width: '100%',
                    padding: '10px 0',
                    borderBottom: '1px solid var(--app-line)',
                    textAlign: 'left',
                  }}
                >
                  <span
                    style={{
                      flex: 'none',
                      width: 82,
                      fontSize: 'calc(11.5px * var(--text-scale, 1))',
                      opacity: 0.55,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {i.dueShort}
                  </span>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 'calc(13.5px * var(--text-scale, 1))', lineHeight: 1.35 }}>
                    {i.title}
                    <span style={{ opacity: 0.5 }}> · {code(i.c)}</span>
                  </span>
                </button>
              ))}
            </>
          )}

          <PrintButton label="Print this comparison" style={{ marginTop: 14 }} />
          <div style={{ fontSize: 'calc(11px * var(--text-scale, 1))', opacity: 0.45, marginTop: 10, lineHeight: 1.45 }}>
            Titles are matched by how much they have in common, scoped to the course. Where a
            pairing is not clearly right it is reported as two separate lines rather than one
            confident wrong match — a wrong match would send you to change a date that was right.
          </div>
        </>
      )}
      <div style={{ height: 26 }} />
    </div>
  );
}
