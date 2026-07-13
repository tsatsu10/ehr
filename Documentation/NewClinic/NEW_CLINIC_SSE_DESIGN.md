# New Clinic — Server-Sent Events for Queue Invalidation (SCALE-5.1)

**Status: DESIGN ONLY — not implemented.** Per the hardening plan, Phases 1–4 make polling
~10× cheaper (revision-token delta polls, bounded queries, config/counts caching, rate limits,
panic levers); this document evaluates whether SSE is worth the added operational surface, and
if so, exactly how it should be built. It is deliberately last: the plan's rule is "do not start
until Phases 1–4 exist" (they do, as of 2026-07-13), and even then, do not build until a real
clinic's poll volume actually justifies it (see §6).

## 1. What problem this solves (and doesn't)

Today, every open shell page/desk polls its queue/board endpoint on a timer (10–30 s, jittered,
paused when hidden, backed off on 429). SCALE-1.8 already made an *unchanged* poll cheap on the
wire (a client sending `known_revision` gets `{unchanged:true}` instead of the full payload), and
SCALE-3.3 made the *count* read itself cheap server-side (5 s cache). What polling still costs,
even when nothing changed, is:

- **N requests/interval** regardless of activity — a quiet overnight desk still polls every 30 s.
- **Latency to see a change** is bounded by the poll interval, not by when the change happened
  (a patient moved to `ready_for_doctor` at second 3 of a 30 s window isn't visible until the
  next tick).

SSE would collapse "N clients polling on a timer" into "1 cheap server-side check every ~2 s,
fanned out as tiny push events to however many clients are actually open" — the same shift
`respondQueue()` made for payload *size*, applied to poll *frequency*. It does **not** replace
the ajax data-fetch path: SSE would only tell a client "your revision changed, go re-fetch" — the
actual re-fetch still goes through the existing bounded, cached, rate-limited ajax action. This
matters for scope: SSE is a notification channel, not a data channel, so none of SCALE-1–4's
correctness/security work needs to be duplicated for it.

## 2. Design

### 2.1 Endpoint

`public/events.php` (new, alongside `ajax.php` and the bootstrap-free `health.php`) —
**streams `text/event-stream`, one facility-scoped connection per client.**

```
GET .../oe-module-new-clinic/public/events.php?site=default&channel=queue&facility_id=3
```

- `channel` selects which revision family to watch (`queue` = board + counts + the 5 desk
  queues share one revision namespace today via `QueueRevision::of()`'s per-payload hash; a v1
  SSE would need one channel per *distinct* revision, not one global one — see §2.3).
- Auth: **use the normal bootstrap** (`require_once __DIR__ . '/bootstrap.php'` → `globals.php`
  → session), unlike `health.php`. An unauthenticated push channel is a data-exposure risk (queue
  contents include patient names); `health.php`'s no-bootstrap pattern is for infrastructure
  status only, not clinical data, and does not apply here.
- **`session_write_close()` immediately after the auth/ACL check, before entering the streaming
  loop.** This is non-negotiable: PHP's default session handler holds an exclusive file lock for
  the life of the request (this is exactly what SCALE-1.1 works around for ordinary ajax
  requests), and an SSE connection can live for minutes. Without closing it, one open dashboard
  tab would serialize every other request from that same browser session — including that same
  user's own ajax polls on other desks.

### 2.2 Server-side loop

```php
while (!connection_aborted()) {
    $revision = /* cheap read, see below */;
    if ($revision !== $lastSent) {
        echo "event: queue_revision\ndata: " . json_encode(['revision' => $revision]) . "\n\n";
        @ob_flush(); @flush();
        $lastSent = $revision;
    }
    // Heartbeat comment every ~15s even with no change, so proxies/LBs don't
    // treat an idle-but-healthy connection as dead and the client's
    // EventSource reconnect timer doesn't fire spuriously.
    sleep(2);
}
```

This is a **poll loop that happens to live inside a long-held HTTP response** — it is not magic;
it still does DB/cache work every ~2 s, once per connection. The revision read must reuse
`CacheService` (SCALE-3.3): a 5 s counts-cache or a config-cache-style short TTL means many
concurrent SSE loops (multiple facilities, multiple channels) share the same cache hit instead of
each hammering the DB independently every 2 s. **Never call the full `getBoard()`/`getQueue()`
builders in this loop** — those are for the ajax re-fetch a client triggers *after* the push, not
for detecting whether a push is needed. A cheap, cacheable revision-only read must exist (or be
added) for each channel before that channel can go live.

### 2.3 What "revision" means for SSE specifically

`QueueRevision::of($payload)` hashes a *specific, fully-built payload* — it was designed for "did
this exact response change," not "did anything in this facility change." Reusing it as-is for the
SSE loop would mean the loop still builds the full board/queue payload every 2 s just to hash it —
defeating the entire cost argument for SSE. Before this can be built, a **cheap, monotonic
"something in this facility's operational state changed" signal** needs to exist — candidates,
cheapest first:

1. A single `updated_at` bump on `new_visit` (already present, `ON UPDATE CURRENT_TIMESTAMP`) —
   **but naively:** `SELECT MAX(updated_at) FROM new_visit WHERE facility_id = ?` is
   **NOT actually cheap as written**. `new_visit`'s indexes (`idx_facility_date_state`,
   `idx_queue_sort`) cover `facility_id` as a prefix but neither carries `updated_at`, so MySQL
   can only use `facility_id` to narrow the range and must then scan every matching row to find
   the max — and with no date bound, "every matching row" is the facility's **entire visit
   history since go-live**, growing unboundedly for the life of the clinic (exactly the R1
   unbounded-query pattern this hardening plan exists to prevent). Fixing this needs one of:
   (a) bound the query to a recent window, e.g. `AND visit_date >= CURDATE() - INTERVAL 1 DAY`
   (cheap, matches what a live queue actually cares about — nothing older is "current" queue
   state anyway), or (b) add a covering index, e.g. `KEY idx_facility_updated (facility_id,
   updated_at)`, which needs its own SCALE-task-sized change (new index = a migration, BP-9).
   Do not build option 1 without (a) at minimum; (b) is the more correct fix if this channel
   ships.
2. A dedicated `new_clinic_queue_touch (facility_id, channel, touched_at)` row, written by every
   mutation that would move a queue (visit state transitions, triage/doctor/lab/pharmacy/cashier
   actions) — more precise (per-channel), more invasive (every mutation site needs the touch), and
   is real new surface, not reuse.

Option 1 is the pragmatic v1 choice: it is a strict superset trigger (fires on cancels/edits too,
not just moves the client cares about), which means occasional "wake up and re-fetch, turned out
unchanged" — cheap and harmless given the client re-fetch is itself a `respondQueue()` delta poll
that will usually reply `{unchanged:true}` anyway. Do not build option 2 unless option 1's false-
positive rate is measured and shown to matter.

### 2.4 Client

```ts
// islands: replace the network-poll half of useInterval with EventSource when
// enable_sse is on and the browser supports it; keep useInterval as the
// unconditional fallback (unsupported browser, SSE connection drops, proxy
// strips text/event-stream).
const es = new EventSource(`${eventsUrl}?channel=queue&facility_id=${facilityId}`);
es.addEventListener('queue_revision', () => { void refetch(); });
es.onerror = () => { es.close(); /* fall back to useInterval at the normal pollMs */ };
```

- **`useInterval` stays** as the fallback path, unconditionally — this is the existing,
  proven, tested mechanism (jitter, hidden-tab pause, poll-backoff-on-429). SSE is additive: when
  healthy, raise the `useInterval` fallback interval to 60 s (still polling, just rarely — a
  safety net against a silently-dead EventSource that never fired `onerror`) instead of removing
  it.
- No change to `respondQueue()`, `QueueRevision`, or any ajax action — SSE only decides *when* to
  call the existing `oeFetch` re-fetch, never replaces it.

### 2.5 Config

`enable_sse` (facility + global, default **OFF**), read via `ClinicConfigService` (cached) and
resolved **at the request's actual facility, not the facility-0 default** — this is the normal
rule for governing flags (a documented gotcha: public bootstraps that skip facility resolution
make admin toggles silently not take effect); `enable_sse` is not a candidate for the narrow
`enable_react_*`-style global-only exception, since per-facility opt-in is exactly the rollout
control this flag needs to be useful (§3's worker-count math is a per-deployment, not
per-install, decision). OFF = today's `useInterval`-only behavior, byte-for-byte — no half-built
chrome, consistent with the PRD §5.6 invariant. `sse_channels` could gate which channels are
eligible (start with `queue` only; scheduling flow-board/calendar could follow once queue is
proven).

## 3. Apache/XAMPP worker-exhaustion caveat (the actual go/no-go gate)

**This box (Windows XAMPP) runs Apache's WinNT MPM** — confirmed via
`C:\xampp\apache\conf\extra\httpd-mpm.conf` (no `mpm_prefork`/`mpm_event` load line; WinNT MPM is
the only one built for Windows). WinNT MPM is a single multi-threaded process, default
`ThreadsPerChild = 150`. **Every open SSE connection holds one of those 150 threads for its
entire lifetime** — unlike an ordinary ajax request, which returns its thread in tens to hundreds
of milliseconds. A dashboard with SSE enabled and left open all day does not "poll every 30 s
using a shared pool of fast requests"; it **permanently removes one thread from the 150-thread
ceiling** for as long as the tab is open.

**Worker-count math (the go/no-go criterion):**

> N concurrently open SSE-subscribed browser tabs = N of the 150 threads held, continuously,
> for the whole shift — not per-request, per-connection.

A single-facility pilot clinic (PRD's target: reception + nurse + 1–3 doctors + lab + pharmacy +
cashier, one shift) realistically has **6–12 shell pages/tabs open at once**. That is a small
fraction of 150 and is safe. The danger is **multi-facility / multi-tenant deployment on one
Apache instance** (the market-expansion trajectory this module is explicitly built toward,
per `NEW_CLINIC_MARKET_EXPANSION_MASTER_PLAN.md`): 20 facilities × 10 open tabs = 200 held
threads, which **exceeds the default ceiling before counting a single ordinary ajax/page request**
— the server would refuse new connections, including logins, while every existing tab sits idle
holding its SSE thread.

**Decision rule:**

| Deployment shape | SSE verdict |
|---|---|
| Single facility, ≤ ~30 concurrently open tabs | Safe on default WinNT MPM/`ThreadsPerChild` — enable if the poll-cost measurement (§6) justifies it. |
| Multiple facilities behind one Apache/PHP instance, XAMPP/`mod_php` unchanged | **Do not enable.** Raise `ThreadsPerChild` and/or move to a worker model built for long-held connections first (below). |
| Any deployment, `enable_sse` flag flips per-facility | Compute `open_tabs_estimate × facilities_on_this_box` before flipping; keep well under `ThreadsPerChild`, leaving headroom for ordinary traffic. |

**The real fix, if SSE is ever needed at multi-facility scale, is not tuning `ThreadsPerChild`
upward** (that just moves the ceiling, and Windows/mod_php threads are not free) — it is one of:

1. **php-fpm + an event-driven Apache MPM** (Linux deployment target, per the scale-out runbook's
   1→N-server path) — a long-idle SSE connection held by an event-loop worker costs a socket, not
   a full worker slot, so the N-clients-per-thread problem mostly disappears. This is the
   deployment this module is already steering toward for scale-out (see runbook §0/§1); SSE
   should ride that migration, not precede it.
2. **A small relay process** (Node/Go) that holds the actual long-lived client connections and
   itself polls the module's cheap revision endpoint (or a lightweight internal API) — decouples
   "N browser tabs" from "N Apache/PHP threads" entirely. More moving parts; only worth it if (1)
   isn't available (e.g., staying on Windows/XAMPP in production, which the runbook already
   flags as non-ideal for scale-out).

**This box (XAMPP/Windows, `mod_php`, WinNT MPM) is explicitly the wrong target to enable SSE
on for anything beyond a single-facility pilot demo.** The gate for shipping SSE to a multi-
facility deployment is landing on (1) or (2) first.

## 4. Failure modes & devil-proofing (BP charter alignment)

| Failure | Behavior |
|---|---|
| Client's browser doesn't support `EventSource` | Fall back to `useInterval` at normal `pollMs` — never SSE-only. |
| SSE connection drops (network blip, proxy timeout, server restart) | `onerror` fires → client falls back to `useInterval`; `EventSource` auto-reconnects on its own timer (`retry:` field), but the app must not *rely* on that — treat every drop as "assume stale, poll normally until reconnected." |
| A misbehaving/stolen-session client opens many tabs | Same per-user session applies to each; no new auth surface (uses the real bootstrap+session, not a bypass). Consider a per-user open-SSE-connection cap (config, default e.g. 5) enforced at connect time via `CacheService`-backed counter, mirroring the `RateLimitService` pattern — **not built in v1**, add if abuse is observed. |
| `panic_readonly_mode` / `panic_poll_multiplier` incident levers | SSE is read-only by construction (never a mutation path), so `panic_readonly_mode` doesn't need to touch it. `panic_poll_multiplier` should still widen the *fallback* `useInterval` cadence (it already does, via `resolveQueuePollIntervalMs()`); document that flipping it does NOT close open SSE connections — an operator fighting a DB overload should also flip `enable_sse` off, which won't drop existing connections until they naturally reconnect/expire (v1 has no server-side kill switch for open streams — a future `sse_max_age_seconds` forcing periodic reconnect would let a config flip actually take effect promptly; **not built in v1**). |
| Apache/PHP restart / deploy | All open SSE connections drop simultaneously; every client falls back to `useInterval` until it reconnects. This is expected and safe — exactly the "assume stale, poll normally" behavior above — but worth calling out because it means a deploy briefly reverts everyone to polling cadence, which is fine. |
| Revision read itself is expensive or the cache is cold | Fails open to the existing behavior: if the cheap revision read errors, log and skip the push for that tick (client just gets that tick's `useInterval` fallback instead) — never let the SSE loop's own health become a new server-side failure mode. |

## 5. What this does NOT change

- No change to any ajax action, `AjaxActionPolicy`, `QueueRevision`, or `respondQueue()`.
- No change to `useInterval`'s poll-backoff/jitter/hidden-tab logic — SSE sits *above* it as an
  optional accelerant, never a replacement.
- No new database **tables** in v1 (Option 1 in §2.3 reuses `new_visit.updated_at`) — but see
  §2.3's fix note: a bounded query or a new covering index is still required before that reuse
  is actually cheap, so "no schema change at all" is not guaranteed.
- No change to session/ACL/CSRF handling — `events.php` uses the exact same bootstrap and auth
  gate as every other module public page.

## 6. Go/no-go: measure before building

Per the plan's Phase-1 framing, SSE is "the next order of magnitude" after polling is already
~10× cheaper. Before writing a line of `events.php`:

1. **Measure actual poll volume in a live pilot** (NC_PERF / the SCALE-4.5 perf panel already
   gives per-action call counts) — if `queue.counts`/desk-queue polls are a small fraction of
   total DB load post-Phase-1–4, SSE buys little and isn't worth the new operational surface
   (§3's worker math, §4's new failure modes).
2. **Confirm the deployment target for SSE is not XAMPP/Windows/`mod_php` multi-facility** (§3) —
   if it is, this doc's answer is "not yet," full stop, regardless of measured poll volume.
3. If both gates pass, implement `events.php` scoped to **one channel (`queue`) on **one
   surface** (visit board) first, behind `enable_sse` default OFF, and measure again before
   widening.

## History

| Version | Date | Change |
|---|---|---|
| 0.1.0 | 2026-07-13 | Initial design doc (SCALE-5.1) — design only, not implemented. |
| 0.1.1 | 2026-07-13 | Audit fix: §2.3's proposed `SELECT MAX(updated_at) FROM new_visit WHERE facility_id = ?` was not actually cheap as written — no existing index carries `updated_at`, and with no date bound it would scan a facility's entire visit history, growing unboundedly (the R1 anti-pattern this whole plan exists to prevent). Now specifies a required date bound or a new covering index before this option can be built. §2.5's `enable_sse` scoping guidance corrected — it previously implied all `enable_*` flags follow a "global-scope exception" convention; the verified convention is the opposite (facility-scoped resolution is the norm, `enable_react_*` is the sole deliberate global exception), and `enable_sse` should follow the norm. §5's "no schema change" bullet updated to not contradict the §2.3 fix. Apache MPM claim in §3 (WinNT MPM, `ThreadsPerChild=150`, `mod_php`) re-verified against `httpd.conf`'s actual `Include` chain and `LoadModule php_module` line — confirmed accurate, no change needed. |
