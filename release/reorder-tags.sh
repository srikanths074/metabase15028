#!/bin/bash
# for some reason, github always puts our enterprise release notes above our open source
# release notes on the releases page. We always want the open source release notes to be on top.
# The hack we've found for this is to force-push yesterday's date into the enterprise release tag.

# usage: ./reorder-tags.sh <enterprise-tag> <commit-hash>

tagName=$1
commit=$2

if [ -z "$tagName" ]; then
  echo "Please provide a tag name (e.g v1.49.9)"
  exit 1
fi

if [ -z "$commit" ]; then
  echo "Please provide a commit hash"
  exit 1
fi

echo "Reordering commits for $tagName on $commit"

git fetch origin --tags --prune-tags --force

yesterday="$(date -v-1d +%Y-%m-%d)T23:00:00Z"

GIT_COMMITTER_DATE=$yesterday git tag -f -a -m "$tagName" "$tagName" "$commit"

git show "$tagName" --quiet

git push origin --force "$tagName"
