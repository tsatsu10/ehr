# Pharmacy Advanced (Inventory) — Native Redesign Plan

| Field | Value |
|-------|--------|
| **Document version** | 0.1.1 |
| **Status** | **Built** — all 4 report views native (reorder, destroyed, activity, transactions); add-drug + receive/destroy writes were already native |
| **Parent spec** | [NEW_CLINIC_V1_PHARMACY_OPERATIONS_REDESIGN.md](../done/NEW_CLINIC_V1_PHARMACY_OPERATIONS_REDESIGN.md) (M13, v0.1.10) — this doc details the inventory/report surfaces that M13 §12/§15 name but leave as stock wraps |
| **Companion to** | [NEW_CLINIC_V1_PRD.md](../done/NEW_CLINIC_V1_PRD.md), [gap analysis](./NEW_CLINIC_OPENEMR_GAP_ANALYSIS_AND_REDESIGN_PLAN.md) |
| **Scope** | Native React replacements for the 6 stock pages behind **Pharmacy Ops → Advanced**: reorder report, inventory management, add drug, destroyed drugs, inventory activity, inventory transactions |
| **Governing flag** | Everything here sits behind **`enable_pharm_ops`** (and, where noted, `inhouse_pharmacy`), **default OFF** — flag OFF keeps the current "(core)" stock links (PRD §5.6 invariant) |
| **Primary market** | Private cash outpatient clinics — West Africa |

---

## 1. Why this plan

Today the Pharmacy Ops hub's **Advanced** dropdown deep-links six stock OpenEMR
pages (`pharm-ops/index.html.twig` lines 60–65). They are the classic
Rod-Roark inventory screens: procedural PHP, US/NDC-centric, warehouse + lot
heavy, and visually unrelated to the New Clinic desks. M13 always intended these
to become native "report façade / stock alerts / guided catalog" surfaces
(parent spec §10, §12, lines 98–102) but scoped the build as post-pilot. This
plan turns that intent into six concrete, buildable pages.

**Non-negotiables carried from the parent spec & PRD:**

- **Flag-gated, default OFF.** No half-native chrome when `enable_pharm_ops = 0`;
  the stock links stay reachable until each native page passes parity.
- **Not full supply chain.** Multi-branch central warehouse, wholesaler EDI, and
  NHIS medicines pricing remain a **V3 non-goal** (parent §14, PRD Tier 3). We
  model a **single in-house dispensary** with lots, not a distribution network.
- **Regional.** Clinic-configurable currency (never hardcode `$`/`GHS`),
  DD/MM/YYYY dates, no NDC-mandatory fields. NDC/UPC stay optional.
- **Reads never write (R2), bounded queries (R1).** These are hot report reads;
  they must be `READONLY_ACTIONS` (session lock released) and every list capped.

## 2. Shared architecture

| Concern | Decision |
|---------|----------|
| **Where they live** | New tabs/panes inside the existing **Pharmacy Ops hub** island (`pharm-ops`), not new top-level desks. Advanced dropdown items point at hub tabs (`?tab=reorder`, `?tab=stock`, …) instead of `interface/drugs/*`. |
| **Data layer** | New `pharm_ops.inventory.*` ajax actions in `PharmOpsActionHandler` → a new `PharmInventoryService` (+ reuse `PharmOpsWorklistService` stock helpers). Every island calls `oeFetch`. |
| **ACL bridging** | Stock pages use core `admin/drugs`, `inventory/*`, `acct/rep`. Map to module ACLs: **view** = `new_pharmacy` (or `new_pharmacy_lead`); **catalog/destroy writes** = `new_admin`/`new_pharmacy_lead`. Register any new ACO in `install.sql` + GACL and verify via `gacl_aco_map` (see the ACL-drift lesson). Mirror the stock ACL server-side in `AjaxActionPolicy::describe()`. |
| **Mutations** | Add-drug save, receive stock, and destroy-lot are **writes** — POST-only, CSRF, `assertAccess`, never in `READONLY_ACTIONS`. Reorder/activity/transactions/destroyed *list* reads are read-only. |
| **Styling** | `nc-` BEM + `--oe-nc-*` tokens; shared `DataTable`, `QueueCard`, `SlideOver`, `deskToast`, `ConfirmModal`. No Bootstrap-colliding class names. |
| **Facility/warehouse** | Single dispensary assumption: warehouse is optional. Facility scoping follows the hub's resolved facility, not facility-0. |

## 2b. Reality reconciliation (what already exists — read before building)

A code re-audit (2026-07-15) found the hub is **more built than this plan first
assumed**. Do **not** rebuild these — they are already native:

| Surface | Already native | Evidence |
|---------|----------------|----------|
| **Add drug / catalog CRUD** (Page 3) | ✅ Built | `PharmCatalogAdminService` + `pharm_ops.catalog_list`/`catalog_save`; hub `canManageCatalog` |
| **Destroy lot** (write half of Page 4) | ✅ Built | `PharmOpsDestroyService` + `pharm_ops.destroy_get`/`destroy_confirm`; `PharmOpsDestroyDrawer` |
| **Receive stock / lot-in** | ✅ Built | `PharmOpsReceiveService` + `pharm_ops.receive_*`; `PharmOpsReceiveDrawer` |
| **Low-stock worklist** (flat) | ✅ Built | `PharmOpsWorklistService::fetchLowStockRows()`, hub `low_stock` count |
| **Warehouses** | ✅ Built | `pharm_ops.warehouse_create` |

**The genuine remaining gap = the four REPORT VIEWS the hub still deep-links to
stock** (`PharmOpsReportsService::embedCatalog()` returns `embed_url` → stock pages):

1. **Reorder report** (`inventory_list.php`) — native low-stock is only a flat check; no velocity/DoS/suggested qty.
2. **Inventory activity** (`inventory_activity.php`) — no native view.
3. **Inventory transactions** (`inventory_transactions.php`) — no native view.
4. **Destroyed drugs list** (`destroyed_drugs_report.php`) — destroy *write* is native, the *list/report* is not.

Plus (optional, lower value) a **native stock browser** to replace the
`drug_inventory.php` deep-link, since the worklist shows low-stock but not a full
drugs×lots browser.

**Revised build scope** = turn those 4 report embeds into native panes (Page 3 and
the receive/destroy writes are done). Each native report view flips its
`embedCatalog()` entry from `embed_url` (stock) to a native pane behind `enable_pharm_ops`.

## 2c. Build status (2026-07-15) — DONE

All four report views are built, tested (Vitest + PHPUnit crosscheck), and
verified against live DB data. Each flips its `embedCatalog()` entry to
`native: true`, keeps the stock page as a labelled fallback, and is a bounded
`READONLY` read dispatched by report id in `PharmOpsReportsPane`.

| View | Service method | Action | Commit |
|------|----------------|--------|--------|
| Reorder | `reorderReport()` | `pharm_ops.inventory.reorder` | `6a7c6e9e` |
| Destroyed | `destroyedReport()` | `pharm_ops.inventory.destroyed` | `6a7c6e9e` |
| Activity | `activityReport()` | `pharm_ops.inventory.activity` | `dc851ced` |
| Transactions | `transactionLedger()` | `pharm_ops.inventory.transactions` | `52a4c172` |

**Deferred by decision:** Inventory Activity ships a **movement summary**, not the
back-derived start/end balance (the sign-sensitive accounting) — the stock report
remains the labelled full-accounting fallback. A native **stock browser** (replacing
the `drug_inventory.php` link) is the remaining optional surface.

## 3. Build order (lowest-risk, highest daily value first)

1. **Reorder / low-stock report** — read-only, extends an existing native tab. Safest.
2. **Inventory management (stock browser)** — read-only browser; foundation for the rest.
3. **Add drug (guided catalog)** — first write surface; unlocks "add product" without the scary stock form.
4. **Destroyed drugs** — small read + a guarded destroy-lot write.
5. **Inventory activity** — accounting rollup (read-only).
6. **Inventory transactions** — line-ledger (read-only), reuses activity plumbing.

Each page: build → `composer verify:new-clinic` + Vitest + build → **audit against this
plan and every render path** → asset bump → then the next page.

---

## 4. Page 1 — Reorder / low-stock report

**Replaces** `interface/reports/inventory_list.php` (ACL `inhouse_pharmacy` +
`admin/drugs`/`inventory/reporting`).

**Current behaviour.** `checkReorder()` computes units sold from `drug_sales` over
*N* days, sums non-expired/non-destroyed `drug_inventory.on_hand`, and flags a
product when on-hand ≤ reorder point (or, in `gbl_min_max_months` mode, below the
min months-of-supply). Sort by name/active/consumable; CSV export.

**What already exists natively.** `PharmOpsWorklistService::fetchLowStockRows()`
feeds a **Low stock** worklist tab — but it's only a flat `on_hand ≤ reorder_point`
check: no velocity, no days-of-supply, no suggested quantity, no filters, no export.

**Native redesign — "What to buy this week".**
- Table columns: Product · QOH · Reorder point · **Sold (last N days)** · **Avg/day** ·
  **Days of supply left** · **Suggested order qty** · Status chip (Out / Low / OK).
- Controls: N-day window (30/60/90), include-consumables toggle, active-only, search,
  sortable columns, **Export CSV**. Row action: **Receive stock** → Page 3/lot flow.
- States: loading skeleton, empty ("all stock healthy"), error callout.
- "Suggested qty" = target-days-of-supply × avg/day − QOH (documented, simple, editable target).

**Data / AJAX.** `pharm_ops.inventory.reorder` (READONLY) → `PharmInventoryService::reorderReport(window, filters)`.
One bounded query: per-drug QOH (subquery) + velocity (`drug_sales` sum over window) join.
`pharm_ops.inventory.reorder_export` streams CSV (respondCsv).

**ACL.** view = `new_pharmacy`/`new_pharmacy_lead`/`new_admin`. **Effort: S.**

## 5. Page 2 — Inventory management (stock browser)

**Replaces** `interface/drugs/drug_inventory.php` (ACL `admin/drugs` or `inventory/*`).

**Current behaviour.** Browser of **drugs × lots × warehouses**: filters (facility,
warehouse, show-empty, show-inactive, consumable), sortable by product/lot/QOH/
expiration/warehouse; each row is a lot with QOH + expiration; links into lot
transactions (`add_edit_lot.php`).

**Native redesign — "Stock room dashboard".**
- Two-level view: **by product** (rolled-up QOH, #lots, nearest expiry, status) that
  expands to its **lots** (lot #, QOH, expiry, received, warehouse). Default hides
  empty lots + inactive products.
- **Expiry lens:** chips/sort for *expired* and *expiring ≤ 90 days* (clinic-critical,
  the stock page buries this). Search by product.
- Row actions (permission-gated): **Receive stock** (lot in), **Adjust**, **Destroy**
  (→ Page 4). Read-only for non-writers.
- States: loading, empty, error; expiry rows visually flagged (warning/danger tokens).

**Data / AJAX.** `pharm_ops.inventory.stock_list` (READONLY, bounded + paginated) →
`PharmInventoryService::stockList(filters)`; `pharm_ops.inventory.lot_detail` for a
product's lots. Write flows (receive/adjust) POST actions, CSRF, `new_admin`/lead.

**ACL.** view = `new_pharmacy`; lot writes = `new_admin`/`new_pharmacy_lead`. **Effort: M.**

## 6. Page 3 — Add drug (guided catalog)

**Replaces** `interface/drugs/add_edit_drug.php` (ACL `admin/drugs`).

**Current behaviour.** Product-master CRUD over `drugs` + `drug_templates`: name,
NDC, form, size, unit, route, reorder_point, dispensable, consumable, active, and a
template grid (selector/dosage/period/quantity/refills + per-level prices). Dense,
NDC-forward, admin-only.

**Native redesign — "Add a medicine".**
- Short guided form (accordion, matching registration UX): **Identity** (name, form,
  strength/size, unit, route) → **Dispensing** (dispensable, consumable, reorder point,
  default sig/quantity) → **Pricing** (single clinic price by default; multi-level behind
  a toggle) → **Optional codes** (NDC/UPC collapsed, never required).
- Inline validation while typing; form doesn't wipe on error; disappears after save
  (the standing forms rules). Edit reuses the same form pre-filled.
- Reuse formulary starter-pack import (parent §11) as a later add-on, not v1 of this page.

**Data / AJAX.** `pharm_ops.catalog.get` / `pharm_ops.catalog.save` (POST, CSRF).
`PharmInventoryService::saveDrug()` writes `drugs` (+ optional template). Reuses the
existing `pharm_ops.catalog_list` read.

**ACL.** `new_admin`/`new_pharmacy_lead` only (catalog is authority data). **Effort: M.**

## 7. Page 4 — Destroyed drugs

**Replaces** `interface/reports/destroyed_drugs_report.php` (ACL `acct/rep`) + the
`destroy_lot.php` write.

**Current behaviour.** Lists lots with `destroy_date` in a date range: lot #, QOH,
product, destroy date/method/witness/notes. Click → `destroy_lot.php` (mark a lot
destroyed with witness/method/date).

**Native redesign — "Write-off log".**
- Read: date-range table (Product · Lot · Qty · Destroyed on · Method · Witness · Notes),
  DD/MM dates, export.
- Write: **Destroy lot** action (from here or the stock browser) → `ConfirmModal` with
  method, witness, date, notes — a guarded, audited write (destruction is irreversible).
- States: loading/empty/error; confirmation is explicit (irreversible action).

**Data / AJAX.** `pharm_ops.inventory.destroyed_list` (READONLY, range-bounded) →
`destroyedList(from,to)`; `pharm_ops.inventory.destroy_lot` (POST, CSRF) writes
`drug_inventory.destroy_*` and logs an audit event.

**ACL.** view = `new_pharmacy`; destroy write = `new_admin`/`new_pharmacy_lead`. **Effort: S–M.**

## 8. Page 5 — Inventory activity

**Replaces** `interface/reports/inventory_activity.php` (ACL `acct/rep`).

**Current behaviour.** Per-product (× warehouse) movement rollup over a date range:
**Start balance → Sales, Distributions, Purchases, Transfers, Adjustments → End
balance**, aggregated from `drug_sales` by transaction type against `drug_inventory`.
CSV export.

**Native redesign — "Stock movement summary".**
- Date-range table, one row per product: Start · Sales · Distributions · Purchases ·
  Transfers · Adjustments · End, with totals; positive/negative movement styled with tokens.
- Controls: date range presets, product search, **Export CSV**.
- Single-dispensary framing: warehouse column optional/collapsed.

**Data / AJAX.** `pharm_ops.inventory.activity` (READONLY, bounded) →
`activityReport(from,to)` — the movement rollup as one grouped query. `..._export` CSV.

**ACL.** view = `new_pharmacy`/`new_admin`. **Effort: M.**

## 9. Page 6 — Inventory transactions

**Replaces** `interface/reports/inventory_transactions.php` (ACL `acct/rep`).

**Current behaviour.** Line-by-line ledger from `drug_sales` (type derived from
`trans_type` + `distributor_id`): Date · Transaction (Sale/Purchase/Transfer/
Adjustment/Distribution) · Product · Lot · Warehouse · Who · Qty · Amount · Billed ·
Notes. Filter by transaction type; CSV export.

**Native redesign — "Stock ledger".**
- Paginated ledger table with a **transaction-type filter** (All / Purchase-Return /
  Sale / Distribution / Transfer / Adjustment) and date range; type shown as a chip;
  amount in clinic currency; **Export CSV**.
- Reuses Page 5's date-range + export plumbing; this is the drill-down detail to
  activity's summary.
- States: loading/empty/error; paginated (R1 — ledgers grow).

**Data / AJAX.** `pharm_ops.inventory.transactions` (READONLY, paginated) →
`transactionLedger(from,to,type,offset)`. `..._export` CSV.

**ACL.** view = `new_pharmacy`/`new_admin`. **Effort: M.**

---

## 10. Cross-cutting acceptance

- Flag OFF (`enable_pharm_ops = 0`) → Advanced links unchanged (stock pages); no native chrome.
- Flag ON → each native tab reachable from the Advanced menu; the stock link stays as a
  labelled "Open stock version" fallback until the native page is parity-signed.
- Every list read is in `READONLY_ACTIONS` and bounded/paginated; every write is POST +
  CSRF + `assertAccess` + audit-logged; no read triggers a write.
- Currency/date formatting regional; no NDC-required fields.
- Per-page: Vitest for the island, PHPUnit for the service, `composer verify:new-clinic`,
  and a browser smoke against seeded drug/lot/sales data.

## Version history
| Version | Date | Change |
|---------|------|--------|
| 0.1.0 | 2026-07-15 | Initial per-page plan for the 6 Pharmacy Advanced pages; extends M13. |
| 0.1.1 | 2026-07-15 | All 4 report views built (reorder, destroyed, activity, transactions) + verified; §2c build-status table added. Activity ships a movement summary (start/end balance deferred by decision). |
