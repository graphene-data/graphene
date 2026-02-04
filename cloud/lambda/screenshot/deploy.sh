#!/bin/bash
#
# Deploy the screenshot Lambda function
#
# Usage: ./deploy.sh [account_id]
#   account_id: AWS account ID (defaults to 025223626139 for staging)
#
set -euo pipefail

# cleanup from previous deploys
rm -rf *.zip
rm -rf node_modules

ACCOUNT_ID="${1:-025223626139}"

pnpm install
zip -rq function.zip .
aws s3 cp function.zip s3://graphene-lambda-deployments-$ACCOUNT_ID/screenshot/function.zip
aws lambda update-function-code --function-name graphene-screenshot --s3-bucket graphene-lambda-deployments-$ACCOUNT_ID --s3-key screenshot/function.zip --no-cli-pager

aws lambda wait function-updated --function-name graphene-screenshot
