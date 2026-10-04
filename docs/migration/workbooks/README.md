<!-- Rendered from app/src/lib/migration/workbooks.ts by workbooks.test.ts. Edit the data, then run `MIGRATION_DOCS=write npx vitest run src/lib/migration/workbooks.test.ts` from app/. -->

# Migration workbooks

One per kind of data. Each says what to bring, how to prove it arrived *correctly* (not merely that it arrived), and what to watch on the days that matter. The method is in [the migration pack](../README.md).

| Workbook | Approver | Entities | Checks | Done means |
| --- | --- | --- | --- | --- |
| [Identity](identity.md) | `it` | 4 | 8 | Every person who can sign in today can sign in as themselves, to the same things, and nobody else can. |
| [Academic records](academic_records.md) | `registrar` | 6 | 9 | The transcript, standing and degree progress of every student recompute to what the registrar already certifies, and no past grade has changed. |
| [Courses and catalog](courses.md) | `registrar` | 5 | 8 | Every catalog entry and scheduled section students can see or register for is the one the registrar published, with the same rules attached. |
| [Learning content](learning_content.md) | `faculty` | 6 | 8 | A faculty member opens last term's course and finds their materials, structure, assessments and grades as they left them, with the same students seeing the same things. |
| [Enrollments](enrollments.md) | `registrar` | 4 | 8 | Every student is in exactly the sections the registrar says they are, with the same status, holds and registration eligibility. |
| [Finance (student accounts)](finance.md) | `finance` | 6 | 9 | Every student account balance, to the cent, is what the bursar already carries, every charge and payment still has its date and source, and nobody is charged or refunded twice. |
| [Family and guardian relationships](family.md) | `data_owner` | 4 | 8 | Each guardian or authorised contact can see exactly what the student and the institution's policy have consented to, and nothing more, on the first day. |
| [Campus services](campus_services.md) | `data_owner` | 6 | 8 | Housing, dining, events, athletics, advising and support requests continue without a student having to re-apply, re-book or re-explain. |
| [Career](career.md) | `data_owner` | 6 | 8 | A student or alumnus keeps their applications, employer relationships, experience records and verified achievements, and employers see only what was shared with them. |
| [Documents](documents.md) | `data_owner` | 4 | 8 | Every document in scope is present byte-for-byte, attached to the right person or record, readable only by who could read it, with its retention clock intact. |

The same checks as a spreadsheet: [`checks.csv`](checks.csv).
