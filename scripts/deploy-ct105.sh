#!/usr/bin/env bash
# Release the host working tree → CT105 staging, then rebuild + restart (pm2).
# Run on the Proxmox host. Usage:
#   ./scripts/deploy-ct105.sh            # deploy everything
#   ./scripts/deploy-ct105.sh backend    # only the API
#   ./scripts/deploy-ct105.sh web-admin  # only one app (web | web-admin | web-agent)
#
# Source-only sync: the tarball EXCLUDES node_modules/.next/dist/.git/.env*, so the
# CT's secrets (.env) and installed deps are preserved; only source is updated.
set -euo pipefail
CTID=105
TARGET="${1:-all}"

CTEX() {
  pct exec "$CTID" -- env -i HOME=/root \
    PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin \
    TMPDIR=/tmp NODE_OPTIONS=--max-old-space-size=2048 bash -c "$1"
}

echo "[1/4] packaging host source…"
tar czf /tmp/vp-deploy.tar.gz -C /root \
  --exclude=node_modules --exclude=.next --exclude=dist --exclude=.git \
  --exclude='*.tar.gz' --exclude=.env --exclude=.env.local \
  --exclude='pocer-v1/web-internal' \
  pocer-v1

echo "[2/4] pushing to CT$CTID + extracting (keeps .env & node_modules)…"
pct push "$CTID" /tmp/vp-deploy.tar.gz /tmp/vp-deploy.tar.gz
rm -f /tmp/vp-deploy.tar.gz
CTEX 'tar xzf /tmp/vp-deploy.tar.gz -C /opt && rm -f /tmp/vp-deploy.tar.gz'

build_backend() {
  echo "  → backend: install + prisma + build + restart"
  CTEX 'cd /opt/pocer-v1 && npm install --no-audit --no-fund >/dev/null 2>&1 \
        && npx prisma generate >/dev/null 2>&1 \
        && npx prisma db push --skip-generate >/dev/null 2>&1 \
        && npx nest build'
  CTEX 'pm2 restart vp-backend --update-env >/dev/null 2>&1'
}
build_front() { # $1=dir $2=pm2name
  echo "  → $2: install + build + restart"
  CTEX "cd /opt/pocer-v1/$1 && npm install --no-audit --no-fund >/dev/null 2>&1 && npm run build >/dev/null 2>&1"
  CTEX "pm2 restart $2 >/dev/null 2>&1"
}

echo "[3/4] building ($TARGET)…"
case "$TARGET" in
  all)       build_backend; build_front web vp-web; build_front web-admin vp-admin; build_front web-agent vp-agent ;;
  backend)   build_backend ;;
  web)       build_front web vp-web ;;
  web-admin) build_front web-admin vp-admin ;;
  web-agent) build_front web-agent vp-agent ;;
  *) echo "unknown target '$TARGET' (use: all|backend|web|web-admin|web-agent)"; exit 1 ;;
esac

echo "[4/4] health:"
CTEX 'curl -s -o /dev/null -w "  backend: %{http_code}\n" http://localhost:8080/api/v1/catalog/servers'
echo "✓ released to CT$CTID ($TARGET)"
