# Clinical, legal, financial, engineering and cyber boundaries

Each tool in these areas carries its boundary in the catalog (`BOUNDARIES` in
`catalog.ts`), shown under the tool wherever it appears.

| Area | Boundary text | Tools carrying it | Never permitted |
| --- | --- | --- | --- |
| Clinical | Educational simulation only. Not diagnosis, treatment, patient records or clinical decision support, and never a place for patient information. | Medication-math practice, clinical-reasoning cases (restricted), guideline comparison | `clinical-decisions`, `phi` |
| Legal | Educational practice only. Not legal advice about any real matter. | Case brief template | `legal-advice` |
| Finance | Educational models only. Not individualized financial or investment advice. | Time value and ratio models | `financial-advice` |
| Engineering | Educational reasoning only. Not certification, structural approval or a safety sign-off. | Units and assumptions checklist | `engineering-signoff` |
| Cyber | Defensive learning only. No live targets, credentials, malware or bypassing school systems. | Defensive security sandbox (restricted) | `offensive-security` |
| Location | Coarse, private locations only. | Field notes, GIS lab | `exact-location` |

## Data

Patient information is regulated (T4) under the classification gate: blocked from
storage, AI, sharing and export. The Data Studio refuses to import it and refuses to
read stored data that claims it.

## Topic notices

`boundaryNotice()` shows the matching boundary when a student's topic reads like a
real clinical, legal or financial question ("my patient", "should I sue", "which
stock"). Tested to stay quiet on ordinary coursework, including the Greek letter phi.
