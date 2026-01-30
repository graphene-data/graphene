#!/bin/bash
# Wrapper to run terraform with the correct credentials
#
# Usage: ./tf.sh <environment> <command> [args...]
# Example: ./tf.sh staging plan
#          ./tf.sh production apply

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TF_DIR="$SCRIPT_DIR/../terraform"

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <environment> <command> [args...]"
  echo "  environment: production or staging"
  echo "  command: plan, apply, init, etc."
  exit 1
fi

ENV="$1"
shift

if [ ! -d "$TF_DIR/environments/$ENV" ]; then
  echo "Error: Environment '$ENV' not found in terraform/environments/"
  exit 1
fi

# Set up AWS credentials based on environment
if [ "$ENV" = "staging" ]; then
  if [ -f "$REPO_ROOT/.env" ]; then
    set -a
    source "$REPO_ROOT/.env"
    set +a
    # Map .env variables to Terraform variables
    export TF_VAR_stytch_workspace_key_id="$STYTCH_TERRAFORM_KEY_ID"
    export TF_VAR_stytch_workspace_key_secret="$STYTCH_TERRAFORM_KEY_SECRET"
  else
    echo "Error: .env file not found at repo root (required for staging credentials)"
    exit 1
  fi
elif [ "$ENV" = "production" ]; then
  # Load credentials from AWS CLI (requires 'aws configure' or AWS_PROFILE to be set up)
  eval "$(aws configure export-credentials --format env)"
fi

cd "$TF_DIR/environments/$ENV"
terraform "$@"
