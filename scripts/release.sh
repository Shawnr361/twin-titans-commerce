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

# The bookmarklet is a string inside a template literal, so nothing type-checks
# its contents. Prove it still parses before it can reach a build.
echo "==> verifying capture bookmarklet"
npx tsx scripts/emit-bookmarklet.ts

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
# A throwaway local branch name per run: reusing a fixed one leaves a branch
# behind after the worktree is torn down, and the next release collides with it.
TMP_BRANCH="release-tmp-$$"
cleanup() {
  git worktree remove --force "$WT" >/dev/null 2>&1 || true
  git branch -D "$TMP_BRANCH" >/dev/null 2>&1 || true
  rm -rf "$WT"
}
trap cleanup EXIT

# A detached worktree keeps the main checkout untouched throughout.
git worktree add --detach "$WT" >/dev/null
(
  cd "$WT"
  git checkout -q --orphan "$TMP_BRANCH"
  git rm -rqf . >/dev/null 2>&1 || true
  cp -a "$REPO/.next" .next

  # ------------------------------------------------------------------------
  # The generated Prisma client, and the schema it was generated from.
  #
  # Next EXTERNALISES @prisma/client — it stays a runtime require() so it can
  # load its binary engine — so the client is NOT bundled into .next. Shipping
  # only .next therefore cannot carry a schema change: the server keeps calling
  # an older generated client, and any new model comes back undefined, which
  # surfaces as "Application error" on the pages that use it. That is exactly
  # how the Subscriber and Review models shipped broken.
  #
  # The engines are excluded deliberately. They are ~21MB each, they are
  # platform-specific (the local ones are Windows and useless on the server),
  # and the server's Linux engine is pinned by PRISMA_QUERY_ENGINE_BINARY in
  # .env. Only the generated JavaScript and the datamodel travel.
  # ------------------------------------------------------------------------
  mkdir -p prisma prisma-client
  cp "$REPO/prisma/schema.prisma" prisma/schema.prisma
  for f in "$REPO"/node_modules/.prisma/client/*; do
    base="$(basename "$f")"
    case "$base" in
      query_engine-*|*.node|*.node.tmp*|*.wasm) continue ;;
    esac
    [ -f "$f" ] && cp "$f" "prisma-client/$base"
  done

  # .next/cache is build-time only and enormous - the webpack server pack alone
  # is ~59MB, past GitHub's file-size warning. The tarball deploys always
  # excluded it; publishing it here was an oversight that bloats every release.
  rm -rf .next/cache

  # Nothing in a legitimate .next should approach this. If something does, it
  # is almost certainly cache-like and should not be shipped.
  BIG="$(find .next -type f -size +45M -print -quit)"
  if [ -n "$BIG" ]; then
    echo "FATAL: oversized file in artifact: $BIG" >&2
    exit 1
  fi

  git add -f .next prisma prisma-client
  git -c user.name="release" -c user.email="release@twintitanemporium.com" \
      commit -qm "build $BUILD_ID"
  git push -qf origin "HEAD:deploy"
)
echo "==> pushed build $BUILD_ID to origin/deploy"
echo "    now run on the server:  bash ~/server-deploy.sh"
