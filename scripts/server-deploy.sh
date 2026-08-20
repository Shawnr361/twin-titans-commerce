#!/bin/bash
#
# Pull the latest artifact and swap it in. Runs ON the Go54 host.
#
# Order matters and is the product of several broken deploys:
#   stage -> verify BUILD_ID -> swap -> restart -> keep the old tree
# Deleting the previous .next while a worker is still serving from it causes
# random 500s, so .next-prev is left in place for the next run to clear.
set -uo pipefail

REPO="$HOME/deploy-repo"
APP="$HOME/store"
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/id_ed25519_deploy -o IdentitiesOnly=yes"

cd "$REPO" || { echo "FATAL: $REPO missing"; exit 1; }

echo "==> fetching"
git fetch --depth 1 origin deploy || { echo "FATAL: fetch failed"; exit 1; }
git reset --hard -q FETCH_HEAD || { echo "FATAL: reset failed"; exit 1; }

NEW_ID="$(cat "$REPO/.next/BUILD_ID" 2>/dev/null)"
CUR_ID="$(cat "$APP/.next/BUILD_ID" 2>/dev/null || echo none)"
[ -n "$NEW_ID" ] || { echo "FATAL: fetched tree has no BUILD_ID"; exit 1; }
echo "    current: $CUR_ID"
echo "    incoming: $NEW_ID"
if [ "$NEW_ID" = "$CUR_ID" ]; then echo "==> already live, nothing to do"; exit 0; fi

echo "==> staging"
rm -rf "$APP/.next-new"
cp -a "$REPO/.next" "$APP/.next-new"
[ -f "$APP/.next-new/BUILD_ID" ] || { echo "FATAL: staging incomplete"; rm -rf "$APP/.next-new"; exit 1; }

echo "==> swapping"
rm -rf "$APP/.next-prev"
mv "$APP/.next" "$APP/.next-prev"
mv "$APP/.next-new" "$APP/.next"

# Orphaned Prisma engines starve the worker: DB-touching routes hang while
# static assets keep serving. Clear them before the app comes back up.
pkill -f query-engine >/dev/null 2>&1
pkill -f "next start" >/dev/null 2>&1

mkdir -p "$APP/tmp"
touch "$APP/tmp/restart.txt"

echo "==> live: $(cat "$APP/.next/BUILD_ID")  rollback: $(cat "$APP/.next-prev/BUILD_ID")"
echo "    Passenger respawns on the next request; the first one is slow."
