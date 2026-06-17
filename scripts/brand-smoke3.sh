#!/usr/bin/env bash
cd /root/pocer-v1; export TMPDIR=/tmp HOME=/root; unset TMPPREFIX
pkill -f "node dist/main.js" 2>/dev/null
node dist/main.js > /tmp/brand-smoke3-server.log 2>&1 &
SRV=$!
B=http://localhost:8080/api/v1
curl -s --retry 40 --retry-delay 1 --retry-connrefused -o /dev/null "$B/catalog/servers"
TOK=$(curl -s -X POST "$B/admin/auth/login" -H "Content-Type: application/json" -d '{"login":"budi","password":"rahasia123"}' | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
echo "login: ${TOK:+ok}"
echo "=== create brand ==="
CR=$(curl -s -X POST "$B/admin/brands" -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d '{"name":"CLD Test Brand"}'); echo "$CR"
BID=$(echo "$CR" | sed -n 's/.*"id":\([0-9]*\).*/\1/p' | head -1)
echo "=== rename brand $BID ==="
curl -s -X PATCH "$B/admin/brands/$BID" -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d '{"name":"CLD Renamed","slug":"cld-renamed"}'; echo
echo "=== brands now ==="
curl -s "$B/admin/brands" -H "Authorization: Bearer $TOK" | python3 -c 'import sys,json;[print(b["id"],b["name"],b["slug"]) for b in json.load(sys.stdin)]'
echo "=== outlet KORLEKO(1) brand1 -> brand2, verify, then revert ==="
curl -s -X PATCH "$B/admin/outlets/1" -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d '{"brandId":2}' >/dev/null
curl -s "$B/admin/outlets" -H "Authorization: Bearer $TOK" | python3 -c 'import sys,json;o=next(x for x in json.load(sys.stdin) if x["id"]==1);print("after move: KORLEKO brandId=",o.get("brandId"))'
curl -s -X PATCH "$B/admin/outlets/1" -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d '{"brandId":1}' >/dev/null
curl -s "$B/admin/outlets" -H "Authorization: Bearer $TOK" | python3 -c 'import sys,json;o=next(x for x in json.load(sys.stdin) if x["id"]==1);print("reverted: KORLEKO brandId=",o.get("brandId"))'
kill $SRV 2>/dev/null
echo "=== done ==="
