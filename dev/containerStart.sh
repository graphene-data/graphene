set -a
source .env
set +a

aws configure set region $AWS_DEFAULT_REGION
aws configure set aws_access_key_id $AWS_ACCESS_KEY_ID
aws configure set aws_secret_access_key $AWS_SECRET_ACCESS_KEY

opencode upgrade

(cd cloud && pnpm --force install)
(cd core && pnpm --force install)
