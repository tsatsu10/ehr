# Upstream Version Baseline (SEC-8)

| Field | Value |
|-------|-------|
| **Upstream project** | OpenEMR (https://github.com/openemr/openemr) |
| **Tracked release** | **8.0.0** (`version.php`: v_major 8, v_minor 0, v_patch 0) |
| **Database version** | 531 |
| **ACL version** | 12 |
| **Fork root commit** | `87afda250e91ae624d3d51e1f2f343fdc084cae3` |
| **Baseline recorded** | 2026-07-09 |
| **Maintainer** | Engineering |

## What this is for

The 48-hour CVE triage decision is **mechanical** only if we know exactly which
upstream we track. When an OpenEMR advisory lands:

1. Does it affect **8.0.0**? (check the advisory's affected-version range)
2. Does it touch a surface **we expose**? (see `NEW_CLINIC_SEC8_EXPOSURE_MAP.md`)
3. Exposed + affected → **emergency patch drill**. Unexposed or not-in-range →
   **next release train**.

## Update procedure

- Bump the **Tracked release** here whenever we rebase onto a newer OpenEMR tag.
- Re-run `scripts/upstream-advisory-check.php` after the bump to reset the "new
  since last check" watermark.
- Record the rebase in the fork's history and re-run the full verify chain.
