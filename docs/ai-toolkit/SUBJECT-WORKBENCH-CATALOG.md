# Subject workbench catalog

**Flag:** `VITE_TOOLKIT_WORKBENCHES`. **Code:** `app/src/lib/toolkit/catalog.ts`.

## How a subject is chosen

From the course-code prefix the student imported (`PSCI 1104` → Political science),
or picked by the student when the prefix is not known. Never guessed from anything
else. No prefix belongs to two subjects (tested).

## Tool states — what a tool says it is

| State | Label in the UI | Meaning |
| --- | --- | --- |
| `native` | *Opens in Semester* | An existing screen; opening it goes there |
| `guided` | *In the toolkit* | A toolkit workflow built in this slice |
| `restricted` | *Needs review before use* | High-risk; unavailable until human review and flag approval — and, in this slice, unavailable even then, because no implementation has passed review |
| `planned` | *Not built yet* | Named so the department sees it is planned |

A catalog that listed simulators as working would be fabricating the product, so
most of the brief's hundred-odd tools appear as *Not built yet*. That is the
accurate state.

## Subjects (32)

| Family | Subjects (prefixes) |
| --- | --- |
| STEM | Mathematics (MATH) · Statistics (STAT, BIOS) · Biology (BSCI, BIOL, MBIO) · Chemistry (CHEM) · Physics (PHYS, ASTR) · Computer science (CS, CSE, COMP) · Data science (DS, DSCI) · Engineering (ENGR, ME, EECE, CE, BME, CHBE, ES) |
| Humanities & languages | English and writing (ENGL, WRIT) · History (HIST) · Philosophy (PHIL) · Languages (SPAN, FREN, GER, ITA, CHIN, JAPN, ARA, RUSS, PORT, LAT) · Religious studies (RLST, JS) |
| Social sciences & business | Psychology (PSY, PSYC) · Sociology (SOC) · Political science (PSCI, POLS) · Economics (ECON) · Anthropology (ANTH) · Business and management (MGT, BUS, BUSA, OWEN, MKTG) · Finance and accounting (FIN, ACCT) · Education (EDUC, HOD, SPED) · Communication (CMST, COMM) · Public policy (PPS, PUBP, MPP) · Legal studies (LAW, LGST) · Criminal justice (CRJ, CJ) |
| Health & clinical | Nursing (NURS) · Public health (PH, MHS, GH) · Kinesiology and nutrition (KIN, NUTR, EXSC) |
| Arts & media | Art and design (ARTS, HART, ARCH) · Music (MUSC, MUSL, MUTH) · Theatre, film and media (THTR, FILM, CMA) |
| Field & environment | Environmental and earth science (EES, ENVS, GEOL) |

Prefixes lean on Vanderbilt's; a school pack can extend them. Every subject also
inherits the universal tools ([SHARED-LEARNING-FOUNDATION.md](SHARED-LEARNING-FOUNDATION.md)).

## Entitlement

`entitle(tool, approved, workbenchesOn)`:

1. A tool whose id is in `NEVER` → *Not permitted*, whatever the approval list says.
2. `planned` → *Not built yet*.
3. `restricted` → *Needs review before use*, approved or not.
4. `native` / `guided` → available.

Tenant approval lists are an empty set in this slice; there is no admin surface for
them yet. The open admin-console pull request (#736) is the natural home.

## Never permitted

Pathogen design · hazardous wet-lab protocols · clinical decisions · patient records ·
legal advice on a real matter · individualized financial advice · engineering
sign-off · offensive security · publishing exact locations · voice cloning.
