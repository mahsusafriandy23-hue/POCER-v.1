#!/usr/bin/env bash
cd /root/pocer-v1; export TMPDIR=/tmp HOME=/root; unset TMPPREFIX
pkill -f "node dist/main.js" 2>/dev/null
node dist/main.js > /tmp/brand-smoke2-server.log 2>&1 &
SRV=$!
B=http://localhost:8080/api/v1
curl -s --retry 40 --retry-delay 1 --retry-connrefused -o /dev/null "$B/catalog/servers"
TOK=$(curl -s -X POST "$B/admin/auth/login" -H "Content-Type: application/json" -d '{"login":"budi","password":"rahasia123"}' | sed -n 's/.*"accessToken":"\([^"]*\)".*/\1/p')
echo "login: ${TOK:+ok}"
echo "=== outlets w/ brandId ==="
OUT=$(curl -s "$B/admin/outlets" -H "Authorization: Bearer $TOK"); echo "$OUT" | head -c 500; echo
B1=$(echo "$OUT" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(next((o["id"] for o in d if o.get("brandId")==1), ""))')
B2=$(echo "$OUT" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(next((o["id"] for o in d if o.get("brandId")==2), ""))')
echo "outlet brand1=$B1  outlet brand2=$B2"
echo "=== create agent in brand 1 with its outlet → expect ok ==="
PH="0899$RANDOM$RANDOM"
CR=$(curl -s -X POST "$B/admin/agents" -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d "{\"name\":\"CLD Test Agen\",\"phone\":\"$PH\",\"password\":\"rahasia123\",\"brandId\":1,\"serverIds\":[$B1]}")
echo "$CR"
AID=$(echo "$CR" | sed -n 's/.*"id":\([0-9]*\).*/\1/p' | head -1)
echo "agent id=$AID"
echo "=== assign brand-2 outlet to brand-1 agent → expect 403 ==="
curl -s -X POST "$B/admin/agents/$AID/outlets" -H "Authorization: Bearer $TOK" -H "Content-Type: application/json" -d "{\"serverIds\":[$B2]}"; echo
echo "=== agent list: brand shown ==="
curl -s "$B/admin/agents" -H "Authorization: Bearer $TOK" | python3 -c 'import sys,json; [print(a["id"],a["name"],"brand=",a.get("brand")) for a in json.load(sys.stdin)]'
kill $SRV 2>/dev/null
echo "=== done ==="
