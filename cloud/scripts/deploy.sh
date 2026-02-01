#!/bin/bash
#
# Build and deploy the cloud service to ECS
#
# Usage: ./deploy.sh [--skip-build] [--no-migrate] [staging|production]
#
# Options:
#   --skip-build    Skip build/push steps (use existing image in ECR)
#   --no-migrate    Skip database migrations
#
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"

# --- Parse arguments ---

SKIP_BUILD=false
NO_MIGRATE=false
ENVIRONMENT=""

for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=true ;;
    --no-migrate) NO_MIGRATE=true ;;
    staging|production) ENVIRONMENT="$arg" ;;
    *) echo "Usage: $0 [--skip-build] [--no-migrate] [staging|production]" >&2; exit 1 ;;
  esac
done

ENVIRONMENT="${ENVIRONMENT:-staging}"

# --- Configuration ---

REGION="us-east-1"
CLUSTER="graphene-prod"
SERVICE="graphene-cloud"

case "$ENVIRONMENT" in
  staging)    ACCOUNT="025223626139"; URL="https://graphene-staging.com"; VITE_STYTCH_PUBLIC_TOKEN="public-token-live-f2a46176-0127-4b0e-aa72-9843a4337482" ;;
  production) ACCOUNT="772069004272"; URL="https://graphenedata.com" ;;
esac

ECR_REPO="${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com/graphene/cloud"

echo "Deploying to $ENVIRONMENT (skip-build: $SKIP_BUILD)"

# --- Load staging credentials ---

if [ "$ENVIRONMENT" = "staging" ]; then
  unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE 2>/dev/null || true
  [ -f "$REPO_ROOT/.env" ] || { echo "Error: .env file required for staging" >&2; exit 1; }
  set -a; source "$REPO_ROOT/.env"; set +a
fi

# --- Build and push ---

if [ "$SKIP_BUILD" = false ]; then
  echo "=== Building Vite frontend ==="
  # (cd "$REPO_ROOT/cloud" && VITE_STYTCH_PUBLIC_TOKEN=$VITE_STYTCH_PUBLIC_TOKEN pnpm build)

  echo "=== Building Docker image ==="
  docker build --platform linux/amd64 -f $REPO_ROOT/cloud/server/Dockerfile -t "${ECR_REPO}:latest" "$REPO_ROOT"

  echo "=== Pushing to ECR ==="
  aws ecr get-login-password --region "$REGION" \
    | docker login --username AWS --password-stdin "${ACCOUNT}.dkr.ecr.${REGION}.amazonaws.com"
  docker push "${ECR_REPO}:latest"
fi

# --- Run migrations ---

if [ "$NO_MIGRATE" = false ]; then
  echo "=== Running database migrations ==="
  "$REPO_ROOT/cloud/scripts/db-shell.sh" "$ENVIRONMENT" --migrate
else
  echo "=== Skipping database migrations ==="
fi

# --- Update service ---

echo "=== Updating ECS service ==="

aws ecs update-express-gateway-service \
  --service-arn "arn:aws:ecs:${REGION}:${ACCOUNT}:service/${CLUSTER}/${SERVICE}" \
  --primary-container image="${ECR_REPO}:latest" \
  --region "$REGION"

echo "=== Waiting for deployment ==="
aws ecs wait services-stable --cluster "$CLUSTER" --services "$SERVICE" --region "$REGION"

echo "=== Deployment complete! ==="
echo "URL: $URL"
