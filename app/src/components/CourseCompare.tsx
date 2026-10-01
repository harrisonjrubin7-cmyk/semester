import { RecordTable, tableText, type TableRecord } from './HumanTable';
import { useId } from 'react';
import {
  EMPTY_SHORTLIST,
  MAX_COMPARE,
  SHORTLIST_KEY,
  liveShortlist,
  meetingLine,
  readShortlist,
  requirementFit,
  requisites,
  scheduleFit,
  toggleCompare,
  toggleSaved,
  type Shortlist,
} from '../lib/course-detail';
import { useDeviceLibrary } from '../lib/device-library';
import { WIDE, useMedia } from '../lib/media';
import type { CatalogCourse } from '../lib/registration';
import { compareOptions } from '../lib/decision-compare';
import { DecisionTable } from './DecisionTable';
import { useNow, useStore } from '../state/store';
import { SourceBadge } from './SourceBadge';

/**
 * Saved courses, and up to three side by side (`course_detail_v2`, Phase F).
 *
 * A real table from the `WIDE` width (840px), with the courses as column headers; on a phone,
 * one card per course with the same rows as a list. Rows are facts from the
 * catalog and readings against the student's own records — no ranking and no
 * "best" pick.
 */
export function CourseCompare({
  catalog,
  cart,
  onOpen,
}: {
  catalog: CatalogCourse[];
  cart: CatalogCourse[];
  onOpen: (id: string) => void;
}) {
  const { state } = useStore();
  const wide = useMedia(WIDE);
  const now = useNow();
  const headingId = useId();
  const library = useDeviceLibrary(SHORTLIST_KEY, readShortlist, EMPTY_SHORTLIST);
  const shortlist = {
    value: liveShortlist(library.value, catalog),
    update: (f: (l: Shortlist) => Shortlist) => library.update((l) => f(liveShortlist(l, catalog))),
  };
  const byId = new Map(catalog.map((c) => [c.id, c]));
  const saved = shortlist.value.saved.map((id) => byId.get(id)).filter((c): c is CatalogCourse => !!c);
  const compared = shortlist.value.compare.map((id) => byId.get(id)).filter((c): c is CatalogCourse => !!c);
  if (!saved.length) return null;

  const rows = (c: CatalogCourse): [string, string][] => {
    const reqs = requisites(c, state.taken, cart).items.filter((i) => i.kind === 'prerequisite');
    const met = reqs.filter((i) => i.state === 'recorded' || i.state === 'in_progress').length;
    const fit = requirementFit(c, state.requirements, state.taken);
    const clashes = scheduleFit(c, cart, state.commitments);
    return [
      ['Credits', String(c.credits)],
      ['Meets', meetingLine(c)],
      [
        'Prerequisites',
        reqs.length
          ? `${met} of ${reqs.length} named courses in your records`
          : c.prerequisites
            ? 'Conditions only — read the course'
            : 'None listed',
      ],
      ['May count toward', fit.length ? fit.map((f) => f.requirement.name).join(', ') : 'Nothing you recorded'],
      ['Overlaps', clashes.length ? `${clashes.length} with your cart or commitments` : 'None found'],
      ['Seats (from the file)', c.seats === null ? 'Not given' : c.seats === 0 ? 'Reported closed' : String(c.seats)],
    ];
  };

  return (
    <section className="portal-panel course-compare" aria-labelledby={headingId}>
      <h3 id={headingId}>Saved courses</h3>
      <ul className="course-compare-saved">
        {saved.map((c) => (
          <li key={c.id}>
            <button type="button" className="workspace-text-button" onClick={() => onOpen(c.id)}>
              {c.code} · {c.section}
            </button>
            <label className="portal-check">
              <input
                type="checkbox"
                checked={shortlist.value.compare.includes(c.id)}
                disabled={!shortlist.value.compare.includes(c.id) && shortlist.value.compare.length >= MAX_COMPARE}
                onChange={() => shortlist.update((l) => toggleCompare(l, c.id))}
              />
              Compare
            </label>
            <button
              type="button"
              aria-label={`Unsave ${c.code} section ${c.section}`}
              onClick={() => shortlist.update((l) => toggleSaved(l, c.id, c.code))}
            >
              Unsave
            </button>
          </li>
        ))}
      </ul>
      {compared.length < 2 ? (
        <p className="portal-muted">Tick two or three to compare them side by side.</p>
      ) : (
        <RecordTable
          defaultView={wide ? 'table' : 'cards'}
          id="course-facts-comparison"
          label={'imported catalog facts and estimated readings against your records. No course is ranked.'}
          tableProps={{ className: 'scenario-table course-compare-table' }}
          caption={
            <>
              <SourceBadge label="imported" /> catalog facts and <SourceBadge label="estimated" /> readings against your records. No course
              is ranked.
            </>
          }
          columns={[
            { id: 'column-0', label: 'Course' },
            ...compared.map((c) => ({ id: String(c.id), label: tableText([c.code, '·', c.section]) })),
          ]}
          rows={[
            ...rows(compared[0]).map(
              ([label], i) =>
                ({
                  id: String(label),
                  cells: [
                    { value: tableText(label), content: <>{label}</>, header: true },
                    ...compared.map((c) => ({ value: tableText(rows(c)[i][1]), content: <>{rows(c)[i][1]}</> })),
                  ],
                }) satisfies TableRecord,
            ),
          ]}
        />
      )}
      {compared.length >= 2 && (
        <details>
          <summary>Full decision comparison</summary>
          <DecisionTable
            comparison={compareOptions(
              'course',
              compared.map((course) => ({
                id: course.id,
                label: `${course.code} · ${course.section}`,
                requirementFit: requirementFit(course, state.requirements, state.taken),
                clashes: scheduleFit(course, cart, state.commitments),
                prerequisites: requisites(course, state.taken, cart),
                source: { label: 'imported', asOf: null },
                uncertainty: ['Seat availability and eligibility must be confirmed by your institution.'],
              })),
              now,
            )}
          />
        </details>
      )}
    </section>
  );
}
