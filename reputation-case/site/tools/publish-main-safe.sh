#!/usr/bin/env bash
set -euo pipefail

# Stable publisher for this repo:
# - clears stale lock files safely
# - avoids half-finished git states
# - rebases/merges with low-risk defaults
# - rebuilds generated assets before push
#
# Usage:
#   ./reputation-case/site/tools/publish-main-safe.sh
#   ./reputation-case/site/tools/publish-main-safe.sh --dry-run
#   ./reputation-case/site/tools/publish-main-safe.sh --no-build

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

DRY_RUN=0
NO_BUILD=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --no-build)
      NO_BUILD=1
      shift
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

has_changes() {
  ! git diff --quiet || ! git diff --cached --quiet || [[ -n "$(git ls-files --others --exclude-standard)" ]]
}

cleanup_stale_lock() {
  local lock_file="$1"
  [[ -f "$lock_file" ]] || return 0

  if lsof "$lock_file" >/dev/null 2>&1; then
    echo "Active lock detected: $lock_file" >&2
    echo "Another git process is still running. Wait for completion and retry." >&2
    exit 1
  fi

  rm -f "$lock_file"
}

abort_inflight_state_if_any() {
  # Abort known in-flight states when possible.
  if [[ -d .git/rebase-merge || -d .git/rebase-apply ]]; then
    git rebase --abort || true
  fi
  if [[ -f .git/MERGE_HEAD ]]; then
    git merge --abort || true
  fi
  if [[ -f .git/CHERRY_PICK_HEAD ]]; then
    git cherry-pick --abort || true
  fi

  # Drop stale REBASE_HEAD that can survive interrupted sessions.
  if git rev-parse --verify REBASE_HEAD >/dev/null 2>&1; then
    git update-ref -d REBASE_HEAD || true
  fi
}

echo "==> Preflight: cleaning stale git locks"
cleanup_stale_lock ".git/index.lock"
cleanup_stale_lock ".git/ORIG_HEAD.lock"
cleanup_stale_lock ".git/REBASE_HEAD.lock"
cleanup_stale_lock ".git/HEAD.lock"
for f in .git/index.stash.*.lock; do
  [[ -e "$f" ]] || continue
  cleanup_stale_lock "$f"
done

echo "==> Preflight: clearing half-finished git states"
abort_inflight_state_if_any

if has_changes; then
  echo "==> Committing current workspace snapshot"
  git add -A
  git commit -m "chore(site): checkpoint before safe publish"
fi

echo "==> Fetching origin"
git fetch origin

if ! git merge-base --is-ancestor origin/main HEAD; then
  echo "==> Integrating origin/main (no rename detection, keep local resolution)"
  echo "    Note: this may take minutes on large generated trees. Do not interrupt."
  git -c merge.renames=false merge --no-edit --no-ff -X ours origin/main
fi

if [[ "$NO_BUILD" -eq 0 ]]; then
  MAX_PASSES=3
  PASS=1
  while [[ "$PASS" -le "$MAX_PASSES" ]]; do
    echo "==> Rebuilding generated assets (pass ${PASS}/${MAX_PASSES})"
    BUILD_ENV=production node reputation-case/site/tools/build-indexable-assets.mjs
    BUILD_ENV=production node reputation-case/site/tools/qa-generated-assets.mjs

    if ! has_changes; then
      echo "==> Generated assets converged on pass ${PASS}"
      break
    fi

    if [[ "$PASS" -eq "$MAX_PASSES" ]]; then
      echo "Generated assets still changing at pass ${PASS}; refusing to push non-converged output." >&2
      exit 1
    fi

    echo "==> Committing generated asset sync (pass ${PASS})"
    git add -A
    if [[ "$PASS" -eq 1 ]]; then
      git commit -m "chore(site): sync generated public assets with build pipeline"
    else
      git commit -m "chore(site): converge generated assets for git-lastmod alignment (pass ${PASS})"
    fi
    PASS=$((PASS + 1))
  done
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "==> Dry run mode: skipping push"
  git --no-pager log --oneline -n 3
  exit 0
fi

echo "==> Pushing to main"
git push origin HEAD:main

echo "==> Done. Recent deploy workflow runs:"
gh run list --workflow deploy-pages.yml --limit 3 || true
