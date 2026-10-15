# Control planes

Three consoles, three boundaries. The mainframe PDF’s table is the requirement. The repository’s consoles are what exists.

| Plane | Who | Repository home | Access boundary |
| --- | --- | --- | --- |
| Institution | Registrar, advisors, finance, campus, IT | University screen tabs. Official registration desk inside `Registration.tsx` when the capability is held. | Institution and resource scope. Not built as `/app/institution/:slug/*`; hash routes are the frozen navigation. |
| Semester company | Sales, implementation, support, finance, product, engineering | `#/console`, eleven tabs, as recorded in `docs/operations/OPERATIONS_ROADMAP.md` §0. | Employee capabilities plus an explicit customer grant. Employment is not that grant. |
| Developer and partner | Partners, certification | Roadmap and marketplace notes. | Sandbox and approved scopes. Not a new console in this batch. |

Institution operations and the Semester command center are different products of the same platform. A founder view is oversight. It is not a query of every student record.

This batch adds no console tab. OP-14 in the operations roadmap (registrar registration-readiness console) is still the institution-side gap. The student-side checklist already exists and must not be copied into a second empty operator screen.

Release flags, incidents, and evidence stay on the company console’s existing tabs until their write paths go through approval. The roadmap marks several of those writes as bypassing approval (F-1). That is an open security gap, not a feature of this plan.
