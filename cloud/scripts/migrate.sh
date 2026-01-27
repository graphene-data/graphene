#!/bin/bash
# Run database migrations via ECS task
# Requires AWS credentials with ecs:RunTask, ecs:DescribeTasks, ec2:DescribeSubnets, ec2:DescribeSecurityGroups

set -e

CLUSTER="graphene-prod"
TASK_DEFINITION="graphene-db-migrate"
REGION="${AWS_REGION:-us-east-1}"

# Get network config (same subnets/sg as the main ECS service)
SUBNETS=$(aws ec2 describe-subnets --filters "Name=default-for-az,Values=true" \
  --query 'Subnets[0:2].SubnetId' --output text --region "$REGION" | tr '\t' ',')
SG=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=graphene-ecs-sg" \
  --query 'SecurityGroups[0].GroupId' --output text --region "$REGION")

echo "Starting migration task..."
TASK_ARN=$(aws ecs run-task \
  --cluster "$CLUSTER" \
  --task-definition "$TASK_DEFINITION" \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNETS],securityGroups=[$SG],assignPublicIp=ENABLED}" \
  --region "$REGION" \
  --query 'tasks[0].taskArn' \
  --output text)

TASK_ID=$(echo "$TASK_ARN" | cut -d'/' -f3)
echo "Task started: $TASK_ID"
echo "Waiting for task to complete..."

aws ecs wait tasks-stopped --cluster "$CLUSTER" --tasks "$TASK_ID" --region "$REGION"

EXIT_CODE=$(aws ecs describe-tasks --cluster "$CLUSTER" --tasks "$TASK_ID" --region "$REGION" \
  --query 'tasks[0].containers[?name==`migrate`].exitCode' --output text)

if [ "$EXIT_CODE" != "0" ]; then
  echo "Migration failed with exit code $EXIT_CODE"
  echo "Logs:"
  aws logs get-log-events --log-group-name /ecs/graphene-prod \
    --log-stream-name "db-migrate/migrate/$TASK_ID" \
    --region "$REGION" \
    --query 'events[*].message' --output text
  exit 1
fi

echo "Migration completed successfully"
