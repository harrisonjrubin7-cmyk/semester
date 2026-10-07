# Component definitions

One file per component, named `<componentId>.component.json`, in the shape of
[`../component.schema.json`](../component.schema.json). This directory **is** the registry (D-1356): a
definition is reviewed in a pull request like any other change, and
`packages/institution/src/registry-files.test.ts` fails CI when a file is
malformed, is named for a different component, points at a path that does not
exist, or conflicts with another file (a missing provider, two providers, two
authoritative writers of one record).

It is empty on purpose. A definition's `implementation.repositoryRef` must be a
path that exists in this repository, so a component cannot be registered from a
catalogue or a PDF, only from code that is there.

Tables were the other option. They are not needed until something outside the
repository must read the registry at runtime; when that is true, load these
files into them, never the other way round.
