#!/bin/bash
#
# Onboard a new organization to staging
# Creates the org in Stytch and the database
#
# Prerequisites:
#   - .env file at repo root with Stytch and AWS credentials
#
# Usage: ./onboard.sh <org-name> <org-slug> <admin-email>
#
# Example: ./onboard.sh "Acme Corp" acme admin@acme.com
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load environment variables from .env
if [ -f "$REPO_ROOT/.env" ]; then
  set -a
  source "$REPO_ROOT/.env"
  set +a
else
  echo "Error: .env file not found at repo root"
  echo "Required variables: STYTCH_PROJECT_ID, STYTCH_SECRET, STYTCH_DOMAIN, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY"
  exit 1
fi

# Validate arguments
if [ $# -lt 3 ]; then
  echo "Usage: $0 <org-name> <org-slug> <admin-email>"
  echo ""
  echo "Arguments:"
  echo "  org-name    Display name for the organization (e.g., 'Acme Corp')"
  echo "  org-slug    URL slug for the organization (e.g., 'acme')"
  echo "  admin-email Email address for the admin user"
  echo ""
  echo "Example: $0 'Acme Corp' acme admin@acme.com"
  exit 1
fi

ORG_NAME="$1"
ORG_SLUG="$2"
ADMIN_EMAIL="$3"

# Validate required env vars
: "${STYTCH_PROJECT_ID:?STYTCH_PROJECT_ID is required in .env}"
: "${STYTCH_SECRET:?STYTCH_SECRET is required in .env}"
: "${STYTCH_DOMAIN:?STYTCH_DOMAIN is required in .env}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID is required in .env}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY is required in .env}"

echo "Onboarding organization to staging..."
echo "  Org Name: $ORG_NAME"
echo "  Org Slug: $ORG_SLUG"
echo "  Admin Email: $ADMIN_EMAIL"
echo ""

# Run the TypeScript script to create in Stytch and get SQL
SQL_OUTPUT=$(node --experimental-strip-types "$SCRIPT_DIR/onboard.ts" "$ORG_NAME" "$ORG_SLUG" "$ADMIN_EMAIL")

echo ""
echo "Running SQL against staging database..."
AWS_REGION="${AWS_REGION:-us-east-1}" "$SCRIPT_DIR/db-shell.sh" staging "$SQL_OUTPUT"

echo ""
echo "Onboarding complete!"
echo "The user can now log in at https://${ORG_SLUG}.graphene-staging.com"
