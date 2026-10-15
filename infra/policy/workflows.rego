# Policy for GitHub Actions workflow files. Input: one workflow, parsed from YAML
# (`opa eval --input .github/workflows/x.yml`).
#
# Each rule is a way a workflow has been used to take over a pipeline: an
# action moved after review, a token that can write everything, a pull-request
# title pasted into a shell. They are rules about the *workflow*, so they hold
# for a workflow written next year by somebody who has not read this file.
package semester.workflows

import rego.v1

# ── Findings, exceptions and the verdict ─────────────────────────────────────
#
# A rule that fails on a file written before the rule existed has two honest
# outcomes: fix the file, or record why not yet. `data.exceptions` is the second.
# Each carries an expiry and the change record that accepted it, and an expired
# one is itself a violation — so "known, and accepted for now" cannot quietly
# become "known, and forgotten".
#
#   {"workflow": "pages.yml", "match": "id-token", "expires": "2026-12-31",
#    "record": "infra/changes/CC-nnnn.md", "reason": "…"}

deny contains msg if {
	some msg in finding
	not excepted(msg)
}

deny contains msg if {
	some e in data.exceptions
	e.workflow == data.workflow_file
	expired(e)
	msg := sprintf("the exception for '%s' (%s) expired on %s; fix the workflow or renew it in a change record", [e.match, e.record, e.expires])
}

excepted(msg) if {
	some e in data.exceptions
	e.workflow == data.workflow_file
	contains(msg, e.match)
	not expired(e)
}

expired(e) if {
	time.parse_rfc3339_ns(sprintf("%sT00:00:00Z", [e.expires])) < now_ns
}

default now_ns := 0

now_ns := data.clock.now_ns

now_ns := time.now_ns() if not data.clock

# ── 1. Third-party actions are pinned to a commit ─────────────────────────────

finding contains msg if {
	some job_id, job in input.jobs
	some step in job.steps
	ref := step.uses
	not startswith(ref, "./")
	not startswith(ref, "docker://")
	not pinned(ref)
	msg := sprintf("%s: step uses '%s', which is not pinned to a 40-character commit SHA (a tag can be moved after review)", [job_id, ref])
}

finding contains msg if {
	some job_id, job in input.jobs
	ref := job.uses
	not startswith(ref, "./")
	not pinned(ref)
	msg := sprintf("%s: reusable workflow '%s' is not pinned to a commit SHA", [job_id, ref])
}

pinned(ref) if regex.match(`@[0-9a-f]{40}$`, ref)

# ── 2. The token starts small ─────────────────────────────────────────────────

finding contains msg if {
	not input.permissions
	msg := "no top-level `permissions:`; the token falls back to the repository default instead of an explicit, reviewed scope"
}

finding contains msg if {
	input.permissions == "write-all"
	msg := "top-level `permissions: write-all` hands every job every scope"
}

finding contains msg if {
	some job_id, job in input.jobs
	job.permissions == "write-all"
	msg := sprintf("%s: `permissions: write-all`", [job_id])
}

# `id-token: write` mints a cloud identity. It belongs on the job that deploys
# or attests and nowhere else, so it may not appear at the top level.
finding contains msg if {
	input.permissions["id-token"] == "write"
	msg := "`id-token: write` at the top level gives every job the ability to mint an identity; grant it on the one job that needs it"
}

# ── 3. Untrusted input does not reach a shell or a privileged checkout ───────

finding contains msg if {
	"pull_request_target" in triggers
	msg := "`pull_request_target` runs with secrets against a fork's code; use `pull_request`"
}

untrusted := {
	"github.event.pull_request.title",
	"github.event.pull_request.body",
	"github.event.pull_request.head.ref",
	"github.event.pull_request.head.label",
	"github.event.issue.title",
	"github.event.issue.body",
	"github.event.comment.body",
	"github.event.review.body",
	"github.event.head_commit.message",
	"github.head_ref",
}

finding contains msg if {
	some job_id, job in input.jobs
	some step in job.steps
	script := step.run
	some expr in untrusted
	contains(script, sprintf("${{ %s", [expr]))
	msg := sprintf("%s: `%s` is interpolated straight into a shell script; pass it through `env:` and quote it", [job_id, expr])
}

finding contains msg if {
	some job_id, job in input.jobs
	some step in job.steps
	script := step.run
	contains(script, "${{ inputs.")
	msg := sprintf("%s: a workflow input is interpolated straight into a shell script; pass it through `env:` and quote it", [job_id])
}

finding contains msg if {
	some job_id, job in input.jobs
	job.secrets == "inherit"
	msg := sprintf("%s: `secrets: inherit` passes every secret to the called workflow; name the ones it needs", [job_id])
}

# ── 4. Deploys go through an environment a human can gate ────────────────────

# A workflow whose file name says it deploys must put the job that does so in an
# environment. Without one, the environment's reviewers, branch policy and
# scoped secrets do not apply, and "production" is only a word in a log.
deploy_workflows := {"pages.yml", "functions.yml", "infra-apply.yml"}

finding contains msg if {
	data.workflow_file in deploy_workflows
	not any_job_has_environment
	msg := sprintf("%s deploys but no job declares `environment:`", [data.workflow_file])
}

any_job_has_environment if {
	some _, job in input.jobs
	job.environment
}

# YAML 1.1 reads the key `on` as the boolean true, and OPA's parser hands it
# over as the string "true". Accept either spelling so the policy is not
# silently blind to every trigger.
trigger_value := object.get(input, "on", object.get(input, "true", {}))

triggers contains t if {
	is_object(trigger_value)
	some t, _ in trigger_value
}

triggers contains t if {
	is_array(trigger_value)
	some t in trigger_value
}

triggers contains trigger_value if is_string(trigger_value)
