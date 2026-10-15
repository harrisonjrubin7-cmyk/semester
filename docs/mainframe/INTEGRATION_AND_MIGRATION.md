# Integration and migration

Replacement domains need mapping, versioned sync, reconciliation, dual run, an approved cutover, rollback, export, and a retirement step. None of that is approved for registration.

## Current bridges

- Catalog JSON or CSV into the Term plan. The notice says seat counts are the file’s.
- Paste from the school’s YES portal into the enrolled-schedule tab. The app cannot read a tab it does not own.
- `writeback.registration_submit` for a future official command. The screen tells the student the school has not turned it on.

## What would count as authority transfer

Functional parity, data authority, security, privacy, accessibility, tenant isolation, migration integrity, institutional approval, support readiness, portability, and outcome proof. The mainframe PDF lists those as the bar. This repository has not met them for enrollment. The device plan is not a step across that bar.

## This batch

No mapping table, no sync job, no dual-run flag, no cutover. The student-visible boundary is the sentence on the named-course list and the existing Term plan notice.

Rollback of this batch is a code revert. Courses already typed on a device stay until that person deletes them. There is no remote row to remediate.
