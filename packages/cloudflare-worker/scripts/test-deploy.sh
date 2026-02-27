#!/bin/bash
# Local deployment test for BillClaw Worker
# Validates bundle size and runs local dev server
#
# Usage:
#   ./scripts/test-deploy.sh [--dry-run | --dev]

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PACKAGE_DIR="$(dirname "$SCRIPT_DIR")"

# Parse arguments
MODE="${1:---dry-run}"

echo "=== BillClaw Worker Deployment Test ==="
echo ""

# Build the worker
echo "Building worker..."
cd "$PACKAGE_DIR"
pnpm build

if [ $? -ne 0 ]; then
  echo "ERROR: Build failed"
  exit 1
fi

echo "Build successful!"
echo ""

# Check bundle size with dry-run
if [ "$MODE" == "--dry-run" ] || [ "$MODE" == "" ]; then
  echo "Checking bundle size (dry-run)..."

  # Create temp directory for bundle
  BUNDLE_DIR="$PACKAGE_DIR/.bundle-test"
  rm -rf "$BUNDLE_DIR"
  mkdir -p "$BUNDLE_DIR"

  # Run wrangler deploy with dry-run to check bundle
  npx wrangler deploy --outdir "$BUNDLE_DIR" --dry-run 2>/dev/null

  if [ -d "$BUNDLE_DIR" ]; then
    # Get bundle size (works on macOS/Linux)
    SIZE=$(du -sh "$BUNDLE_DIR" 2>/dev/null | cut -f1)
    echo "Bundle size: $SIZE"

    # Check if size exceeds free tier limit (3MB compressed = ~10MB uncompressed)
    SIZE_BYTES=$(du -sk "$BUNDLE_DIR" 2>/dev/null | cut -f1 | sed 's/[A-Za-z]*$//')
    if [ -n "$SIZE_BYTES" ]; then
      SIZE_KB=$((SIZE_BYTES / 1024))
      SIZE_MB=$(echo "scale=2; $SIZE_KB / 1024" | bc)

      echo "Bundle size: ${SIZE_MB} MB"

      # Check against limits (1MB compressed limit for free tier)
      if (( $(echo "${SIZE_MB} > 1" | bc -l) )); then
        echo ""
        echo "WARNING: Bundle size (${SIZE_MB} MB) may be large."
        echo "Free tier limit is 1MB compressed (workers paid)."
        echo "Consider optimizing dependencies if deployment fails."
      else
        echo "Bundle size is within free tier limits."
      fi
    fi

    # Cleanup
    rm -rf "$BUNDLE_DIR"
  fi
fi

echo ""
echo "=== Deployment Test Complete ==="
