#!/bin/bash
# Test the screenshot Lambda function
set -e

RESPONSE=$(aws lambda invoke \
  --function-name graphene-screenshot \
  --region "${AWS_REGION:-us-east-1}" \
  --payload '{"type":"screenshot","url":"https://example.com"}' \
  --cli-binary-format raw-in-base64-out \
  /dev/stdout 2>/dev/null)

# Check for success without requiring jq
if echo "$RESPONSE" | grep -q '"success":true'; then
  echo "OK"
  echo $RESPONSE
else
  echo "FAIL: $RESPONSE"
  exit 1
fi
