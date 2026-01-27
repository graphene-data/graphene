#!/bin/bash
# Bootstrap a new AWS account for Graphene
# Creates: S3 state bucket, terraform-admin IAM user with access key
#
# Usage: ./bootstrap.sh <account-id>
# Example: ./bootstrap.sh 025223626139

set -euo pipefail

REGION="us-east-1"
ASSUME_ROLE_NAME="OrganizationAccountAccessRole"

if [ $# -lt 1 ]; then
  echo "Usage: $0 <account-id>"
  exit 1
fi

ACCOUNT_ID="$1"
STATE_BUCKET="graphene-tf-state-${ACCOUNT_ID}"

# Check if we need to assume role into the target account
CURRENT_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
if [ "$CURRENT_ACCOUNT" != "$ACCOUNT_ID" ]; then
  echo "Assuming role into account ${ACCOUNT_ID}..."
  CREDS=$(aws sts assume-role \
    --role-arn "arn:aws:iam::${ACCOUNT_ID}:role/${ASSUME_ROLE_NAME}" \
    --role-session-name "bootstrap" \
    --query 'Credentials' \
    --output json)
  export AWS_ACCESS_KEY_ID=$(echo "$CREDS" | jq -r '.AccessKeyId')
  export AWS_SECRET_ACCESS_KEY=$(echo "$CREDS" | jq -r '.SecretAccessKey')
  export AWS_SESSION_TOKEN=$(echo "$CREDS" | jq -r '.SessionToken')
fi

# Create S3 bucket for terraform state
echo "Creating S3 bucket: ${STATE_BUCKET}"
if aws s3api head-bucket --bucket "${STATE_BUCKET}" 2>/dev/null; then
  echo "Bucket already exists, skipping"
else
  aws s3api create-bucket --bucket "${STATE_BUCKET}" --region "${REGION}"
  aws s3api put-bucket-versioning --bucket "${STATE_BUCKET}" --versioning-configuration Status=Enabled
  aws s3api put-bucket-encryption --bucket "${STATE_BUCKET}" \
    --server-side-encryption-configuration '{"Rules":[{"ApplyServerSideEncryptionByDefault":{"SSEAlgorithm":"AES256"},"BucketKeyEnabled":true}]}'
  aws s3api put-public-access-block --bucket "${STATE_BUCKET}" \
    --public-access-block-configuration '{"BlockPublicAcls":true,"IgnorePublicAcls":true,"BlockPublicPolicy":true,"RestrictPublicBuckets":true}'
fi

# Create terraform-admin IAM user
TF_USER="terraform-admin"
echo "Creating IAM user: ${TF_USER}"
if aws iam get-user --user-name "${TF_USER}" 2>/dev/null; then
  echo "User already exists"
  EXISTING_KEYS=$(aws iam list-access-keys --user-name "${TF_USER}" --query 'AccessKeyMetadata[*].AccessKeyId' --output text)
  if [ -n "$EXISTING_KEYS" ]; then
    echo "Existing access keys: ${EXISTING_KEYS}"
    echo "Delete existing keys if you need new ones"
    exit 0
  fi
else
  aws iam create-user --user-name "${TF_USER}"
  aws iam attach-user-policy --user-name "${TF_USER}" --policy-arn "arn:aws:iam::aws:policy/AdministratorAccess"
fi

# Create access key
echo "Creating access key..."
KEY_OUTPUT=$(aws iam create-access-key --user-name "${TF_USER}")
ACCESS_KEY_ID=$(echo "${KEY_OUTPUT}" | jq -r '.AccessKey.AccessKeyId')
SECRET_ACCESS_KEY=$(echo "${KEY_OUTPUT}" | jq -r '.AccessKey.SecretAccessKey')

echo ""
echo "=== Bootstrap Complete ==="
echo "State bucket: ${STATE_BUCKET}"
echo ""
echo "Credentials (save these!):"
echo "AWS_ACCESS_KEY_ID=${ACCESS_KEY_ID}"
echo "AWS_SECRET_ACCESS_KEY=${SECRET_ACCESS_KEY}"
