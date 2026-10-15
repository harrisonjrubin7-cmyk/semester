# Target architecture

The target is the nine-layer Education Operating System in `docs/specifications/semester-mainframe.pdf`. This page records that target and the boundaries the repository must keep while it is built. It does not raise any readiness score.

Existing program pages remain the detailed design: `docs/operations/SHARED_CONTROL_PLANE.md`, `INSTITUTION_OPERATING_SYSTEM.md`, `OPERATIONS_COMMAND_CENTER.md`, and `SEMESTER_COMPANY_OPERATING_SYSTEM.md`. This page does not replace them.

## Whole system context

```mermaid
flowchart TB
  public[Public site and marketing]
  apps[Education applications]
  company[Company operations]
  entry[A. Entry identity onboarding]
  roles[B. Role-aware experience]
  domains[C. Native domain engines]
  core[D. Shared platform core]
  data[E. Data foundation]
  ai[F. Governed AI]
  planes[G. Control planes]
  boundary[H. Integration and migration]
  trust[I. Infrastructure and trust]
  public --> entry
  apps --> entry
  company --> entry
  entry --> roles --> domains --> core
  core --> data
  core --> ai
  core --> planes
  data --> boundary
  ai --> boundary
  planes --> boundary
  boundary --> trust
```

## Runtime and container boundaries

One platform, several deployables. Identity, policy, and record authority are not copied per client.

```mermaid
flowchart TB
  web[Web client app Vite React]
  site[Company site]
  gateway[Institution gateway Node]
  db[(Postgres and RLS)]
  files[File storage policies]
  workers[Edge functions and scheduled jobs]
  vendors[Identity providers payment rails email AI providers]
  web --> gateway
  site --> web
  gateway --> db
  gateway --> files
  workers --> db
  gateway --> vendors
  workers --> vendors
```

The client’s chosen screen is not an authorization decision. The gateway and RLS evaluate the action.

## Data authority and domain relationships

```mermaid
flowchart LR
  person[Person and account]
  member[Membership and role context]
  inst[Institution term catalog]
  plan[Device plan and cart]
  enroll[Official enrollment]
  learn[Learning evidence]
  money[Student account]
  bill[Semester commercial billing]
  person --> member --> inst
  member --> plan
  inst --> enroll
  enroll --> learn
  member --> money
  person --> bill
  plan -.->|not authority| enroll
  bill -.->|not the same ledger| money
```

A shared graph is not permission to read every node. Commercial billing, student accounts, payment settlement, and statutory reporting stay separate. Raw card data is not stored.

## Registration-readiness sequence

```mermaid
sequenceDiagram
  actor Student
  participant Web as Web app
  participant Device as Device library
  participant Term as Term plan
  participant School as School SIS
  Student->>Web: Name term and course codes
  Web->>Device: addCourse source Added by hand
  Web->>Term: Open Term plan
  Term-->>Student: Codes listed as not an enrollment
  Student->>Term: Import catalog or paste official schedule
  Term-->>Student: Planning workspace seat counts are from the file
  Note over Web,School: Official enroll drop withdraw stay in the school system until the registration gate is on and the command is confirmed
```

## Role and tenant context

```mermaid
flowchart TB
  auth[Authenticated identity]
  membership[Active membership]
  tenant[Tenant]
  role[Role in that tenant]
  cap[Capability and scope]
  consent[Consent and entitlement]
  state[Workflow state]
  auth --> membership --> tenant --> role --> cap --> consent --> state
  state --> allow[Allow or refuse the command]
```

A person who is a student at one institution and a teaching assistant in one course switches workspace on purpose. Privileges are not merged. A missing role gets the narrower screen set (`forRole` in `app/src/lib/role.ts`).

## Company and customer lifecycle

```mermaid
flowchart LR
  demand[Demand] --> offer[Scoped offer]
  offer --> contract[Contract modules]
  contract --> tenant[Tenant provision]
  tenant --> identity[Identity and migration access]
  identity --> activate[Onboarding]
  activate --> deliver[Product engines]
  deliver --> support[Support and evidence]
  support --> outcome[Renew expand or offboard]
```

Founder and employee views are governed oversight. They are not an automatic route into student, HR, financial, or security records. `OPERATIONS_ONLY` and `STUDENT_RECORD` in `app/src/lib/rolelaunch.ts` are the repository’s expression of that rule.

## Failure and recovery

```mermaid
flowchart TB
  request[Request]
  deny[Refuse with a way back]
  preview[Impact preview]
  command[Idempotent command]
  commit[Record audit and outbox together]
  partial[External step failed]
  compensate[Compensate reconcile or stop]
  retry[Retry with the same key]
  request --> deny
  request --> preview --> command --> commit
  command --> partial --> compensate
  partial --> retry --> command
```

Technical rollback, a compensating transaction, an authorized correction, external reconciliation, and an irreversible action are different. Enrollment in an external SIS is not reversed by deleting a device course.

## Rules that bind every later phase

- Reuse the canonical account, membership, capability, consent, and audit models.
- Do not add a permission system per console.
- Do not present a mock console as a working system.
- Do not transfer system-of-record authority without the proof named in `INTEGRATION_AND_MIGRATION.md`.
- AI calls the same commands a person may call, and may not enroll, grade, or move money on its own.
