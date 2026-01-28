#!/bin/bash
#
# Run SQL against the database via ECS task
#
# Prerequisites:
#   - AWS CLI v2
#   - For interactive mode: AWS Session Manager plugin
#   - For staging: .env file at repo root with AWS credentials
#
# Usage:
#   ./db-shell.sh [staging|production]              # Interactive psql shell (requires Session Manager plugin)
#   ./db-shell.sh [staging|production] "SQL query"  # Run query and exit
#
# Examples:
#   ./db-shell.sh staging                           # Interactive shell
#   ./db-shell.sh staging "SELECT * FROM orgs"      # Run query
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

ENVIRONMENT="${1:-staging}"
QUERY="${2:-}"

# Clear any existing AWS credentials to avoid conflicts
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE 2>/dev/null || true

# Set up AWS credentials based on environment
if [ "$ENVIRONMENT" = "staging" ]; then
  if [ -f "$SCRIPT_DIR/../../.env" ]; then
    set -a
    source "$SCRIPT_DIR/../../.env"
    set +a
  else
    echo "Error: .env file not found at repo root (required for staging credentials)"
    exit 1
  fi
elif [ "$ENVIRONMENT" = "production" ]; then
  eval "$(aws configure export-credentials --format env)"
else
  echo "Usage: $0 [staging|production] [\"SQL query\"]"
  echo ""
  echo "Examples:"
  echo "  $0 staging                        # Interactive shell"
  echo "  $0 staging \"SELECT * FROM orgs\"  # Run query"
  exit 1
fi

# Configuration per environment
case "$ENVIRONMENT" in
  staging)
    CLUSTER="graphene-prod"
    ;;
  production)
    CLUSTER="graphene-prod"
    ;;
esac

TASK_DEFINITION="graphene-db-shell"
CONTAINER_NAME="db-shell"
REGION="${AWS_REGION:-us-east-1}"

# Get network config
SUBNETS=$(aws ec2 describe-subnets --filters "Name=default-for-az,Values=true" \
  --query 'Subnets[0:2].SubnetId' --output text --region "$REGION" | tr '\t' ',')
SG=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=graphene-ecs-sg" \
  --query 'SecurityGroups[0].GroupId' --output text --region "$REGION")

# Get caller identity for audit
CALLER_IDENTITY=$(aws sts get-caller-identity --output json --region "$REGION")
USER_ARN=$(echo "$CALLER_IDENTITY" | jq -r '.Arn')
ACCOUNT_ID=$(echo "$CALLER_IDENTITY" | jq -r '.Account')

MODE="interactive"
[ -n "$QUERY" ] && MODE="query"

echo "Starting db-shell session..."
echo "  Environment: $ENVIRONMENT"
echo "  User: $USER_ARN"
echo "  Mode: $MODE"
# Note: SNS notifications are handled automatically via EventBridge when the ECS task starts

if [ -n "$QUERY" ]; then
  # Query mode: run via task command override
  echo ""
  echo "Running query..."

  OVERRIDES=$(jq -n --arg q "$QUERY" '{
    containerOverrides: [{
      name: "db-shell",
      command: ["sh", "-c", ("psql $DATABASE_URL -c " + ($q | @sh))]
    }]
  }')

  TASK_ARN=$(aws ecs run-task \
    --cluster "$CLUSTER" \
    --task-definition "$TASK_DEFINITION" \
    --launch-type FARGATE \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=ENABLED}" \
    --overrides "$OVERRIDES" \
    --region "$REGION" \
    --query 'tasks[0].taskArn' \
    --output text)

  TASK_ID=$(echo "$TASK_ARN" | rev | cut -d'/' -f1 | rev)
  echo "Task: $TASK_ID"
  echo "Waiting for task to complete..."

  aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK_ID" --region "$REGION"

  EXIT_CODE=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ID" --region "$REGION" \
    --query 'tasks[0].containers[?name==`db-shell`].exitCode' --output text)

  echo ""
  echo "=== Output ==="
  aws logs get-log-events --log-group-name /ecs/graphene-prod \
    --log-stream-name "db-shell/db-shell/$TASK_ID" \
    --region "$REGION" \
    --query 'events[*].message' --output text 2>/dev/null || echo "(no logs available yet)"
  echo "=============="

  if [ "$EXIT_CODE" != "0" ]; then
    echo ""
    echo "Query failed with exit code $EXIT_CODE"
    exit 1
  fi
else
  # Interactive mode: use ECS Exec
  echo ""
  echo "Starting ECS task..."

  TASK_ARN=$(aws ecs run-task \
    --cluster "$CLUSTER" \
    --task-definition "$TASK_DEFINITION" \
    --launch-type FARGATE \
    --enable-execute-command \
    --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=ENABLED}" \
    --region "$REGION" \
    --query 'tasks[0].taskArn' \
    --output text)

  TASK_ID=$(echo "$TASK_ARN" | rev | cut -d'/' -f1 | rev)
  echo "Task: $TASK_ID"
  echo "Waiting for task to be running..."

  aws ecs wait tasks-running --cluster "$CLUSTER" --tasks "$TASK_ARN" --region "$REGION"

  echo "Waiting for execute command agent..."
  AGENT_STATUS=""
  for i in {1..60}; do
    AGENT_STATUSES=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
      --query "tasks[0].containers[*].managedAgents[0].lastStatus" \
      --output text --region "$REGION" 2>/dev/null || echo "PENDING")
    if echo "$AGENT_STATUSES" | grep -q "RUNNING"; then
      AGENT_STATUS="RUNNING"
      break
    fi
    printf "."
    sleep 2
  done
  echo ""

  if [ "$AGENT_STATUS" != "RUNNING" ]; then
    echo "Error: Execute command agent failed to start"
    echo "Stopping task..."
    aws ecs stop-task --cluster "$CLUSTER" --task "$TASK_ARN" --reason "execute command agent failed" --region "$REGION" > /dev/null
    exit 1
  fi

  echo "Connecting to psql..."
  echo "Type \\q to exit psql, then the container will be stopped."
  echo ""

  aws ecs execute-command \
    --cluster "$CLUSTER" \
    --task "$TASK_ARN" \
    --container "$CONTAINER_NAME" \
    --interactive \
    --region "$REGION" \
    --command 'sh -c "psql \$DATABASE_URL"'

  echo ""
  echo "Stopping task..."
  aws ecs stop-task --cluster "$CLUSTER" --task "$TASK_ARN" --reason "db-shell session ended" --region "$REGION" > /dev/null
  echo "Session complete."
fi
