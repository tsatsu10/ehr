# New Clinic — Outage Runbook (per-deployment)

**Version:** 1.1.0
**Date:** 2026-07-18
**Audience:** the clinic manager / lead nurse on the floor, and our pilot lead who trains them.
This is the "what do we do when something goes down" card. Print it and tape it near the front
desk. Fill in the blanks marked `[…]` for this specific clinic during setup.
**Companion docs (technical, not for the front desk):**
`NEW_CLINIC_SCALE_OUT_RUNBOOK.md` (server ops), `NEW_CLINIC_SEC7_TLS_NETWORK_RUNBOOK.md`
(network/TLS), `NEW_CLINIC_VPS_REPLICA_DEPLOYMENT_PROMPT.md` (replica setup).

---

## 0. First: which kind of install is this? (decides everything below)

| | **On-premise** (the default) | **VPS-primary** (opt-in, reliable-internet sites only) |
|---|---|---|
| Where the system runs | A small server (mini-PC) **inside the clinic**, on a UPS | A rented server **on the internet** |
| Desks connect over | The clinic's **local network** (LAN/WiFi) | The **internet** |
| Internet goes down → | **Clinic keeps working.** Only SMS, any cloud-synced off-site backup copy, and the owner's remote reports pause. | **System is down.** Go straight to the paper fallback (§4). |
| The real enemy is | **Power** (§2) and **server hardware** (§4) | **Internet** (§5) and power |

**This clinic is:** `[ on-premise / VPS-primary ]` ← circle one at setup.

If you don't know, it's almost certainly **on-premise** — that's the default we ship, precisely
so an internet outage never stops the clinic.

---

## 1. What keeps working vs. what stops — at a glance

| When this goes down… | Desks (check-in, triage, doctor, lab, pharmacy, cashier) | SMS reminders | Off-site backup | Owner's remote reports |
|---|---|---|---|---|
| **Internet** (on-prem install) | ✅ keep working on the local network | ⏸ pause, resume on reconnect | ⏸ catches up on reconnect | ⏸ stale until reconnect |
| **Internet** (VPS install) | ❌ down — use paper (§4/§5) | ⏸ | n/a | ❌ |
| **Power** (until UPS drains) | ✅ keep working — **finish and save open work now** (§2) | depends on router power | ⏸ | depends |
| **Power** (UPS drained / server off) | ❌ — use paper (§4) | ❌ | ❌ | ❌ |
| **The server itself** (hardware/DB failure) | ❌ — use paper (§4), call support | ❌ | ❌ | ❌ |
| **One desk's device** (its WiFi/network drops) | ❌ *that one device only* — others fine; move to another device or paper for that station | ✅ | ✅ | ✅ |

The single most important line: **on an on-premise install, an internet outage is not an
emergency.** Tell staff to keep working normally. Only the things that need the outside world
(text messages, off-site backup, the owner checking reports from home) wait for the internet to
come back — and they catch up on their own.

---

## 2. Power outage

- **UPS holds the server for `[ __ ]` minutes** (sized at setup — target: long enough to either
  ride out a typical cut or shut down cleanly; `[record the model + tested runtime here]`).
- When the power drops and the UPS beeps:
  1. Keep serving patients — the server is fine for now.
  2. **Save/submit anything half-entered** (a payment, a triage form) — don't leave it open.
  3. If power isn't back and the UPS is near empty, **shut the server down cleanly** (don't let
     it die on a dead battery — that's how databases corrupt). `[who does this: __ ]`.
  4. Once the server is off, switch to **paper (§4)**.
- **Routers/WiFi access points should be on the UPS too** — a running server no desk can reach
  is no better than a dead one. `[confirm at setup: __ ]`.

## 3. Internet outage — on-premise install (the common, calm case)

Nothing on the clinic floor changes. Say to staff: *"Internet's down, keep working normally."*

- Registration, queue, doctor notes, lab, pharmacy, cashier, printing — **all work** (they run
  on the local network, not the internet).
- What quietly pauses and **fixes itself when the internet returns**:
  - **SMS reminders/receipts** — queued, sent on reconnect.
  - **Off-site backup copy, if this clinic has one set up** — backups are always encrypted and
    written to disk **locally** first, whether the internet is up or not. Getting a copy **off the
    building** (the part that actually protects you if the server itself is lost — fire, theft,
    hardware death) depends on what your IT partner configured at setup: usually a cloud-sync
    folder (Google Drive/OneDrive/Dropbox desktop app) or a USB drive someone rotates off-site by
    hand. **There is no automatic copy to a vendor server that "catches up" for you** — a
    cloud-sync folder resumes uploading on its own once the internet is back (like any file in
    that folder would); a USB drive needs a person to actually take it off-site. Ask your pilot
    lead which one this clinic uses. `[ off-site method for this clinic: __ ]`.
  - **Owner's remote reports** — the read-only copy the owner sees from home is frozen until the
    link is back; the clinic's own numbers are live and correct the whole time.
- **Do NOT** restart the server or "try to fix the internet" from the server — you'll only risk
  the thing that's working. The internet coming back is the whole fix.

## 4. Server dead, or power gone past the UPS — the paper fallback

This is the "server is unreachable for a while" plan. It applies to **both** install types.

1. **Switch to paper** for: patient name + phone, reason for visit, vitals, what the doctor did,
   what was dispensed, and **every payment (amount + method: cash / MoMo ref)**. Keep a simple
   numbered log so nothing is lost. `[paper forms location: __ ]`.
2. **Cash is the priority record.** Every payment on paper, with the method and any MoMo
   reference — this is what gets reconciled later and what the clinic can't afford to lose.
3. **Call support:** `[ support number / WhatsApp: __ ]`. Tell them "server unreachable" and
   whether it's power or the machine itself.
4. **Same-day back-entry:** as soon as the system is back, a named person re-enters the paper
   records **the same day** while memory is fresh — patients, visits, and especially payments,
   which the cashier reconciles against the paper cash log. `[who back-enters: __ ]`.
5. Don't send patients away for records reasons — the clinic ran on paper before us; a few hours
   on paper with same-day re-entry is a normal degraded day, not a shutdown.

## 5. VPS-primary install only — internet down = system down

If this clinic was set up VPS-primary (opt-in, only where internet is genuinely reliable), you
were told in writing there is **no offline mode**. So:

- The moment the internet drops, the desks can't reach the system. **Go straight to the paper
  fallback (§4) — do not wait.**
- The paper-fallback + same-day back-entry drill is **mandatory training** for this flavor, not a
  nice-to-have.
- If internet outages happen more than rarely here, that's a signal this clinic should have been
  **on-premise** — raise it with your pilot lead; switching the posture is a supported change.

## 6. Coming back up — the recovery checklist

Whoever brings the server back (after power/hardware/internet is restored) confirms, in order:

1. **The app loads and a desk opens.** Log in, open the Visit Board — today's visits render.
2. **The health check is green.** Open `…/oe-module-new-clinic/public/health.php?site=[site]` —
   it should say `"ok": true`. (Technical helpers: `worker_last_seen` should update within ~10
   minutes — if it stays `null`, the background job worker didn't restart; see the scale-out
   runbook §1.3.)
3. **The backup is current:** Admin Hub → System → Performance/Backups shows a recent successful
   run. If this clinic uses a cloud-sync folder for off-site copies, also glance at that folder's
   own sync status (its icon/tray app) to confirm it resumed uploading after the outage — the
   New Clinic system itself only knows the local encrypted file was written; it does not track
   whether your cloud-sync app finished uploading it. A backup that silently stopped is the
   dangerous kind.
4. **Back-enter the paper records** (§4) the same day, reconcile the cash log.

## 7. Who does what (fill in at setup)

| Role | During an outage |
|---|---|
| Front desk | Starts the paper log, keeps registering patients |
| Cashier | Every payment on paper with method + MoMo ref; reconciles on recovery |
| `[ server person ]` | Clean shutdown on low UPS; brings the box back; runs the §6 checklist |
| Pilot lead / support | `[ contact ]` — called on "server unreachable" |

---

## What this runbook is NOT

It is **not** an offline app. On the default on-premise install you don't need one — the server
is in the building and stays reachable through internet cuts. Building browser-side offline sync
(a desk that keeps taking check-ins with no server and merges later) was **deliberately ruled
out for V1**: merging queued check-ins and especially payments against a server that also moved
is exactly the kind of conflict you must never risk on cash and clinical data. An *append-only
offline capture* app (register/queue only, no two-way merge) is a possible **V2** and needs a PRD
amendment before anyone builds it. Until then, the paper fallback in §4 **is** the offline mode,
and it's a good one.

## History

| Version | Date | Change |
|---|---|---|
| 1.1.0 | 2026-07-18 | **BACKUP-DOCS truth pass (wave 4).** §1/§3/§6 no longer claim "a nightly encrypted copy to our server catches up automatically" — no such automatic off-site vendor-server pipeline exists in code. Corrected to the real mechanism: backups are always encrypted locally first; getting a copy off the building depends on what was configured at setup — a cloud-sync folder (resumes on its own once the internet is back) or a USB drive (needs a person to rotate it off-site by hand). Automatic off-site replication to a vendor server is now tracked as a named future task, **BACKUP-OFFSITE**, not claimed as built (see `NEW_CLINIC_BACKUP_SYSTEM_DESIGN.md` §5f). |
| 1.0.0 | 2026-07-13 | Initial per-deployment Outage Runbook (market plan §3.0 W1 pilot-pack deliverable). Written after the scaling review's "offline" finding was re-grounded in the decided on-prem hosting posture — the real gap was this written drill, not an offline app. |
