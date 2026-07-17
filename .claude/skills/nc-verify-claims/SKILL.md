---
name: nc-verify-claims
description: Use when a doc, spec, scorecard cell, PRD status line, README index entry, redesign-spec statement, comment, or a stated summary claims something about the New Clinic code and you need to know whether the code actually does that. For catching doc-vs-code drift ("the scorecard says built, but is it?"), verifying a spec before trusting it, or checking a PR/handoff description against the real code. Not for reviewing new code for bugs — that is nc-code-review.
---

# New Clinic — verify claims against code

Independently check whether stated claims about the code are **true**. This is the
complement to `nc-code-review`: that one asks "is this new code good?"; this one asks
"does the code actually do what this doc/spec/claim says?" It exists because New Clinic's
scorecard, PRD status matrices, and README index **go stale** — CLAUDE.md §12 says trust
the code over the doc, then fix the doc. This skill is how you find out which to trust.

Validated: on a controlled test, cold reviewers using this method caught 15/15 planted
false claims in a spec with zero false alarms. The method below is what made that work.

## The method (do not skip a step)

1. **Trust the code, not the claim.** Read the actual source that the claim is about.
   Never confirm a statement from the doc's own wording, your memory of the module, or a
   related doc — only from the code (and, if needed, the live DB read-only). CLAUDE.md:
   the repo is the source of truth.
2. **One claim at a time.** Break the doc/spec/summary into discrete factual claims.
   Judge each **ACCURATE** or **WRONG** on its own. A paragraph that is 80% right still
   has a wrong 20% that must be flagged separately.
3. **Cite the proof.** Every verdict carries a `file:line`. For WRONG, state the correct
   fact. "Seems right" is not a verdict — if you can't point at the line, it stays
   UNKNOWN, not ACCURATE.
4. **Don't cry wolf.** Only flag what is actually false. The true claims must pass clean.
   A reviewer that flags everything is guessing, not verifying — the true-claim pass rate
   is part of the result.
5. **Run it cold and independent.** Ideally dispatch this as a separate reviewer given
   only the claim + the code, not the reasoning that produced the claim. A writer
   fact-checking their own doc rationalizes; a cold reader does not.

## Where New Clinic claims quietly drift from code (check these hard)

- **Scorecard "% built" / PRD status matrices** — the #1 stale surface. "Done"/"Not
  started" cells routinely disagree with the code. Verify against the actual service +
  island + wiring, not the cell.
- **"Behind a flag, default OFF"** — a flag is only real if wired in **three** places:
  `install.sql`, `ClinicAdminService::EDITABLE_SETTINGS`, and `adminFieldDefs.ts`
  (allowlist + field def). A doc can claim a flag exists when it is unreachable. Read the
  facility-resolved value, not the facility-0 default.
- **"ACL-gated"** — enforcement needs the ajax-action ACL **and** the service
  `assertAccess` **and** (for shared islands) the state gate. Verify grants via
  `gacl_aco_map` / `gacl_aro_groups_map`, never install-script echo text.
- **"ajax action X returns Y"** — confirm against `public/ajax.php` + the service:
  envelope `{ success, data | error }`, the real field names, the ACL check, side effects.
- **"Writes/updates row Z"** — do not trust `generic_sql_affected_rows()`/`insert_id()`
  after `sqlStatement()` (they reflect OpenEMR's query log). Confirm with a readback.
- **Meds/billing** — charges live in `drug_sales`, not `billing`; cash checkout only at
  `ready_for_payment`. Docs often blur these.

## Output

A table: **claim | ACCURATE / WRONG / UNKNOWN | proof `file:line` (correct fact if WRONG)**.
Then one line listing the WRONG claim numbers, and the true-claim pass count (e.g. "9/9
true claims verified, 5 false"). If the target is a scorecard/PRD/README, end by naming
the exact doc lines to fix so the doc matches the code — per CLAUDE.md §12, fix the doc in
the same batch.
