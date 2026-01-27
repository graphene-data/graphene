#!/bin/bash
#
# Opens a psql shell against the production database via ECS Exec.
# Notifies SNS before connecting for audit purposes.
#
# Prerequisites:
#   - AWS CLI v2 with Session Manager plugin installed
#   - For staging: .env file at repo root with AWS credentials
#   - For production: AWS CLI credentials configured
#
# Usage: ./db-shell.sh [staging|production]
#
set -euo pipefail

# Get the directory where this script lives
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

ENVIRONMENT="${1:-staging}"

# Clear any existing AWS credentials to avoid conflicts
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE 2>/dev/null || true

# Set up AWS credentials based on environment
if [ "$ENVIRONMENT" = "staging" ]; then
  # Staging: read credentials from repo root .env file
  if [ -f "$SCRIPT_DIR/../../.env" ]; then
    set -a
    source "$SCRIPT_DIR/../../.env"
    set +a
  else
    echo "Error: .env file not found at repo root (required for staging credentials)"
    exit 1
  fi
else
  # Production: use AWS CLI credentials
  eval "$(aws configure export-credentials --format env)"
fi

# Configuration per environment
case "$ENVIRONMENT" in
  staging)
    CLUSTER="graphene-prod"
    SNS_TOPIC="arn:aws:sns:us-east-1:025223626139:graphene-db-shell-access"
    ;;
  production)
    CLUSTER="graphene-prod"
    SNS_TOPIC="arn:aws:sns:us-east-1:034362047778:graphene-db-shell-access"
    ;;
  *)
    echo "Usage: $0 [staging|production]"
    exit 1
    ;;
esac

TASK_DEFINITION="graphene-db-shell"
CONTAINER_NAME="db-shell"
SUBNETS=$(aws ec2 describe-subnets --filters "Name=default-for-az,Values=true" --query 'Subnets[*].SubnetId' --output text | tr '\t' ',')
SECURITY_GROUP=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=graphene-ecs-sg" --query 'SecurityGroups[0].GroupId' --output text)

# Get caller identity for audit
CALLER_IDENTITY=$(aws sts get-caller-identity --output json)
USER_ARN=$(echo "$CALLER_IDENTITY" | jq -r '.Arn')
ACCOUNT_ID=$(echo "$CALLER_IDENTITY" | jq -r '.Account')

echo "Starting db-shell session..."
echo "  Environment: $ENVIRONMENT"
echo "  User: $USER_ARN"
echo "  Cluster: $CLUSTER"

# Notify SNS before connecting
echo "Sending SNS notification..."
aws sns publish \
  --topic-arn "$SNS_TOPIC" \
  --subject "DB Shell Access: $ENVIRONMENT" \
  --message "$(cat <<EOF
Database shell access initiated.

Environment: $ENVIRONMENT
User: $USER_ARN
Account: $ACCOUNT_ID
Time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")
Cluster: $CLUSTER

This is an audit notification. If this access was not expected, investigate immediately.
EOF
)"

echo "SNS notification sent."

# Run the task
echo "Starting ECS task..."
TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$TASK_DEFINITION" \
  --launch-type FARGATE \
  --enable-execute-command \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SECURITY_GROUP],assignPublicIp=ENABLED}" \
  --query 'tasks[0].taskArn' \
  --output text)

echo "Task started: $TASK_ARN"

# Wait for task to be running
echo "Waiting for task to be running..."
aws ecs wait tasks-running --cluster "$CLUSTER" --tasks "$TASK_ARN"

# Wait for ECS Exec agent to be ready (can take 30-60 seconds after task starts)
echo "Waiting for execute command agent..."
for i in {1..60}; do
  # Check all containers for a running ExecuteCommandAgent (container order varies)
  AGENT_STATUSES=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ARN" \
    --query "tasks[0].containers[*].managedAgents[0].lastStatus" \
    --output text 2>/dev/null || echo "PENDING")
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
  aws ecs stop-task --cluster "$CLUSTER" --task "$TASK_ARN" --reason "execute command agent failed" > /dev/null
  exit 1
fi

echo "Connecting to psql..."
echo "Type \\q to exit psql, then the container will be stopped."
echo ""

# Connect via ECS Exec - run psql directly
# Use sh -c to ensure DATABASE_URL is expanded inside the container
aws ecs execute-command \
  --cluster "$CLUSTER" \
  --task "$TASK_ARN" \
  --container "$CONTAINER_NAME" \
  --interactive \
  --command 'sh -c "psql \$DATABASE_URL"'

# Cleanup: stop the task when done
echo ""
echo "Stopping task..."
aws ecs stop-task --cluster "$CLUSTER" --task "$TASK_ARN" --reason "db-shell session ended" > /dev/null

echo "Task stopped. Session complete."
