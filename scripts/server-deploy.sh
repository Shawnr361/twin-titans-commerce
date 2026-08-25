#!/bin/bash
#
# Pull the latest artifact and swap it in. Runs ON the Go54 host.
#
# WHY THIS IS SO DEFENSIVE
# ------------------------
# An earlier version of this script reported four successful deploys that never
# happened. On this host the account's LVE process cap gets exhausted, and when
# it does, every external binary — cp, mv, rm, cat, git — fails to fork. `echo`
# is a bash builtin and needs no fork, so the script cheerfully printed
# "==> swapping" and "==> live: <new id>" while nothing moved. The site served
# a two-day-old build and every check I ran against the script's own output
# agreed it was fine.
#
# Two rules came out of that, and they are the whole design here:
#   1. set -e, so a failed command stops the deploy instead of being narrated.
#   2. Never report success from an echo. Read the state back off disk and
#      compare it to what was intended, and exit non-zero when they disagree.
set -euo pipefail

REPO="$HOME/deploy-repo"
APP="$HOME/store"
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/id_ed25519_deploy -o IdentitiesOnly=yes"

fail() { echo "FATAL: $*" >&2; exit 1; }

# Pre-flight: prove we can fork before touching anything. Without this the
# deploy gets half-applied — which is worse than not starting.
/bin/true 2>/dev/null || fail "cannot fork a process (LVE cap). Stop the app in
  DirectAdmin > Setup Node.js App to free slots, then run this again. Nothing
  has been changed."
[ -d "$REPO" ] || fail "$REPO missing"
[ -d "$APP" ] || fail "$APP missing"

echo "==> fetching"
cd "$REPO"
# pack.threads=1 is not a tuning choice, it is the fix.
#
# git resolves deltas with worker threads, and on CloudLinux those threads count
# against the account's LVE process cap. Once the cap is tight, index-pack dies
# with "unable to create thread: Resource temporarily unavailable" AFTER the
# objects have downloaded — so the fetch looks like it worked right up until it
# doesn't. This single-threaded it and the deploy went through immediately on a
# host where it had failed four times running.
#
# Also set globally on the host (git config --global pack.threads 1); repeated
# here so a fresh checkout of this repo carries the fix with it.
git -c pack.threads=1 -c core.preloadIndex=false fetch --depth 1 origin deploy
git reset --hard -q FETCH_HEAD

NEW_ID="$(cat "$REPO/.next/BUILD_ID")"
CUR_ID="$(cat "$APP/.next/BUILD_ID" 2>/dev/null || echo none)"
[ -n "$NEW_ID" ] || fail "fetched tree has no BUILD_ID"
echo "    current:  $CUR_ID"
echo "    incoming: $NEW_ID"
[ "$NEW_ID" != "$CUR_ID" ] || { echo "==> already live, nothing to do"; exit 0; }

echo "==> staging"
rm -rf "$APP/.next-new"
cp -a "$REPO/.next" "$APP/.next-new"
STAGED_ID="$(cat "$APP/.next-new/BUILD_ID")"
[ "$STAGED_ID" = "$NEW_ID" ] || fail "staged tree is $STAGED_ID, expected $NEW_ID"

echo "==> swapping"
rm -rf "$APP/.next-prev"
[ ! -e "$APP/.next-prev" ] || fail "could not clear .next-prev"
if [ -e "$APP/.next" ]; then
  mv "$APP/.next" "$APP/.next-prev"
  [ ! -e "$APP/.next" ] || fail "could not move the old .next aside"
fi
mv "$APP/.next-new" "$APP/.next"

# The check that would have caught all four silent failures.
LIVE_ID="$(cat "$APP/.next/BUILD_ID")"
[ "$LIVE_ID" = "$NEW_ID" ] || fail "swap did not take: .next is $LIVE_ID, expected $NEW_ID"

# Orphaned Prisma engines starve the worker: DB-touching routes hang while
# static assets keep serving. Clear them before the app comes back up.
pkill -f query-engine >/dev/null 2>&1 || true
pkill -f "next start" >/dev/null 2>&1 || true

mkdir -p "$APP/tmp"
touch "$APP/tmp/restart.txt"

echo "==> VERIFIED live: $LIVE_ID  (rollback: $(cat "$APP/.next-prev/BUILD_ID" 2>/dev/null || echo none))"
echo "    Passenger respawns on the next request; the first one is slow."
