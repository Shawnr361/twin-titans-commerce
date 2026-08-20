#!/usr/bin/env bash
#
# Build locally and publish the artifact to the `deploy` branch.
#
# next build cannot run on Go54 (the LVE process limit kills it), so the build
# happens here and only the finished .next travels. `deploy` is an orphan
# branch rebuilt from scratch every release: one commit, no history, so the
# repo does not grow by ~2MB of build output per deploy.
#
# Usage:  bash scripts/release.sh
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO"

echo "==> building"
CHECKPOINT_DISABLE=1 npx next build

# A .next left behind by `next dev` has no BUILD_ID. Publishing one produces a
# server that 500s on every route, so refuse before it leaves the machine.
if [ ! -f .next/BUILD_ID ]; then
  echo "FATAL: .next/BUILD_ID missing - was this .next produced by 'next dev'?" >&2
  exit 1
fi
BUILD_ID="$(cat .next/BUILD_ID)"
echo "==> BUILD_ID $BUILD_ID"

if grep -rq "localhost:3400" .next/server 2>/dev/null; then
  echo "FATAL: localhost:3400 is baked into the build - check .env.production" >&2
  exit 1
fi

WT="$(mktemp -d)"
cleanup() { git worktree remove --force "$WT" >/dev/null 2>&1 || true; rm -rf "$WT"; }
trap cleanup EXIT

# A detached worktree keeps the main checkout untouched throughout.
git worktree add --detach "$WT" >/dev/null
(
  cd "$WT"
  git checkout -q --orphan deploy
  git rm -rqf . >/dev/null 2>&1 || true
  cp -a "$REPO/.next" .next
  git add -f .next
  git -c user.name="release" -c user.email="release@twintitanemporium.com" \
      commit -qm "build $BUILD_ID"
  git push -qf origin deploy
)
echo "==> pushed build $BUILD_ID to origin/deploy"
echo "    now run on the server:  bash ~/server-deploy.sh"
