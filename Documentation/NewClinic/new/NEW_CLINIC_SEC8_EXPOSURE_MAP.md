# Core Surface Exposure Map (SEC-8)

| Field | Value |
|-------|-------|
| **Document version** | 1.0.0 |
| **Purpose** | Make CVE triage mechanical: exposed → emergency, unexposed → next train |
| **Baseline** | OpenEMR 8.0.0 (see VERSION_BASELINE.md) |

## What our deployments actually expose

| Core surface | Exposed? | Notes / triage weight |
|--------------|----------|-----------------------|
| **Login / auth** (`interface/login`, `AuthUtils`) | **YES** | The one always-reachable pre-auth surface. Any auth/session CVE = emergency. Hardened by SEC-4/5; tunnel-only cuts reachability. |
| **Session handling** (`SessionUtil`) | **YES** | Session fixation/hijack CVEs = emergency. |
| **Module ajax bootstrap** (`globals.php` → module `ajax.php`) | **YES** | Every desk action flows through it. RCE/auth-bypass in bootstrap = emergency. |
| **Document upload / storage** (`Documents`, `sites/*/documents`) | **YES (staff-only)** | Registration referral upload + exports. Path-traversal/upload CVEs = emergency. |
| **Bridged legacy screens** (transactions, history, ACL admin via iframe/bridge) | **YES (staff-only)** | Reachable through `clinical-form-bridge.php` / `admin-people-legacy.php`. Weight by which screen. |
| **Core clinical forms** used by the module | **YES (staff-only)** | Encounter/history forms via the form bridge. |
| **Calendar / scheduling** (stock) | **PARTIAL** | Only when `enable_queue_bridge` / scheduling flags on. |
| **Patient Portal** | **NO** | Disabled non-goal (`portal_onsite_two_enable=0`, DisabledSurfacesTest). Portal CVEs → **not applicable**, record and skip. |
| **REST API** | **NO** | `rest_api=0`. Not applicable. |
| **FHIR API** | **NO** | `rest_fhir_api=0`. Not applicable. |
| **OAuth2 / SMART** | **NO** | Not enabled. Not applicable. |
| **CCDA / eRx / eligibility / EDI** | **NO** | Non-goals. Not applicable. |

## Triage shortcut

- CVE in **login, session, ajax/bootstrap, document upload, or a bridged screen we use**
  AND affects 8.0.0 → **emergency patch drill** (48h).
- CVE only in **portal / REST / FHIR / OAuth / CCDA / eRx / EDI** → **not applicable**;
  record the decision, no action (these surfaces are off — DisabledSurfacesTest enforces it).
- Everything else → **next release train**, patched on rebase.

## Reachability multiplier

Default **tunnel-only** deployments are not internet-reachable, so even an
"exposed" surface is only reachable by authenticated staff on the tunnel — drop
one severity level for prioritization (but still patch). **Public-exposure**
deployments do not get this discount.
