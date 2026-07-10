# New Clinic — T2 Globals Profile ("private cash clinic" preset)

**Status:** v0.1.0 — closes PRD §5.6 row **T2** ("Menu & globals profile" — config
documentation + installer). Companion to
[NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md](./done/NEW_CLINIC_V1_ADMIN_CONFIGURATION_REDESIGN.md)
(D-ADMIN-1: stock `edit_globals.php` is Advanced-only, not the default admin path).

## Purpose

New Clinic already restricts *menus* per role (`MenuEvent::MENU_UPDATE` /
`MENU_RESTRICT`, M0-F08) and ACL (§4.4). It did not previously document or automate
the handful of **stock core `globals` table** values that a private, cash-only,
insurance-free clinic should carry — so every install relied on an admin manually
finding the right toggle in `edit_globals.php`. This doc is the source of truth for
those values; `scripts/pilot-enable-clinic-globals-profile.php` applies them.

## Applied automatically (idempotent, safe to re-run)

| Global | Stock default | Clinic preset | Why |
|--------|---------------|----------------|-----|
| `omit_employers` | `0` (shown) | `1` (omit) | Cash-only private OPD has no workers'-comp/employer-insurance billing pipeline in V1 scope (§3.2 non-goals); hides an irrelevant field from the already-overloaded stock demographics form (§2.4.3 — New Clinic's own registration form, M1b, doesn't collect employer either). |
| `hide_billing_widget` | `0` (shown) | `1` (hidden) | M5 Cashier + M14 Billing Back Office are the only supported billing paths (§6.1 checkout gate). Leaving the stock billing widget visible on the legacy chart risks a receptionist posting a payment outside the completion/E-Sign gate (`assertProfileSigned`, §6.1.1) that the Cashier desk enforces. |
| `portal_onsite_two_enable` | `0` (off) | `1` reasserted → `0` | Patient portal is an explicit non-goal (CLAUDE.md §0, PRD §3.2 NG list) — already off by stock default; the script defensively re-asserts `0` so a prior admin experiment doesn't silently leave it on for a pilot site. |
| `erx_enable` | `0` (off) | reasserted `0` | eRx vendor UI is an explicit non-goal (same list) — same defensive reassert. |

## Deliberately NOT automated (site-specific — set by hand per install)

| Global | Why this can't be a fixed preset value |
|--------|------------------------------------------|
| `gbl_time_zone` | Must match the clinic's physical location. Primary market is West Africa (mostly UTC/GMT, no DST) but the product is not region-locked (frontend CLAUDE.md: "never hardcode" regional assumptions) — a fixed value here would be wrong for any clinic outside that band. Confirm at install time; `date('Y-m-d')` / `CURDATE()` agreement depends on this (PRD line ~1811). |
| `prevent_browser_refresh` | Stock default is already `2` ("warn and prevent") — the correct production setting for protecting in-progress registration/cashier forms from an accidental F5. **Do not** set this to `0` clinic-wide; that is a *personal developer convenience* documented in CLAUDE.md §6 for desktop XAMPP work only, never a pilot/production preset. |

## Usage

```powershell
C:\xampp\php\php.exe interface\modules\custom_modules\oe-module-new-clinic\scripts\pilot-enable-clinic-globals-profile.php
```

Safe to run repeatedly (insert-or-update, same pattern as
`pilot-enable-login-hardening.php`, SEC-8). Run once per install, after
`upgrade_sql.php` / `install_acl.php`, before pilot sign-off.

## Verification

- Admin → demographics: employer field absent from stock registration screen.
- Legacy chart (`⋯ Classic patient menu`): no stock billing widget visible.
- Admin → Config → Portal: Patient Portal toggle is off.
- Admin → Config → Connectors: Ensora eRx toggle is off.
- `gbl_time_zone` matches the clinic's actual timezone (confirm manually — not asserted by the script).

## History

| Date | Change |
|------|--------|
| 2026-07-10 | Initial doc + script — closes T2 scorecard gap (was 40%, "installer preset doc; not full automation"). |
