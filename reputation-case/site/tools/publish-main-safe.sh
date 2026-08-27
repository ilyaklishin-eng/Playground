#!/usr/bin/env bash
set -euo pipefail

# Deterministic publisher for site-only changes. It refuses unrelated worktree
# changes and remote divergence instead of stashing, merging, or resolving
# either condition automatically.
#
# Usage:
#   ./reputation-case/site/tools/publish-main-safe.sh
#   ./reputation-case/site/tools/publish-main-safe.sh --dry-run
#   ./reputation-case/site/tools/publish-main-safe.sh --message "Site update"

REPO_ROOT="$(git rev-parse --show-toplevel)"
SITE_PATH="reputation-case/site"
cd "$REPO_ROOT"

DRY_RUN=0
COMMIT_MESSAGE="chore(site): publish verified site update"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    --message)
      [[ $# -ge 2 ]] || { echo "--message requires a value" >&2; exit 2; }
      COMMIT_MESSAGE="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 2
      ;;
  esac
done

if [[ "$(git branch --show-current)" != "main" ]]; then
  echo "Refusing to publish outside the main branch." >&2
  exit 1
fi

if [[ -n "$(git status --porcelain -- . ":(exclude)${SITE_PATH}/**")" ]]; then
  echo "Refusing to publish: changes outside ${SITE_PATH} are present." >&2
  git status --short -- . ":(exclude)${SITE_PATH}/**"
  exit 1
fi

if [[ -n "$(git rev-parse -q --verify MERGE_HEAD 2>/dev/null || true)" ]] ||
   [[ -d "$(git rev-parse --git-path rebase-merge)" ]] ||
   [[ -d "$(git rev-parse --git-path rebase-apply)" ]]; then
  echo "Refusing to publish during an unfinished merge or rebase." >&2
  exit 1
fi

echo "==> Fetching origin/main"
git fetch origin main

if ! git merge-base --is-ancestor origin/main HEAD; then
  echo "origin/main contains commits missing from local HEAD; integrate them explicitly first." >&2
  exit 1
fi

HEAD_DATE="$(git log -1 --format=%cI)"
echo "==> Deterministic build timestamp: ${HEAD_DATE}"

echo "==> Building generated assets"
SITE_BUILD_TIMESTAMP="$HEAD_DATE" BUILD_ENV=production node "$SITE_PATH/tools/build-indexable-assets.mjs"
FIRST_BUILD_HASH="$(git diff --binary -- "$SITE_PATH" | git hash-object --stdin)"
SITE_BUILD_TIMESTAMP="$HEAD_DATE" BUILD_ENV=production node "$SITE_PATH/tools/build-indexable-assets.mjs"
SECOND_BUILD_HASH="$(git diff --binary -- "$SITE_PATH" | git hash-object --stdin)"

if [[ "$FIRST_BUILD_HASH" != "$SECOND_BUILD_HASH" ]]; then
  echo "Generated assets did not converge after a second build; refusing to publish." >&2
  exit 1
fi

echo "==> Running site QA"
git diff --check
node "$SITE_PATH/tools/qa-public-content.mjs"
BUILD_ENV=production node "$SITE_PATH/tools/qa-generated-assets.mjs"
node --check "$SITE_PATH/tools/build-indexable-assets.mjs"

if [[ -z "$(git status --porcelain -- "$SITE_PATH")" ]]; then
  echo "No site changes to publish."
  exit 0
fi

if [[ "$DRY_RUN" -eq 1 ]]; then
  echo "==> Dry run complete; no files were staged, committed, or pushed."
  git status --short -- "$SITE_PATH"
  exit 0
fi

echo "==> Staging site changes only"
git add "$SITE_PATH"

if [[ -n "$(git diff --cached --name-only -- . ":(exclude)${SITE_PATH}/**")" ]]; then
  echo "Unexpected staged files outside ${SITE_PATH}; refusing to commit." >&2
  exit 1
fi

GIT_AUTHOR_DATE="$HEAD_DATE" GIT_COMMITTER_DATE="$HEAD_DATE" \
  git commit -m "$COMMIT_MESSAGE" --date="$HEAD_DATE"

echo "==> Rechecking origin/main before push"
git fetch origin main
if ! git merge-base --is-ancestor origin/main HEAD; then
  echo "origin/main advanced; refusing to force or auto-merge." >&2
  exit 1
fi

echo "==> Pushing main"
git push origin HEAD:main

echo "==> Recent deploy workflow runs"
gh run list --workflow deploy-pages.yml --limit 3 || true
