# Figma mapping

How Semester's code and any Figma file relate, and where the mapping between
them is recorded. **No Figma file has been connected yet**, so nothing is
mapped: the manifest [`figma-mapping.json`](figma-mapping.json) is an empty
template, and no row below is invented. Rows are added when someone with access
to the real file reads it through the Figma MCP and records what they find.

## Ownership

| Owner | Owns |
|---|---|
| **Code** | Behaviour, accessibility, responsive behaviour, public component APIs and every token *value*. |
| **Figma** | Approved visual intent and design exploration. |
| `app/src/styles/tokens.css` and `app/src/lib/tokenexport.ts` | The code token pipeline. `look.ts` decides every colour. |
| `app/design-tokens/semester.tokens.json` | **Generated output.** Never hand-edited; `npm run tokens:export` rewrites it and `lib/tokenexport.test.ts` fails when it drifts. |

The direction for tokens is code → Figma, as `docs/design/DESIGN-SYSTEM-PRODUCT-SPEC.md` §7.2
sets out. A Figma variable is mapped *to* an exported token; it does not create one.

## Setup, once per developer

The repository carries [`.mcp.json`](../../.mcp.json), which names the remote Figma
server and nothing else: no token, no cookie, no header. Each developer
authenticates with their own Figma account, interactively:

```bash
claude mcp add --scope project --transport http figma https://mcp.figma.com/mcp
```

That command writes the same entry `.mcp.json` already holds, so it is only
needed if the file is absent. Then start Claude Code in the repository and run
`/mcp`, choose `figma` and follow the browser sign-in. Nothing in CI, a script or
a skill authenticates for you, and nothing here claims it has been done.

Reading a file is safe. Writing one is not: Claude does not write to Figma
unless the task says to, and the audit skill is not allowed the write tools.

## How to add a mapping

1. Read the frame, variables or component through the MCP (`/audit-semester-design-sync <path> <figma url>` does this read-only).
2. For a variable, find the token in `semester.tokens.json`: `semantic.<name>` for a role (`surface-base`, `text-primary`, `status-danger`…) or `primitive.<name>` for a value `tokensFor` writes. Add a row to `variables` in the manifest with that path and the CSS variable it exports from (`--<name>`).
3. For a component, find the React component or stylesheet that already implements it and add a row to `components` with its repository path. Map each Figma variant to a documented prop or class, not to a new one.
4. If there is no code token or pattern, add the row with `status: "unresolved"` and a note. That is the record of the gap. Do not add a token or a component to make the row resolve; that is a code change with its own review.
5. Run `npm run design-system:check`. It fails on a mapped variable whose token path is not in the export, a wrong `cssVariable`, and a mapped component whose path does not exist.

### Manifest shape

```json
{
  "$schema": "semester.figma-mapping/1",
  "figma": { "fileUrl": null, "fileKey": null, "lastSynced": null },
  "requiredTokens": [],
  "variables": [
    {
      "figmaCollection": "<collection name as it appears in Figma>",
      "figmaVariable": "<variable name>",
      "tokenPath": "semantic.<name>",
      "cssVariable": "--<name>",
      "status": "mapped | unresolved | obsolete",
      "notes": ""
    }
  ],
  "components": [
    {
      "figmaComponent": "<component name>",
      "codePattern": ["app/src/components/<File>.tsx"],
      "variants": { "<figma property=value>": "<prop or class>" },
      "status": "mapped | unresolved | obsolete",
      "notes": ""
    }
  ]
}
```

`requiredTokens` is the ratchet: once a real library exists, list the token
paths that must stay mapped and the check fails if one stops being.

## Variable mapping

Empty until a Figma file is connected. Columns are the manifest's fields.

| Figma collection | Figma variable | Exported token path | CSS source variable | Status | Notes |
|---|---|---|---|---|---|
| — | — | — | — | template | No Figma metadata is available locally. |

## Component mapping

| Figma component | React or CSS pattern | Variant and state mapping | Status | Notes |
|---|---|---|---|---|
| — | — | — | template | No Figma metadata is available locally. |

## Rules

- No new Figma variable becomes a production token without code review: a token is a `tokens.css` change, measured on every ground, exported, and reviewed.
- No Figma component becomes a React component automatically. Map it to what exists first; a new shared component goes through `docs/design/GOVERNANCE.md` §2.
- A Figma variant maps only to a documented prop or class.
- Figma styles that are local to a file are not tokens.
- Missing Figma states do not remove code requirements. Loading, empty, error, disabled, permission, keyboard, focus and narrow-width behaviour are owed whether or not the frame draws them.
- A raw value is never added to match a Figma frame.
- An unresolved mapping is documented, as `status: "unresolved"` with a note, not left out.

## Reading the check

`npm run design-system:check` and the report separate four buckets:

| Bucket | Meaning | Fails the check? |
|---|---|---|
| Valid | Mapped, token path in the export, `cssVariable` matches | No |
| Missing code token | Mapped to a path that is not in `semester.tokens.json` | **Yes** (blocker) |
| Obsolete | Marked obsolete and the token is gone, as it should be | No (a minor finding if the token still exists) |
| Unmapped candidates | Semantic tokens no mapping names. Not required until listed in `requiredTokens` | No |

See [the baseline](SEMESTER-DESIGN-SYSTEM-BASELINE.md) for what exists today and
what is deferred, and [`docs/design-system/README.md`](README.md) for the
commands.
