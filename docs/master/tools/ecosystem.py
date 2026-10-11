#!/usr/bin/env python3
"""Render the ecosystem coverage matrix from the catalogs and the repo audit.

    python3 docs/master/tools/ecosystem.py          # from the repository root
    python3 docs/master/tools/ecosystem.py --check  # exit 1 if the output is stale

Writes docs/master/SEMESTER_ECOSYSTEM_COVERAGE_MATRIX.md. Edit the inputs, not
the output:

- SEMESTER_WORKFLOW_CATALOG.md, SEMESTER_SCREEN_CATALOG.md   (design catalog)
- design-inputs/SEMESTER_OS_MASTER_MAP.md                    (21 layers, modules)
- design-inputs/SEMESTER_TRACEABILITY_MATRIX.md              (step -> layer)
- REPO_AUDIT.md                                              (repo verdict, evidence)
- SEMESTER_GAP_REGISTER.md                                   (owning stream)
- ../roles/ROLE_CATALOG.md                                   (product roles, DB grants)
- STATUS_OVERRIDES below                                     (rows re-judged since the audit)

Every evidence path is re-checked against the working tree on each run. A row
whose evidence has gone missing is demoted and says so, which is what stops
this file going quietly stale the way a hand-kept matrix does.
"""
import os
import re
import subprocess
import sys
from collections import Counter, OrderedDict

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
MASTER = os.path.join(ROOT, "docs", "master")
OUT = os.path.join(MASTER, "SEMESTER_ECOSYSTEM_COVERAGE_MATRIX.md")

# Rows judged again after REPO_AUDIT.md (base 2d8dda1, 5 October 2026). Key is
# the audit key; value is (status, evidence paths, note). Status uses the
# brief's vocabulary. Add a row here only with the paths that prove it.
STATUS_OVERRIDES = {
    "B-004": (
        "implemented",
        ["app/src/screens/Calendar.tsx", "app/src/lib/agenda.ts", "app/src/lib/agenda.test.ts",
         "app/src/screens/Calendar.agenda.test.tsx"],
        "Day, week, month, semester and agenda views (agenda added 10 October 2026, §94)",
    ),
    "Advising & student success#5": (
        "implemented",
        ["supabase/migrations/20261011170000_advisor_check_ins.sql", "supabase/advisor-checkins.check.sql",
         "app/src/lib/advisor-checkins.ts", "app/src/components/AdvisorCheckIns.tsx",
         "app/src/components/AdvisorCheckIns.test.tsx"],
        "An advisor records a check-in on a live share the student made; retry-safe by draft key (D-1448)",
    ),
    "Advising & student success#6": (
        "in progress",
        ["app/src/components/AdvisorCheckIns.tsx", "app/src/components/AdvisorMeeting.tsx"],
        "Next steps on a check-in become the student's own actions; no standalone success plan yet (D-1448)",
    ),
}

VERDICT = {"exists": "implemented", "partial": "in progress", "missing": "specified"}
ORDER = ["proposed", "specified", "in progress", "blocked", "implemented", "verified", "deployed"]


def read(rel):
    with open(os.path.join(ROOT, rel), encoding="utf-8") as f:
        return f.read()


def tables(text):
    """Yield (heading, header cells, rows) for every pipe table, under its nearest heading."""
    heading = ""
    lines = text.splitlines()
    i = 0
    while i < len(lines):
        line = lines[i]
        if line.startswith("#"):
            heading = line.lstrip("#").strip()
        if line.startswith("|") and i + 1 < len(lines) and re.match(r"^\|\s*:?-{3}", lines[i + 1]):
            header = cells(line)
            rows = []
            i += 2
            while i < len(lines) and lines[i].startswith("|"):
                rows.append(dict(zip(header, cells(lines[i]))))
                i += 1
            yield heading, header, rows
            continue
        i += 1


def cells(line):
    parts = re.split(r"(?<!\\)\|", line.strip())[1:-1]
    return [p.strip() for p in parts]


def paths_in(evidence):
    return re.findall(r"`([^`]+)`", evidence or "")


def esc(s):
    return (s or "").replace("|", "\\|").replace("\n", " ")


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def git_head():
    try:
        return subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, text=True).strip()
    except Exception:  # noqa: BLE001
        return "unknown"


# ── inputs ──────────────────────────────────────────────────────────────────

def load_audit():
    audit = {}
    for _, header, rows in tables(read("docs/master/REPO_AUDIT.md")):
        if header[:3] != ["Key", "Item", "Status"]:
            continue
        for r in rows:
            audit[r["Key"]] = r
    return audit


def load_streams():
    streams = {}
    for _, header, rows in tables(read("docs/master/SEMESTER_GAP_REGISTER.md")):
        if "Stream" in header and "Workflow" in header:
            for r in rows:
                streams[f'{r["Workflow"]}#{r["#"]}'] = r["Stream"]
    return streams


def load_layers():
    """Layer number and name, its screen groups, workflows and modules."""
    text = read("docs/master/design-inputs/SEMESTER_OS_MASTER_MAP.md")
    layers = OrderedDict()
    for m in re.finditer(r"^### (\d+)\. (.+?)\n(.*?)(?=^### |\n## |\Z)", text, re.S | re.M):
        body = m.group(3)
        groups = re.search(r"Screen groups: (.+)", body).group(1)
        mods = re.search(r"Modules \(\d+\): (.+)", body).group(1)
        layers[int(m.group(1))] = {
            "name": m.group(2).strip(),
            "groups": [] if groups.startswith("none") else [g.strip()[0] for g in groups.split(";")],
            "modules": [x.strip() for x in mods.split(",")],
            "workflows": re.search(r"Workflows: (.+)", body).group(1).strip(),
        }
    return layers


def load_step_layers():
    out = {}
    for _, header, rows in tables(read("docs/master/design-inputs/SEMESTER_TRACEABILITY_MATRIX.md")):
        if header[:3] != ["Layer", "Workflow", "Step"]:
            continue
        for r in rows:
            n = r["Step"].split(".", 1)[0]
            out.setdefault(f'{r["Workflow"]}#{n}', r["Layer"])
    return out


def load_steps():
    steps = []
    for heading, header, rows in tables(read("docs/master/SEMESTER_WORKFLOW_CATALOG.md")):
        if "Step" not in header or "Actor" not in header:
            continue
        for r in rows:
            r["Workflow"] = heading
            steps.append(r)
    return steps


def load_screens():
    screens = []
    for heading, header, rows in tables(read("docs/master/SEMESTER_SCREEN_CATALOG.md")):
        if header[:1] != ["Screen"]:
            continue
        for r in rows:
            r["Group"] = heading
            screens.append(r)
    return screens


def load_roles():
    """The 69 database roles, with their ladder, from ROLE-LAUNCH-REGISTER.md."""
    roles = []
    for heading, header, rows in tables(read("docs/ROLE-LAUNCH-REGISTER.md")):
        if header[:2] != ["Role", "State"]:
            continue
        for r in rows:
            r["Family"] = heading
            roles.append(r)
    return roles


# ── judging ─────────────────────────────────────────────────────────────────

def judge(key, audit):
    """(status, evidence list, missing evidence list, note) for one audit key."""
    if key in STATUS_OVERRIDES:
        status, ev, note = STATUS_OVERRIDES[key]
        base = "re-judged after the audit"
    elif key in audit:
        a = audit[key]
        status = VERDICT.get(a["Status"], "specified")
        ev, note, base = paths_in(a["Evidence"]), a.get("Note", ""), "REPO_AUDIT"
    else:
        return "proposed", [], [], "No repo audit row; catalogued only", "none"
    gone = [p for p in ev if not os.path.exists(os.path.join(ROOT, p))]
    if gone and status in ("implemented", "in progress"):
        status = "in progress" if len(gone) < len(ev) else "specified"
        note = f"{note} — evidence missing from the tree now: {', '.join(gone)}"
    return status, ev, gone, note, base


def tests_for(ev):
    found = []
    for p in ev:
        stem, ext = os.path.splitext(p)
        for cand in (f"{stem}.test{ext}", f"{stem}.test.ts", f"{stem}.test.tsx"):
            if os.path.exists(os.path.join(ROOT, cand)) and cand not in found:
                found.append(cand)
    return found


def evidence_cell(ev, gone):
    keep = [p for p in ev if p not in gone]
    t = tests_for(keep)
    parts = [f"`{p}`" for p in keep[:3]]
    if len(keep) > 3:
        parts.append(f"+{len(keep) - 3}")
    if t:
        parts.append("tests: " + ", ".join(f"`{x}`" for x in t[:2]))
    return "<br>".join(parts) or "—"


def header_rungs(r):
    return next(k for k in r if k.startswith("Def"))


# ── render ──────────────────────────────────────────────────────────────────

COLS = ["Identifier", "System", "Workspace", "Module", "User role", "Screen or workflow",
        "Required behavior", "Data dependencies", "Permissions", "Integration dependencies",
        "Acceptance criteria", "Implementation status", "Verification evidence",
        "Deployment status", "Blockers"]

DEPLOY = "not verified"


def head(cols):
    return ["| " + " | ".join(cols) + " |", "|" + "|".join([" --- "] * len(cols)) + "|"]


def row(vals):
    return "| " + " | ".join(esc(v) if not v.startswith("`") and "<br>" not in v else v for v in vals) + " |"


def render():
    audit, streams = load_audit(), load_streams()
    layers, step_layer = load_layers(), load_step_layers()
    steps, screens, roles = load_steps(), load_screens(), load_roles()
    group_layer = {}
    for n, L in layers.items():
        for g in L["groups"]:
            group_layer.setdefault(g, f"{n}. {L['name']}")

    out, tally = [], {"Workflow steps": Counter(), "Screens": Counter(), "Modules": Counter(), "Roles": Counter()}

    # Workflow steps
    step_lines = []
    for s in steps:
        key = f'{s["Workflow"]}#{s["#"]}'
        status, ev, gone, note, _ = judge(key, audit)
        tally["Workflow steps"][status] += 1
        actor = s["Actor"] + (f' → {s["Hands to"]}' if s["Hands to"] not in ("—", "") else "")
        integ = s["Source authority"] if s["Source authority"] not in ("Semester", "—") else "—"
        if s["Kind"] == "sync" and integ == "—":
            integ = "sync job"
        accept = (f'{s["Actor"]} can {s["Step"].lower()}'
                  f'{" on " + s["Screen"] if s["Screen"] != "GAP" else ""}; '
                  f'`{s["Audit event"]}` recorded; consent: {s["Consent"].lower()}')
        blockers = "" if status == "implemented" else (note or "")
        if key in streams:
            blockers = f"stream {streams[key]}: {blockers}"
        step_lines.append(row([
            f'WF-{slug(s["Workflow"])}-{int(s["#"]):02d}', s["System"],
            step_layer.get(key, "—"), s["Workflow"], actor,
            s["Screen"] if s["Screen"] != "GAP" else "no screen catalogued",
            f'{s["Step"]} ({s["Kind"]})', f'{s["Classification"]}; source: {s["Source authority"]}',
            f'`{s["Capability"]}`', integ, accept, status, evidence_cell(ev, gone), DEPLOY,
            blockers or "—",
        ]))

    # Screens
    screen_lines = []
    letter_seq = Counter()
    for sc in screens:
        letter = sc["Group"][0]
        letter_seq[letter] += 1
        key = f"{letter}-{letter_seq[letter]:03d}"
        status, ev, gone, note, _ = judge(key, audit)
        if key in audit and audit[key]["Item"] != sc["Screen"]:
            status, ev, gone, note = "proposed", [], [], f"Audit key {key} names another screen; re-audit"
        tally["Screens"][status] += 1
        screen_lines.append(row([
            f"SC-{key}", "—", group_layer.get(letter, "—"), sc["Group"], "per screen group",
            sc["Screen"], f'Screen "{sc["Screen"]}" reachable with every applicable state',
            "—", "—", "—",
            "Reachable from navigation; loading, empty, error, restricted states; keyboard and 320px",
            status, evidence_cell(ev, gone), DEPLOY,
            "—" if status == "implemented" else (note or "—"),
        ]))

    # Modules: matched to a screen of the same name in the layer's groups
    by_name = {}
    for sc, line in zip(screens, screen_lines):
        by_name.setdefault((sc["Group"][0], sc["Screen"].lower()), line.split(" | ")[11])
    module_lines = []
    for n, L in layers.items():
        for mod in L["modules"]:
            st = next((by_name[(g, mod.lower())] for g in L["groups"] if (g, mod.lower()) in by_name), None)
            status = st or "proposed"
            tally["Modules"][status] += 1
            module_lines.append(row([
                f"MOD-{n:02d}-{slug(mod)}", "—", f"{n}. {L['name']}", mod, "—",
                "screen of the same name" if st else "no screen of this name catalogued",
                f"{mod} module of layer {n}", "—", "—", "—", "Per its screens and workflow steps",
                status, "see screen row" if st else "—", DEPLOY,
                "—" if st else "Not mapped to a catalogued screen; needs a screen or an explicit merge",
            ]))

    # Roles: ladder rungs are Def · Mod · Prov · Use · Sec · Sup · Appr
    role_lines = []
    for r in roles:
        rungs = re.findall(r"[✓·]", r[header_rungs(r)])
        use, prov = rungs[3:4] == ["✓"], rungs[2:3] == ["✓"]
        status = "implemented" if use else ("in progress" if prov else "specified")
        tally["Roles"][status] += 1
        caps = paths_in(r["Capabilities"])
        checks = paths_in(r["Authorization checks"])
        ev = [p for p in paths_in(r["Interface"]) if os.path.exists(os.path.join(ROOT, p))]
        evidence = "<br>".join([f"`{p}`" for p in ev[:2]] + ([f"{len(checks)} authorization checks listed (not re-run here)"] if checks else [])) or "—"
        role_lines.append(row([
            f'ROLE-{slug(r["Role"].strip("`"))}', "Authorization", "2. Identity, tenant, policy and trust foundation",
            r["Family"], r["Role"].strip("`"), ", ".join(f"`{p}`" for p in ev[:2]) or "no role-specific screen",
            "May: " + r["Must be able to"] + " · Must never: " + r["Must never"],
            "—", "Capabilities: " + (", ".join(caps) if caps else "none granted (default deny)"),
            "—", "Positive and negative authorization tests pass; role-specific screen reachable; runbook and training exist",
            status, evidence, DEPLOY,
            "—" if status == "implemented" else f'ladder stops at {r["State"]}',
        ]))

    # ── document ──
    out += [
        "<!-- Rendered by docs/master/tools/ecosystem.py. Edit the inputs it names, then run it from the repository root. -->",
        "# Ecosystem coverage matrix",
        "",
        f"**Rendered at** `{git_head()}` · **Repo verdicts from** [`REPO_AUDIT.md`](REPO_AUDIT.md) (base `2d8dda1`, 5 October 2026), "
        "re-checked on every render · **Inventory** [`SEMESTER_ECOSYSTEM_INVENTORY.md`](SEMESTER_ECOSYSTEM_INVENTORY.md)",
        "",
        "> **Claim ceiling.** `implemented` means a reachable implementation was found and its evidence still exists in the tree. "
        "It is not `verified` (an acceptance check was run and recorded) and not `deployed` (seen working on a deployed "
        "environment). No row is `verified` or `deployed` yet, because no row has that evidence recorded; a row moves only "
        "when its evidence does. `proposed` means catalogued with no repo audit behind it; `specified` means audited and "
        "nothing built.",
        "",
        "## Totals",
        "",
        *head(["Inventory"] + ORDER + ["Total"]),
    ]
    for name, c in tally.items():
        out.append("| " + " | ".join([name] + [str(c.get(k, 0)) for k in ORDER] + [str(sum(c.values()))]) + " |")
    out += ["", "Deployment status is `not verified` on every row: preview deployments of the branch exist, but no row's "
            "behaviour has been checked on one.", ""]
    for title, lines in (("Workflow steps", step_lines), ("Screens", screen_lines),
                         ("Modules (OS map)", module_lines), ("Roles (database roles, with allowed and prohibited actions)", role_lines)):
        out += [f"## {title}", "", *head(COLS), *lines, ""]
    return "\n".join(out)


def main():
    text = render()
    if "--check" in sys.argv:
        with open(OUT, encoding="utf-8") as f:
            old = f.read()
        strip = lambda s: re.sub(r"\*\*Rendered at\*\* `[^`]+`", "", s)  # noqa: E731
        if strip(old) != strip(text):
            print("SEMESTER_ECOSYSTEM_COVERAGE_MATRIX.md is stale; run python3 docs/master/tools/ecosystem.py")
            sys.exit(1)
        print("coverage matrix up to date")
        return
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"wrote {os.path.relpath(OUT, ROOT)}")


if __name__ == "__main__":
    main()
