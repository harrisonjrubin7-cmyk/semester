import { SectionLabel } from '../ui';
import { Sub } from '../academic/Form';
import { formatDateTime } from '../../lib/locale';
import type { AuditRecord } from '../../lib/degreeaudit/model';
import {
  NOT_COUNTED_TEXT,
  VERDICT_LABEL,
  VERDICT_TEXT,
  acceptsLine,
  countedNowhere,
  courseLine,
  doubleCounted,
  fingerprint,
  notCounted,
  requirementLine,
  unmetLine,
} from '../../lib/degreeaudit/views';

/**
 * One kept degree audit, read out: the verdict, each requirement with what is
 * finished and what is in progress apart, the courses each one counted, and
 * what the audit read and could not use.
 *
 * Nothing here is computed. The database worked out every figure and kept the
 * answer (`degree_audits.result`); this prints it, with the date it was as of,
 * who asked, which version of the school's program it ran against, and a
 * fingerprint of the ledger lines it read so two audits can be told apart.
 *
 * It is the school's audit of the school's record, not a transcript and not a
 * degree conferral: the audit does not read the conferral, and "requirements
 * met" is not "degree awarded". It says so under the verdict.
 */

const stamp = (iso: string): string => formatDateTime(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
const day = (iso: string): string => formatDateTime(new Date(`${iso}T12:00:00`), { dateStyle: 'medium' });

export function AuditView({ audit }: { audit: AuditRecord }) {
  const r = audit.result;
  return (
    <article aria-label={`Degree audit of ${audit.studentRef} against ${audit.programTitle}`} style={{ display: 'grid', gap: 'var(--sp-5)' }}>
      <header>
        <h3 style={{ margin: 0 }}>{audit.programTitle}</h3>
        <Sub>
          Catalog year {audit.catalogYear}, version {audit.programVersion} of {audit.programCode}. As of {day(audit.asOf)}. Run {stamp(audit.requestedAt)}.
        </Sub>
        <Sub>
          Based on {audit.inputsCount} {audit.inputsCount === 1 ? 'line' : 'lines'} of the academic record. Fingerprint {fingerprint(audit.inputsSha256)}.
        </Sub>
      </header>

      {r === null ? (
        <p role="status">
          This audit was kept in a form this version of Semester cannot read, so no verdict is shown here rather than one of its own. The school’s kept copy is unchanged.
        </p>
      ) : (
        <>
          <section aria-label="Verdict">
            <p style={{ margin: 0 }}>
              <strong>{VERDICT_LABEL[r.verdict]}.</strong> {VERDICT_TEXT[r.verdict]}
            </p>
            <Sub>
              This is your school’s audit of what its record shows on that date. It is not a transcript, and it does not read whether a degree has been conferred.
            </Sub>
          </section>

          <section aria-label="Requirements">
            <SectionLabel>Requirements</SectionLabel>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {r.requirements.map((q) => (
                <li key={q.sort} style={{ paddingBlock: 'var(--sp-4)', borderBottom: '1px solid var(--app-line-soft)', display: 'grid', gap: 'var(--sp-2)' }}>
                  <strong>{q.name}</strong>
                  <span>{requirementLine(q)}</span>
                  <Sub>Counts: {acceptsLine(q)}.</Sub>
                  {q.done.length > 0 && (
                    <div>
                      <Sub>Finished and counted</Sub>
                      <ul style={{ margin: 0, paddingLeft: 'var(--sp-5)' }}>
                        {q.done.map((i) => (
                          <li key={`${i.source}:${i.key}`}>{courseLine(i)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {q.doing.length > 0 && (
                    <div>
                      <Sub>In progress, not yet done</Sub>
                      <ul style={{ margin: 0, paddingLeft: 'var(--sp-5)' }}>
                        {q.doing.map((i) => (
                          <li key={`${i.source}:${i.key}`}>{courseLine(i)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {q.unmet_grade.length > 0 && (
                    <div>
                      <Sub>Finished, but kept out by the minimum grade</Sub>
                      <ul style={{ margin: 0, paddingLeft: 'var(--sp-5)' }}>
                        {q.unmet_grade.map((i) => (
                          <li key={`${i.source}:${i.key}`}>{unmetLine(i, q.min_grade)}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </section>

          {doubleCounted(r.courses).length > 0 && (
            <section aria-label="Courses counted more than once">
              <SectionLabel>Counted in more than one requirement</SectionLabel>
              <Sub>
                A course counts in every requirement that names it. Whether your school allows that is its rule; each requirement above says which courses it counted, so a rule against it is visible.
              </Sub>
              <ul style={{ margin: 0, paddingLeft: 'var(--sp-5)' }}>
                {doubleCounted(r.courses).map((c) => (
                  <li key={`${c.source}:${c.key}`}>
                    {c.key}: {c.counted_in.join(', ')}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {countedNowhere(r.courses).length > 0 && (
            <section aria-label="Courses that counted nowhere">
              <SectionLabel>Counted towards no requirement</SectionLabel>
              <Sub>Either a free elective, or a requirement the program does not list.</Sub>
              <ul style={{ margin: 0, paddingLeft: 'var(--sp-5)' }}>
                {countedNowhere(r.courses).map((c) => (
                  <li key={`${c.source}:${c.key}`}>{courseLine(c)}</li>
                ))}
              </ul>
            </section>
          )}

          {notCounted(r.courses).length > 0 && (
            <section aria-label="Lines not counted">
              <SectionLabel>On the record, not counted</SectionLabel>
              <ul style={{ margin: 0, paddingLeft: 'var(--sp-5)' }}>
                {notCounted(r.courses).map((c) => (
                  <li key={`${c.source}:${c.key}`}>
                    {c.key}: {c.reason ? NOT_COUNTED_TEXT[c.reason] : 'Not counted.'}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </article>
  );
}
