# The platform is layered, and `seam/` is the one door to the institution package

**Status:** Accepted; enforced by test.

## Decision

Imports point down a fixed stack — kernel/seam → observability and the
error/header modules → tenancy → identity → policy → events → gateway → engines →
isolation → sdk → testing/reference — and the import graph has no cycles. **Only
`seam/` imports `packages/institution`.** No shipped code reads a clock, randomness,
the environment, the console, the network, the DOM or a Node built-in; time, ids and
I/O are handed in. Every relative import ends in `.ts`. The app imports the package
through its alias; Supabase functions do not import it at all.

## Why

A policy module that imports an engine is how a rule comes to depend on the thing it
governs. Reaching the institution package from many places is how the platform grows
a second copy of the decision point; one door means a rename is one edit. Ambient
authority is why rules are untestable and why a tenant could be read from the
environment. The NodeNext rule is a scar: `packages/institution` re-exporting a
module from `supabase/functions/_shared/` passed every local gate and failed CI with
TS1287 (`CLAUDE.md`, *check:university is not a duplicate of tsc -b*).

## What it was chosen over

- **Convention and review:** the repository's own history is that several sessions
  converge on the same code in an hour; a boundary needs a test.
- **A lint plugin:** another toolchain for what ~100 lines of test express.
- **Letting the SDK import anything:** it is meant to run in a browser.

## How it is held

`packages/platform/src/architecture.test.ts` — layering, cycles, the unplaced-file
guard, the door, ambient authority, NodeNext, "nobody reaches around", every Memory
class used, error codes live, no file over 650 lines. **Every scan has a control**: a
fixture the scanner must catch, because a scan that finds nothing is also what a scan
that looks for the wrong thing finds.

## What this constrains

A new directory is placed in `rank()` deliberately. Supabase functions get the
platform's *contracts* (generated JSON), not imports. An exemption from the ambient
authority rule is by file, with a sentence of why.
