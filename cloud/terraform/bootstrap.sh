#!/bin/bash
# =============================================================================
# Bootstrap Script for New Graphene AWS Accounts
# =============================================================================
# This script sets up a new AWS account for Graphene deployments:
# 1. Assumes role into the target account (if not already there)
# 2. Creates S3 bucket for Terraform state
# 3. Creates GitHub OIDC provider for CI/CD
# 4. Creates terraform-admin IAM user with credentials
# 5. Creates placeholder secrets in Secrets Manager
#
# Usage: ./bootstrap.sh <account-id> <environment-name>
# Example: ./bootstrap.sh 025223626139 staging
#
# Prerequisites:
# - AWS CLI configured (either with target account creds, or org management account)
# - jq installed for JSON parsing
# =============================================================================

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
GITHUB_ORG="graphene-data"
GITHUB_REPO="cloud"
PRODUCTION_ACCOUNT_ID="772069004272"
REGION="us-east-1"
ASSUME_ROLE_NAME="OrganizationAccountAccessRole"

# =============================================================================
# Helper Functions
# =============================================================================

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

check_prerequisites() {
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        log_error "jq is not installed. Please install it first."
        exit 1
    fi

    # Verify AWS credentials are working
    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials are not configured or invalid."
        exit 1
    fi
}

assume_role_into_account() {
    local target_account="$1"
    local current_account
    
    current_account=$(aws sts get-caller-identity --query Account --output text)
    
    if [ "$current_account" == "$target_account" ]; then
        log_info "Already in target account ${target_account}"
        return 0
    fi
    
    log_info "Current account is ${current_account}, assuming role into ${target_account}..."
    
    local role_arn="arn:aws:iam::${target_account}:role/${ASSUME_ROLE_NAME}"
    
    # Assume the role and get temporary credentials
    local creds
    if ! creds=$(aws sts assume-role \
        --role-arn "$role_arn" \
        --role-session-name "bootstrap-${ENVIRONMENT}" \
        --query 'Credentials' \
        --output json 2>&1); then
        log_error "Failed to assume role ${role_arn}"
        log_error "Error: ${creds}"
        log_error ""
        log_error "Make sure:"
        log_error "  1. The account ${target_account} is part of your AWS Organization"
        log_error "  2. The role ${ASSUME_ROLE_NAME} exists in the target account"
        log_error "  3. Your current credentials have permission to assume that role"
        exit 1
    fi
    
    # Export the temporary credentials
    export AWS_ACCESS_KEY_ID=$(echo "$creds" | jq -r '.AccessKeyId')
    export AWS_SECRET_ACCESS_KEY=$(echo "$creds" | jq -r '.SecretAccessKey')
    export AWS_SESSION_TOKEN=$(echo "$creds" | jq -r '.SessionToken')
    
    # Verify we're now in the right account
    local new_account
    new_account=$(aws sts get-caller-identity --query Account --output text)
    
    if [ "$new_account" != "$target_account" ]; then
        log_error "Failed to switch to account ${target_account}. Current account: ${new_account}"
        exit 1
    fi
    
    log_info "Successfully assumed role into account ${target_account}"
}

# =============================================================================
# Main Script
# =============================================================================

if [ $# -lt 2 ]; then
    echo "Usage: $0 <account-id> <environment-name>"
    echo "Example: $0 025223626139 staging"
    echo ""
    echo "This script will automatically assume the OrganizationAccountAccessRole"
    echo "into the target account if you're logged in as the org management account."
    exit 1
fi

ACCOUNT_ID="$1"
ENVIRONMENT="$2"
STATE_BUCKET="graphene-tf-state-${ACCOUNT_ID}"

log_info "Bootstrapping Graphene ${ENVIRONMENT} environment in account ${ACCOUNT_ID}"

check_prerequisites

# Assume role into the target account if needed
assume_role_into_account "$ACCOUNT_ID"

# =============================================================================
# Step 1: Create S3 Bucket for Terraform State
# =============================================================================

log_info "Creating S3 bucket for Terraform state: ${STATE_BUCKET}"

if aws s3api head-bucket --bucket "${STATE_BUCKET}" 2>/dev/null; then
    log_warn "Bucket ${STATE_BUCKET} already exists, skipping creation"
else
    aws s3api create-bucket \
        --bucket "${STATE_BUCKET}" \
        --region "${REGION}"

    log_info "Enabling versioning on state bucket"
    aws s3api put-bucket-versioning \
        --bucket "${STATE_BUCKET}" \
        --versioning-configuration Status=Enabled

    log_info "Enabling server-side encryption"
    aws s3api put-bucket-encryption \
        --bucket "${STATE_BUCKET}" \
        --server-side-encryption-configuration '{
            "Rules": [
                {
                    "ApplyServerSideEncryptionByDefault": {
                        "SSEAlgorithm": "AES256"
                    },
                    "BucketKeyEnabled": true
                }
            ]
        }'

    log_info "Blocking public access"
    aws s3api put-public-access-block \
        --bucket "${STATE_BUCKET}" \
        --public-access-block-configuration '{
            "BlockPublicAcls": true,
            "IgnorePublicAcls": true,
            "BlockPublicPolicy": true,
            "RestrictPublicBuckets": true
        }'

    log_info "S3 bucket created successfully"
fi

# =============================================================================
# Step 2: Create GitHub OIDC Provider
# =============================================================================

log_info "Creating GitHub OIDC provider"

OIDC_ARN="arn:aws:iam::${ACCOUNT_ID}:oidc-provider/token.actions.githubusercontent.com"

if aws iam get-open-id-connect-provider --open-id-connect-provider-arn "${OIDC_ARN}" 2>/dev/null; then
    log_warn "GitHub OIDC provider already exists, skipping creation"
else
    # AWS handles thumbprint validation automatically now, but we need a placeholder
    aws iam create-open-id-connect-provider \
        --url "https://token.actions.githubusercontent.com" \
        --client-id-list "sts.amazonaws.com" \
        --thumbprint-list "ffffffffffffffffffffffffffffffffffffffff"

    log_info "GitHub OIDC provider created"
fi

# =============================================================================
# Step 3: Create CI Deploy Role (for future GitHub Actions integration)
# =============================================================================

log_info "Creating ci-deploy IAM role"

CI_ROLE_NAME="ci-deploy"

if aws iam get-role --role-name "${CI_ROLE_NAME}" 2>/dev/null; then
    log_warn "ci-deploy role already exists, skipping creation"
else
    aws iam create-role \
        --role-name "${CI_ROLE_NAME}" \
        --description "Allows GitHub Actions to deploy to ${ENVIRONMENT}" \
        --assume-role-policy-document "{
            \"Version\": \"2012-10-17\",
            \"Statement\": [
                {
                    \"Effect\": \"Allow\",
                    \"Principal\": {
                        \"Federated\": \"${OIDC_ARN}\"
                    },
                    \"Action\": \"sts:AssumeRoleWithWebIdentity\",
                    \"Condition\": {
                        \"StringEquals\": {
                            \"token.actions.githubusercontent.com:aud\": \"sts.amazonaws.com\"
                        },
                        \"StringLike\": {
                            \"token.actions.githubusercontent.com:sub\": \"repo:${GITHUB_ORG}/${GITHUB_REPO}:*\"
                        }
                    }
                }
            ]
        }"

    # Attach AdministratorAccess for full deploy capabilities
    aws iam attach-role-policy \
        --role-name "${CI_ROLE_NAME}" \
        --policy-arn "arn:aws:iam::aws:policy/AdministratorAccess"

    log_info "ci-deploy role created with AdministratorAccess"
fi

# =============================================================================
# Step 4: Create terraform-admin IAM User
# =============================================================================

log_info "Creating terraform-admin IAM user"

TF_ADMIN_USER="terraform-admin"

if aws iam get-user --user-name "${TF_ADMIN_USER}" 2>/dev/null; then
    log_warn "terraform-admin user already exists"
    log_warn "If you need new credentials, delete the existing access keys first"
    
    # Check if we should create new keys anyway
    EXISTING_KEYS=$(aws iam list-access-keys --user-name "${TF_ADMIN_USER}" --query 'AccessKeyMetadata[*].AccessKeyId' --output text)
    if [ -n "$EXISTING_KEYS" ]; then
        log_warn "Existing access keys: ${EXISTING_KEYS}"
        log_warn "Skipping access key creation. Delete existing keys if you need new ones."
        ACCESS_KEY_ID="<existing - see above>"
        SECRET_ACCESS_KEY="<not shown - use existing or delete and re-run>"
    else
        log_info "No existing access keys, creating new ones..."
        ACCESS_KEY_OUTPUT=$(aws iam create-access-key --user-name "${TF_ADMIN_USER}")
        ACCESS_KEY_ID=$(echo "${ACCESS_KEY_OUTPUT}" | jq -r '.AccessKey.AccessKeyId')
        SECRET_ACCESS_KEY=$(echo "${ACCESS_KEY_OUTPUT}" | jq -r '.AccessKey.SecretAccessKey')
    fi
else
    aws iam create-user --user-name "${TF_ADMIN_USER}"

    aws iam attach-user-policy \
        --user-name "${TF_ADMIN_USER}" \
        --policy-arn "arn:aws:iam::aws:policy/AdministratorAccess"

    log_info "terraform-admin user created with AdministratorAccess"
    
    # Create access key
    log_info "Creating access key for terraform-admin"
    ACCESS_KEY_OUTPUT=$(aws iam create-access-key --user-name "${TF_ADMIN_USER}")
    ACCESS_KEY_ID=$(echo "${ACCESS_KEY_OUTPUT}" | jq -r '.AccessKey.AccessKeyId')
    SECRET_ACCESS_KEY=$(echo "${ACCESS_KEY_OUTPUT}" | jq -r '.AccessKey.SecretAccessKey')
fi

# =============================================================================
# Step 5: Create Placeholder Secrets in Secrets Manager
# =============================================================================

log_info "Creating placeholder secrets in Secrets Manager"

create_secret_if_not_exists() {
    local secret_name="$1"
    local description="$2"

    if aws secretsmanager describe-secret --secret-id "${secret_name}" 2>/dev/null; then
        log_warn "Secret ${secret_name} already exists, skipping"
    else
        aws secretsmanager create-secret \
            --name "${secret_name}" \
            --description "${description}" \
            --secret-string "PLACEHOLDER_VALUE_UPDATE_ME"
        log_info "Created secret: ${secret_name}"
    fi
}

create_secret_if_not_exists "graphene/stytch-secret" "Stytch API secret for ${ENVIRONMENT}"
create_secret_if_not_exists "graphene/github-webhook-secret" "GitHub webhook secret for ${ENVIRONMENT}"
create_secret_if_not_exists "graphene/github-app-client-secret" "GitHub App client secret for ${ENVIRONMENT}"
create_secret_if_not_exists "graphene/github-app-private-key" "GitHub App private key for ${ENVIRONMENT}"

# =============================================================================
# Step 6: Grant Cross-Account ECR Pull Access (if not production)
# =============================================================================

if [ "${ACCOUNT_ID}" != "${PRODUCTION_ACCOUNT_ID}" ]; then
    log_info "Note: This account needs ECR pull access from production (${PRODUCTION_ACCOUNT_ID})"
    log_info "The production Terraform config already grants this via aws_ecr_repository_policy"
fi

# =============================================================================
# Output Summary
# =============================================================================

echo ""
echo "============================================================================="
echo -e "${GREEN}Bootstrap Complete!${NC}"
echo "============================================================================="
echo ""
echo "Terraform State Bucket: ${STATE_BUCKET}"
echo ""
echo "terraform-admin credentials (SAVE THESE - they won't be shown again!):"
echo "============================================================================="
echo "AWS_ACCESS_KEY_ID=${ACCESS_KEY_ID}"
echo "AWS_SECRET_ACCESS_KEY=${SECRET_ACCESS_KEY}"
echo "============================================================================="
echo ""
echo "Next steps:"
echo "1. Save the credentials above securely"
echo "2. Update the placeholder secrets in AWS Secrets Manager:"
echo "   - graphene/stytch-secret"
echo "   - graphene/github-webhook-secret"
echo "   - graphene/github-app-client-secret"
echo "   - graphene/github-app-private-key"
echo ""
echo "3. Export the credentials and run Terraform:"
echo "   export AWS_ACCESS_KEY_ID=${ACCESS_KEY_ID}"
echo "   export AWS_SECRET_ACCESS_KEY=${SECRET_ACCESS_KEY}"
echo "   cd environments/${ENVIRONMENT}"
echo "   terraform init"
echo "   terraform plan"
echo ""
echo "============================================================================="
