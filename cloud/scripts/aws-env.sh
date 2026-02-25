#!/bin/bash

CLOUD_SCRIPTS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLOUD_REPO_ROOT="$(cd "$CLOUD_SCRIPTS_DIR/../.." && pwd)"
CLOUD_PROD_ROOT="$(cd "$CLOUD_REPO_ROOT/.." && pwd)"

_cloud_clear_aws_env() {
  unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE AWS_DEFAULT_PROFILE AWS_REGION AWS_DEFAULT_REGION AWS_ROLE_ARN AWS_ROLE_SESSION_NAME AWS_WEB_IDENTITY_TOKEN_FILE AWS_SHARED_CREDENTIALS_FILE AWS_CONFIG_FILE 2>/dev/null || true
}

cloud_setup_infra_env() {
  local environment="$1"

  case "$environment" in
    staging)
      _cloud_clear_aws_env

      if [ ! -f "$CLOUD_REPO_ROOT/.env" ]; then
        echo "Error: .env file not found at repo root (required for staging credentials)" >&2
        return 1
      fi

      set -a
      # shellcheck source=/dev/null
      source "$CLOUD_REPO_ROOT/.env"
      set +a
      ;;
    production)
      if [ "${CI:-}" = "true" ]; then
        if [ -z "${AWS_ACCESS_KEY_ID:-}" ] || [ -z "${AWS_SECRET_ACCESS_KEY:-}" ]; then
          echo "Error: missing CI AWS credentials for production. Run aws-actions/configure-aws-credentials first." >&2
          return 1
        fi
      else
        _cloud_clear_aws_env

        if [ -f "$CLOUD_PROD_ROOT/aws_prod.env" ]; then
          set -a
          # shellcheck source=/dev/null
          source "$CLOUD_PROD_ROOT/aws_prod.env"
          set +a
        fi

        if [ -z "${AWS_ACCESS_KEY_ID:-}" ] && [ -z "${AWS_PROFILE:-}" ]; then
          local exported_creds
          if ! exported_creds="$(aws configure export-credentials --format env 2>/dev/null)"; then
            echo "Error: no AWS credentials found for production." >&2
            return 1
          fi
          eval "$exported_creds"
        fi
      fi
      ;;
    *)
      echo "Error: unknown environment '$environment' (expected staging or production)" >&2
      return 1
      ;;
  esac

}

cloud_setup_aws_env() {
  cloud_setup_infra_env "$1"
}

cloud_export_tf_stytch_vars() {
  if [ -n "${STYTCH_TERRAFORM_KEY_ID:-}" ]; then
    export TF_VAR_stytch_workspace_key_id="$STYTCH_TERRAFORM_KEY_ID"
  fi

  if [ -n "${STYTCH_TERRAFORM_KEY_SECRET:-}" ]; then
    export TF_VAR_stytch_workspace_key_secret="$STYTCH_TERRAFORM_KEY_SECRET"
  fi
}
