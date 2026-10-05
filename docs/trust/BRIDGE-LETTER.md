# SOC 2 Bridge Letter: Process and Templates

**Not usable yet.** A bridge letter covers the gap between the end of a
completed SOC 2 report's period and the next report. Semester has no SOC 2
report, so there is nothing to bridge. This page is here so that the process
exists before the first report does.

It must never be used to imply that a report exists. A bridge letter is a
management representation. It is not an audit opinion, and it does not extend
one.

## Customer cover email

```
Subject: Semester SOC 2 report and bridge letter

Hello [Customer contact],

Attached is Semester's [SOC 2 Type I / Type II] report covering [start date]
through [end date], provided under the report's confidentiality terms.

Because that period ended on [end date], we are also providing a management
bridge letter dated [letter date]. It describes management's representation
about material changes to Semester's system and controls between the report
end date and the letter date.

The report and letter are confidential and are provided only for your
vendor-risk assessment. They do not amend our agreement, create a warranty,
or replace customer-specific contractual commitments.

Security contact: [name, title, email]
```

## Management bridge letter outline

1. Identify the exact auditor, report and coverage period.
2. Define the bridge period: [report end date] through [letter date].
3. State that management performed a documented review of material changes,
   material security incidents, relevant control exceptions and remediation
   status during the bridge period.
4. State only the conclusion that review supports. Either:
   - no material changes were identified that would reasonably be expected
     to materially affect the system description or relevant controls; or
   - the following material changes or exceptions occurred: [specific
     disclosure].
5. State whether any material incident affected customer data or service, and
   whether it was communicated as the contract requires.
6. State that the letter is a management representation, is not an audit
   report, and does not extend the auditor's opinion.
7. Limit reliance to the named customer and the vendor-risk purpose.
8. Have an authorized executive sign and date it.

## Evidence to assemble before signing one

- [ ] The signed prior SOC report and management assertion.
- [ ] The bridge-period change log. Merged pull requests and deployments are
      the source.
- [ ] The security incident register.
- [ ] The material vulnerability and finding register.
- [ ] Major vendor or subprocessor changes ([`docs/SUBPROCESSORS.md`](../SUBPROCESSORS.md) history).
- [ ] Access-review results for the period.
- [ ] Backup, restore and availability evidence.
- [ ] Any material customer-impacting outage review.
- [ ] A management review and approval record.
- [ ] Counsel or auditor review, where the contract requires it.

If any box cannot be ticked, the letter should say what is missing rather
than conclude "no material change".
