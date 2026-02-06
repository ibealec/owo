#!/usr/bin/env bash
set -euo pipefail

if [ $# -ne 1 ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 1.4.1"
  exit 1
fi

VERSION="$1"
TAG="v${VERSION}"

# Validate semver-ish format
if ! [[ "$VERSION" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "Error: Version must be in semver format (e.g., 1.4.1)"
  exit 1
fi

# Check for clean working tree
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "Error: Working tree is not clean. Commit or stash changes first."
  exit 1
fi

# Check tag doesn't already exist
if git rev-parse "$TAG" >/dev/null 2>&1; then
  echo "Error: Tag $TAG already exists."
  exit 1
fi

# Bump version in both files
sed -i '' "s/\"version\": \".*\"/\"version\": \"${VERSION}\"/" package.json
sed -i '' "s/const VERSION = \".*\"/const VERSION = \"${VERSION}\"/" index.ts

# Commit, tag, push
git add package.json index.ts
git commit -m "Bump version to ${VERSION}"
git tag "$TAG"
git push origin main --tags

echo ""
echo "Pushed ${TAG}. CI will now:"
echo "  1. Build binaries (darwin-arm64, darwin-x64, linux-x64)"
echo "  2. Create GitHub release"
echo "  3. Publish to npm"
echo "  4. Update Homebrew formula with new SHA256 hashes"
