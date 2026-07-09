#!/usr/bin/env bash
# SEC-7 fleet health check — scriptable, heartbeat-runnable. Ships STATUS only
# (never data). Exit non-zero if any check fails so the fleet monitor alerts.
# Usage: fleet-healthcheck.sh <hostname> [tls_port]
set -u
HOST="${1:-localhost}"; PORT="${2:-443}"; FAIL=0

# 1. TLS cert validity (>= 14 days remaining).
if command -v openssl >/dev/null; then
  END=$(echo | openssl s_client -servername "$HOST" -connect "$HOST:$PORT" 2>/dev/null | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)
  if [ -n "$END" ]; then
    SECS=$(( $(date -d "$END" +%s) - $(date +%s) ))
    DAYS=$(( SECS / 86400 ))
    if [ "$DAYS" -lt 14 ]; then echo "FAIL cert expires in ${DAYS}d"; FAIL=1; else echo "OK cert ${DAYS}d remaining"; fi
  else echo "FAIL cert unreadable"; FAIL=1; fi
fi

# 2. Tunnel up (Tailscale).
if command -v tailscale >/dev/null; then
  if tailscale status >/dev/null 2>&1; then echo "OK tunnel up"; else echo "FAIL tunnel down"; FAIL=1; fi
fi

# 3. Firewall: no public inbound except SSH (ufw).
if command -v ufw >/dev/null; then
  if ufw status | grep -qiE "80/tcp.*ALLOW.*Anywhere|443/tcp.*ALLOW.*Anywhere"; then
    echo "WARN public 80/443 open (public-exposure variant only)"; else echo "OK no public web inbound"; fi
fi

# 4. MySQL bound to localhost/tunnel (not 0.0.0.0).
if command -v ss >/dev/null; then
  if ss -ltn 2>/dev/null | grep -q ':3306' && ! ss -ltn | grep ':3306' | grep -q '0.0.0.0'; then
    echo "OK mysql not on 0.0.0.0"; elif ss -ltn | grep ':3306' | grep -q '0.0.0.0'; then
    echo "FAIL mysql listening on 0.0.0.0"; FAIL=1; fi
fi

exit $FAIL
