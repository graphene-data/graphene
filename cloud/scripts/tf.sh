#!/bin/bash
# Wrapper to run terraform with the correct credentials
#
# Usage: ./tf.sh <environment> <command> [args...]
# Example: ./tf.sh staging plan
#          ./tf.sh production apply
# When running against production, you'll need to `aws login` first

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=/dev/null
source "$SCRIPT_DIR/aws-env.sh"
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

cloud_setup_infra_env "$ENV"
cloud_export_tf_stytch_vars

cd "$TF_DIR/environments/$ENV"
terraform "$@"
