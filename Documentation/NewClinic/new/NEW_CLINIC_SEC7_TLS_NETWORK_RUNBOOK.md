# SEC-7 — TLS & Network Access (Runbook)

| Field | Value |
|-------|-------|
| **Document version** | 1.0.0 |
| **Status** | Deploy-time runbook — pairs with the VPS replica prompt's server-setup pass |
| **Owner** | Engineering (deployment) |
| **Applies to** | On-prem box (primary), VPS read-replica, opt-in VPS-primary |

## 0. Posture in one line

**Default = tunnel-only.** Bots never reach the login page, so brute-force and
CVE exposure both drop to near-zero. Public exposure is an explicit per-clinic
opt-in with its own hardening. Both flavors are HTTPS-only — no plaintext HTTP on
clinic Wi-Fi, ever.

## 1. Default: tunnel-only (recommended for every clinic)

1. **Tailscale/WireGuard** on the clinic box and every admin device. Apache
   `Listen` bound to the **tunnel interface only** (e.g. `Listen 100.x.y.z:443`),
   not `0.0.0.0`.
2. **Firewall (ufw):** deny all public inbound; allow only key-only SSH (ideally
   tunnel-only too) and nothing on 80/443 from the public internet.
   `ufw default deny incoming; ufw allow in on tailscale0; ufw allow 22/tcp`
3. **TLS inside the tunnel:** Tailscale cert (`tailscale cert`) or an internal CA.
   Document which, and complete the **clinic written-consent step (§7.3)** before
   go-live.
4. Because there is no public listener, HSTS/LE are not required here.

## 2. Public-exposure variant (explicit opt-in only)

1. `apache-openemr-tls.conf`: Let's Encrypt cert, **80→443 redirect**, **HSTS**
   (enable only after HTTPS verified), **TLS 1.2+** strong ciphers.
2. **Auto-renew** with a renewal-failure alert into fleet monitoring
   (`certbot renew --deploy-hook` → post status to the fleet endpoint).
3. **fail2ban assumed** (SEC-5 `scripts/deploy/fail2ban/`).

## 3. Both flavors

- **Session cookies (verified in core):** `SameSite=Strict` (CSRF defense) is on.
  `HttpOnly=false` is a deliberate core design choice (its JS reads the cookie) —
  not patched here; the tunnel/HTTPS-only transport + CSP are the mitigations. The
  `Secure` flag is enforced at the transport layer (HTTPS-only) and via
  `php-production.ini` `session.cookie_secure=1`.
- **phpMyAdmin:** absent in production, or tunnel-only. Never public.
- **MySQL:** `bind-address = 127.0.0.1` (or the tunnel IP). Never `0.0.0.0`.
- **Unattended security updates** on (`unattended-upgrades` / `dnf-automatic`).

## 4. On-prem mini-PC flavor

Same pattern; TLS via **mkcert / self-signed local CA**. Document the per-OS
**browser-trust step** so staff devices trust the clinic cert (no plaintext
fallback on the clinic LAN).

## 5. Fleet checklist (scriptable — `scripts/deploy/fleet-healthcheck.sh`)

Heartbeat-runnable, ships **status only**: cert validity (≥14d), tunnel up,
firewall as-specified, MySQL not on `0.0.0.0`. Non-zero exit → fleet alert.

## 6. Outage Runbook additions

- **Cert expired:** symptoms (browser TLS error / healthcheck FAIL) → renew
  (`certbot renew` or `tailscale cert`), reload Apache, re-run healthcheck.
- **Tunnel down:** clinic can't reach the system → check Tailscale on box + device,
  `tailscale up`; if the box is up but tunnel is down, on-prem LAN access is the
  fallback (on-prem flavor only).
- **VPS-primary has NO offline mode.** Internet down = system down. The fallback
  is **paper**, then back-entry once restored — state this explicitly in the
  clinic's onboarding and keep the paper forms + back-entry procedure to hand.
