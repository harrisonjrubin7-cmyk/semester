# AI governance program

## Allowed pilot uses

Organizing authorized sources, summarizing with visible limitations, generating study aids, explaining concepts, and suggesting reversible student-controlled next actions. Output is assistance, not authority.

## Prohibited initial uses

Admissions, financial aid, discipline, conduct, disability/accommodation eligibility, clinical/mental-health judgment, immigration, authoritative degree/registration advice, final grading, or any automated institutional adverse action.

## Activation gate

Each AI feature needs: named owner; defined user/job; data/source map; approved provider/model/region/terms; no-training determination; student/institution control; evaluation baseline; prompt-injection and tool threat model; human oversight; limitations copy; rate/token/cost/abuse limits; audit metadata; kill switch; incident and rollback plan.

## Provider and data rules

No secrets, unrelated tenant data, or unnecessary student content in prompts. Retrieval indexes are tenant/resource partitioned. Provider training on customer/student data is prohibited unless a separate explicit agreement and user notice/choice authorizes it. Model output is untrusted and may not directly execute SQL, shell, HTML, file paths or privileged tools.

## Evaluation and monitoring

Test groundedness, citation/source fidelity, harmful or overconfident advice, bias/equity, privacy leakage, prompt injection, tool permission, cost and refusal behavior. Segment by feature and approved population without profiling students. Material provider/model/prompt/tool changes repeat the gate. Safety incidents can disable the feature independently per tenant/cohort.

## User disclosure

State what the feature does, what data it receives, the provider class, known limitations, whether human review occurs, how to disable/opt out, how to report harm, and that critical decisions must be verified with the institution or qualified professional.
