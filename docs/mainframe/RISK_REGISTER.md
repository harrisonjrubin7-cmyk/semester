# Risk register

Program risks OR-1 through OR-20 stay in `docs/operations/OPERATIONS_ROADMAP.md` §6. This page adds the risks this batch could create, and restates the ones that block the next registration work.

| ID | Risk | Status |
| --- | --- | --- |
| MR-1 | A typed course code is read as an enrollment. | Mitigated in copy and tests. The term plan says “not an enrollment”. Official registration stays gated. Residual: a later change could delete that sentence. |
| MR-2 | The plan door crowds out the syllabus or the keyless by-hand path. | Mitigated. Syllabus stays the lead door. `keyless.test.tsx` passed. |
| MR-3 | Client role journeys are treated as authorization. | Open as a standing rule. `rolejourney.ts` documents that it grants nothing. Server grants remain the authority. |
| MR-4 | Production state is inferred from the repository. | Open. This audit marks hosted config, applied migrations, and audit rows unverified. |
| MR-5 | F-1 direct writes bypass approval, so a later “registration command” could be claimed safe while the bypass exists. | Open. Owned by the operations roadmap OP-01. Not fixed here. Needs a reviewed migration and approval before it is applied. |
| MR-6 | Two role vocabularies (database roles and the ten client roles) get merged into one picker. | Open. OR-15. |
| MR-7 | Company billing and student accounts collapse into one balance. | Not introduced. The rail adapter work on main is shadow. This batch does not call it. |
| MR-8 | AI extracts a code and the result is stored as official. | Not introduced. This path does not call a model. |

No risk here authorizes a production change.
