#!/bin/bash
#
# Build and deploy the marketing website to S3 + CloudFront.
#
# Usage: ./website/scripts/deploy.sh [staging|production]

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

ENVIRONMENT=""

for arg in "$@"; do
  case "$arg" in
    staging|production) ENVIRONMENT="$arg" ;;
    *) echo "Usage: $0 [staging|production]" >&2; exit 1 ;;
  esac
done

ENVIRONMENT="${ENVIRONMENT:-staging}"

case "$ENVIRONMENT" in
  staging) ACCOUNT="025223626139" ;;
  production) ACCOUNT="772069004272" ;;
esac

BUCKET="graphene-website-${ENVIRONMENT}-${ACCOUNT}"

if [ "$ENVIRONMENT" = "staging" ]; then
  unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE 2>/dev/null || true
  [ -f "$REPO_ROOT/.env" ] || { echo "Error: .env file required for staging" >&2; exit 1; }
  set -a; source "$REPO_ROOT/.env"; set +a
fi

echo "=== Installing website dependencies ==="
(cd "$REPO_ROOT/website" && CI=true pnpm install --frozen-lockfile)

echo "=== Building website ==="
(cd "$REPO_ROOT/website" && pnpm build)

DIST_DIR="$REPO_ROOT/website/dist"
[ -d "$DIST_DIR" ] || { echo "Error: missing build output at $DIST_DIR" >&2; exit 1; }

echo "=== Uploading website assets to s3://$BUCKET ==="
aws s3 sync "$DIST_DIR/" "s3://$BUCKET/" --delete --exclude "*.html" --cache-control "public,max-age=31536000,immutable"
aws s3 sync "$DIST_DIR/" "s3://$BUCKET/" --delete --exclude "*" --include "*.html" --cache-control "public,max-age=0,must-revalidate"

DISTRIBUTION_ID=$(aws cloudfront list-distributions --query "DistributionList.Items[?Comment=='Graphene website (${ENVIRONMENT})'].Id | [0]" --output text)
if [ -z "$DISTRIBUTION_ID" ] || [ "$DISTRIBUTION_ID" = "None" ]; then
  echo "Error: no CloudFront distribution found for environment '$ENVIRONMENT'" >&2
  exit 1
fi

echo "=== Invalidating CloudFront cache ($DISTRIBUTION_ID) ==="
aws cloudfront create-invalidation --distribution-id "$DISTRIBUTION_ID" --paths "/*" >/dev/null

echo "=== Website deploy complete (${ENVIRONMENT}) ==="
