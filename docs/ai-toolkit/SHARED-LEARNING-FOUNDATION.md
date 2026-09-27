# Shared learning foundation

What every department inherits — `UNIVERSAL` in `app/src/lib/toolkit/catalog.ts`.

| Tool | State | Where |
| --- | --- | --- |
| Research Studio | Guided | Toolkit → Research Studio |
| Data Studio | Guided | Toolkit → Data Studio |
| Assignment workspace | Guided | Toolkit → Assignments |
| Rubric self-check | Guided | Toolkit → Rubric self-check |
| AI-use declaration | Guided | Toolkit → AI-use policy |
| Study guide from sources | Native | Study |
| Practice paper | Native | Practice paper |
| Sources | Native | Sources |
| Write a document | Native | Write |
| Check the writing | Native | Check the writing |
| Make a deck | Native | Make a deck |
| Group work | Native | Group work |

The foundation's rules, each enforced in code and tested:

1. **Private by default.** Everything is on the student's device. Workspaces read
   back as `visibility: 'private'` even if the stored value was edited to say
   otherwise.
2. **Delete and export are always there.** Every workspace, research project and
   dataset has *Delete* (with a confirmation) and a download.
3. **Nothing is fabricated.** Missing citation fields print as `[year missing]`;
   unknown policy prints as *Policy unavailable — ask your instructor*; a claim with
   no linked evidence audits as *Insufficient evidence*.
4. **A failed read is not replaced with empty data.** `useDeviceLibrary` refuses to
   write over a record it cannot parse and offers a recovery download.
