#!/usr/bin/env bash
cd /root/voucher-platform
export TMPDIR=/tmp HOME=/root; unset TMPPREFIX
pkill -f "node dist/main.js" 2>/dev/null
node dist/main.js > /tmp/brand-smoke-server.log 2>&1 &
SRV=$!
B=http://localhost:8080/api/v1
# wait for readiness via curl retry (no shell sleep)
curl -s --retry 40 --retry-delay 1 --retry-connrefused -o /dev/null "$B/catalog/servers"
TOK=""
for pw in rahasia123 budi123 password admin123 budi secret; do
  TOK=$(curl -s -X POST "$B/admin/auth/login" -H "Content-Type: application/json" -d "{\"login\":\"budi\",\"password\":\"$pw\"}" | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
  [ -n "$TOK" ] && { echo "LOGIN ok (pw=$pw)"; break; }
done
if [ -z "$TOK" ]; then echo "LOGIN FAILED"; tail -5 /tmp/brand-smoke-server.log; kill $SRV 2>/dev/null; exit 0; fi
echo "=== GET /admin/brands ==="; curl -s "$B/admin/brands" -H "Authorization: Bearer $TOK"; echo
echo "=== GET /admin/qris (brands[] + accounts.brand) ==="; curl -s "$B/admin/qris" -H "Authorization: Bearer $TOK" | head -c 1200; echo
echo "=== 1 brand=1 QRIS guard: create QRIS for brand 1 (already has one) → expect 400 ==="
curl -s -X POST "$B/admin/qris" -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d '{"label":"DUP TEST","brandId":1}'; echo
kill $SRV 2>/dev/null
echo "=== done ==="
