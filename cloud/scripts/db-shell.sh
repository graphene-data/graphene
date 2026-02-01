#!/bin/bash
#
# Run commands against the database via ECS task.
# Reuses existing task if running with correct image, otherwise starts a new one.
#
# Prerequisites:
#   - AWS CLI v2
#   - AWS Session Manager plugin
#   - For staging: .env file at repo root with AWS credentials
#
# Usage:
#   ./db-shell.sh [staging|production]                # Interactive psql shell
#   ./db-shell.sh [staging|production] "SQL query"    # Run SQL query
#   ./db-shell.sh [staging|production] --migrate      # Run database migrations
#
# Examples:
#   ./db-shell.sh staging                             # Interactive shell
#   ./db-shell.sh staging "SELECT * FROM orgs"        # Run query
#   ./db-shell.sh staging --migrate                   # Run migrations
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

ENVIRONMENT="${1:-staging}"
COMMAND="${2:-}"

if [ "$ENVIRONMENT" != "staging" ] && [ "$ENVIRONMENT" != "production" ]; then
  echo "Usage: $0 [staging|production] [\"SQL query\" | --migrate]"
  echo ""
  echo "Examples:"
  echo "  $0 staging                        # Interactive psql shell"
  echo "  $0 staging \"SELECT * FROM orgs\"  # Run SQL query"
  echo "  $0 staging --migrate              # Run database migrations"
  exit 1
fi

# Clear any existing AWS credentials to avoid conflicts
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE 2>/dev/null || true

# Set up AWS credentials based on environment
if [ "$ENVIRONMENT" = "staging" ]; then
  if [ -f "$SCRIPT_DIR/../../.env" ]; then
    set -a
    source "$SCRIPT_DIR/../../.env"
    set +a
  else
    echo "Error: .env file not found at repo root (required for staging credentials)" >&2
    exit 1
  fi
elif [ "$ENVIRONMENT" = "production" ]; then
  eval "$(aws configure export-credentials --format env)"
fi

# Configuration
CLUSTER="graphene-prod"
TASK_DEFINITION="graphene-db-ops"
CONTAINER_NAME="db-ops"
REGION="${AWS_REGION:-us-east-1}"

case "$ENVIRONMENT" in
  staging)    ACCOUNT="025223626139" ;;
  production) ACCOUNT="772069004272" ;;
esac

# Get the current image digest from ECR (what :latest points to)
EXPECTED_DIGEST=$(aws ecr describe-images \
  --repository-name graphene/cloud \
  --image-ids imageTag=latest \
  --region "$REGION" \
  --query 'imageDetails[0].imageDigest' \
  --output text 2>/dev/null || echo "")

# Find any running db-ops task
TASK_ARN=$(aws ecs list-tasks \
  --cluster "$CLUSTER" \
  --family "$TASK_DEFINITION" \
  --desired-status RUNNING \
  --region "$REGION" \
  --query 'taskArns[0]' \
  --output text)

if [ "$TASK_ARN" != "None" ] && [ -n "$TASK_ARN" ]; then
  # Check if the running task has the correct image
  TASK_IMAGE_DIGEST=$(aws ecs describe-tasks \
    --cluster "$CLUSTER" \
    --tasks "$TASK_ARN" \
    --region "$REGION" \
    --query 'tasks[0].containers[?name==`db-ops`].imageDigest' \
    --output text)

  if [ "$TASK_IMAGE_DIGEST" != "$EXPECTED_DIGEST" ]; then
    echo "Running task has stale image, stopping it..."
    aws ecs stop-task --cluster "$CLUSTER" --task "$TASK_ARN" --reason "stale image" --region "$REGION" > /dev/null
    aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK_ARN" --region "$REGION" 2>/dev/null || true
    TASK_ARN="None"
  fi
fi

# Start a new task if needed
if [ "$TASK_ARN" = "None" ] || [ -z "$TASK_ARN" ]; then
  echo "Starting db-ops task..."

  SUBNETS=$(aws ec2 describe-subnets --filters "Name=default-for-az,Values=true" \
    --query 'Subnets[0:2].SubnetId' --output text --region "$REGION" | tr '\t' ',')
  SG=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=graphene-ecs-sg" \
    --query 'SecurityGroups[0].GroupId' --output text --region "$REGION")

  TASK_ARN=$(aws ecs run-task \
    --cluster "$CLUSTER" \
    --task-definition "$TASK_DEFINITION" \
    --launch-type FARGATE \
    --enable-execute-command \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=ENABLED}" \
    --region "$REGION" \
    --query 'tasks[0].taskArn' \
    --output text)

  echo "Waiting for task to be running..."
  aws ecs wait tasks-running --cluster "$CLUSTER" --tasks "$TASK_ARN" --region "$REGION"

  echo "Waiting for execute command agent..."
  for i in {1..60}; do
    AGENT_STATUS=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
      --query "tasks[0].containers[?name==\`$CONTAINER_NAME\`].managedAgents[?name==\`ExecuteCommandAgent\`].lastStatus" \
      --output text --region "$REGION" 2>/dev/null || echo "PENDING")
    if [ "$AGENT_STATUS" = "RUNNING" ]; then
      break
    fi
    sleep 2
  done

  if [ "$AGENT_STATUS" != "RUNNING" ]; then
    echo "Error: Execute command agent failed to start"
    aws ecs stop-task --cluster "$CLUSTER" --task "$TASK_ARN" --reason "execute command agent failed" --region "$REGION" > /dev/null
    exit 1
  fi
fi

TASK_ID=$(echo "$TASK_ARN" | rev | cut -d'/' -f1 | rev)
echo "Using task: $TASK_ID"

# Execute the command
if [ -z "$COMMAND" ]; then
  # Interactive psql shell
  exec aws ecs execute-command \
    --cluster "$CLUSTER" \
    --task "$TASK_ARN" \
    --container "$CONTAINER_NAME" \
    --interactive \
    --region "$REGION" \
    --command 'sh -c "psql \$DATABASE_URL"'
elif [ "$COMMAND" = "--migrate" ]; then
  # Run migrations
  echo "Running migrations..."
  exec aws ecs execute-command \
    --cluster "$CLUSTER" \
    --task "$TASK_ARN" \
    --container "$CONTAINER_NAME" \
    --region "$REGION" \
    --command "node server/migrate.ts"
else
  # Run SQL query
  exec aws ecs execute-command \
    --cluster "$CLUSTER" \
    --task "$TASK_ARN" \
    --container "$CONTAINER_NAME" \
    --region "$REGION" \
    --command "psql \$DATABASE_URL -c '$COMMAND'"
fi
