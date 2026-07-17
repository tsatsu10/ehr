# New Clinic — Chat Knowledge Base

Consolidated notes from Cursor agent conversations about **New Clinic V1** design and planning. **No code** — decisions, data, timelines, and references only.

## Source transcripts

| Transcript ID | Focus | Period |
|---------------|--------|--------|
| `fe6b41d7-7a53-4d3d-beb5-5f9384575912` | Design specs: COM, Registry, multi-doctor, routing, audits, OpenEMR gap analysis | June 2026 |
| `b0a2e23c-e44f-41be-b1aa-313c57a7d51d` | Implementation: React islands, E2E, module build | June–July 2026 |

Canonical product docs live in `Documentation/NewClinic/`. These chat files capture **how and why** decisions were made in conversation.

## Index

| File | Contents |
|------|----------|
| [00-conversation-timeline.md](./00-conversation-timeline.md) | Chronological user questions and outcomes |
| [01-environment-and-project-setup.md](./01-environment-and-project-setup.md) | XAMPP, CLAUDE.md, local dev context |
| [02-communications-hub-design.md](./02-communications-hub-design.md) | Message Center redesign → COM Phase 1 |
| [03-front-desk-search-and-registry.md](./03-front-desk-search-and-registry.md) | Finder vs M1a vs M10 Patient Registry |
| [04-multi-doctor-clinic-model.md](./04-multi-doctor-clinic-model.md) | Shared pool, Take patient, All/Me filter (V1) |
| [05-advisory-routing-v11.md](./05-advisory-routing-v11.md) | Roster, Taking patients, load-based suggestions |
| [06-hard-assignment-notifications-v12.md](./06-hard-assignment-notifications-v12.md) | Opt-in hard assign + doctor-ready notify |
| [07-documentation-audit-gap-closure.md](./07-documentation-audit-gap-closure.md) | Design vs spec audit; gaps closed in PRD |
| [08-openemr-coverage-analysis.md](./08-openemr-coverage-analysis.md) | What OpenEMR areas are / are not covered |
| [09-niche-features-explained.md](./09-niche-features-explained.md) | EHI, BatchCom, de-ID, DICOM, chart tracker |
| [10-redesign-recommendations.md](./10-redesign-recommendations.md) | Whether to redesign niche features |
| [11-decisions-config-reference.md](./11-decisions-config-reference.md) | D-numbers, config keys, module map |
| [design-thread-conversation-summary.md](./design-thread-conversation-summary.md) | Executive summary of June 2026 design conversation |
| [new-clinic-development-session-summary.md](./new-clinic-development-session-summary.md) | Separate thread: implementation & E2E (June–July) |

## Quick orientation

- **Product:** Private OPD layer on OpenEMR — role desks, visit queue, cash checkout.
- **Market:** West Africa; V1 billing = cash only.
- **Module prefix:** `oe-module-new-clinic` (modules M0–M18 + COM + S1 + T1/T2).
- **At time of design-thread close:** Spec suite very broad; implementation tracked separately in scorecard and the July session summary.
