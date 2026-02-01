# Security Group for ECS tasks
resource "aws_security_group" "ecs" {
  name        = "graphene-ecs-sg"
  description = "Security group for Graphene ECS tasks"
  vpc_id      = data.aws_vpc.default.id

  # Allow all outbound for external services (GitHub, Stytch, Aurora, etc.)
  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "Graphene ECS Security Group"
  }
}

# ECS Express Mode service
resource "aws_ecs_express_gateway_service" "cloud" {
  service_name            = "graphene-cloud"
  cluster                 = aws_ecs_cluster.main.name
  execution_role_arn      = aws_iam_role.ecs_execution.arn
  infrastructure_role_arn = aws_iam_role.ecs_infrastructure.arn
  task_role_arn           = aws_iam_role.ecs_task.arn

  cpu               = "1024"
  memory            = "2048"
  health_check_path = "/"

  network_configuration {
    subnets         = data.aws_subnets.default.ids
    security_groups = [aws_security_group.ecs.id]
  }

  primary_container {
    image          = "${aws_ecr_repository.cloud.repository_url}:latest"
    container_port = 3000
    command        = []

    aws_logs_configuration = [{
      log_group         = aws_cloudwatch_log_group.cloud.name
      log_stream_prefix = "ecs"
    }]

    # Adding new vars might cause "Provider produced inconsistent result after apply": https://github.com/hashicorp/terraform-provider-aws/issues/45792
    # The "solution" is to put these vars in the same order that aws responds with.
    environment {
      name  = "GITHUB_APP_SLUG"
      value = var.github_app_slug
    }
    environment {
      name  = "GITHUB_APP_ID"
      value = var.github_app_id
    }
    environment {
      name  = "DOMAIN"
      value = var.domain_name
    }
    environment {
      name  = "STYTCH_PROJECT_ID"
      value = var.stytch_project_id
    }
    environment {
      name  = "GITHUB_APP_CLIENT_ID"
      value = var.github_app_client_id
    }
    environment {
      name  = "STYTCH_DOMAIN"
      value = var.stytch_domain
    }
    secret {
      name       = "DATABASE_URL"
      value_from = aws_secretsmanager_secret.database_url.arn
    }
    secret {
      name       = "STYTCH_SECRET"
      value_from = aws_secretsmanager_secret.stytch_secret.arn
    }
    secret {
      name       = "GITHUB_APP_WEBHOOK_SECRET"
      value_from = aws_secretsmanager_secret.github_webhook_secret.arn
    }
    secret {
      name       = "GITHUB_APP_CLIENT_SECRET"
      value_from = aws_secretsmanager_secret.github_app_client_secret.arn
    }
    secret {
      name       = "GITHUB_APP_PRIVATE_KEY"
      value_from = aws_secretsmanager_secret.github_app_private_key.arn
    }
  }
}

resource "aws_ecs_cluster" "main" {
  name = "graphene-prod"

  setting {
    name  = "containerInsights"
    value = "enhanced"
  }
}

resource "aws_cloudwatch_log_group" "cloud" {
  name              = "/ecs/graphene-prod"
  retention_in_days = 30
}

# =============================================================================
# ECS Exec Support (for debugging/shell access to containers)
# =============================================================================

resource "aws_cloudwatch_log_group" "ecs_exec" {
  name              = "/ecs/graphene-prod/exec"
  retention_in_days = 90
}

# ECS Task Role - used by running containers for AWS API calls
resource "aws_iam_role" "ecs_task" {
  name = "ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_exec" {
  name = "ecs-exec-ssm"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ssmmessages:CreateControlChannel",
          "ssmmessages:CreateDataChannel",
          "ssmmessages:OpenControlChannel",
          "ssmmessages:OpenDataChannel"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "${aws_cloudwatch_log_group.ecs_exec.arn}:*"
      }
    ]
  })
}

# =============================================================================
# DB Ops Task - on-demand task for db-shell and migrations
# =============================================================================
# Uses app image so it has both psql and node/drizzle available.
# Default command is sleep infinity (for interactive db-shell), but callers
# can override the command for one-shot operations like migrations.

resource "aws_ecs_task_definition" "db_ops" {
  family                   = "graphene-db-ops"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "db-ops"
    image     = "${aws_ecr_repository.cloud.repository_url}:latest"
    essential = true
    command   = ["sleep", "infinity"]
    secrets = [{
      name      = "DATABASE_URL"
      valueFrom = aws_secretsmanager_secret.database_url.arn
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.cloud.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "db-ops"
      }
    }
  }])
}

# =============================================================================
# DB Shell Access Notifications
# =============================================================================

resource "aws_sns_topic" "db_shell_access" {
  name              = "graphene-db-shell-access"
  kms_master_key_id = aws_kms_key.sns.id
}

resource "aws_sns_topic_subscription" "db_shell_access_email" {
  topic_arn = aws_sns_topic.db_shell_access.arn
  protocol  = "email"
  endpoint  = var.alarm_notification_email
}

# EventBridge rule to notify SNS when db-ops task starts
resource "aws_cloudwatch_event_rule" "db_shell_started" {
  name        = "graphene-db-ops-started"
  description = "Triggers when a db-ops ECS task is started"

  event_pattern = jsonencode({
    source      = ["aws.ecs"]
    detail-type = ["ECS Task State Change"]
    detail = {
      clusterArn        = [aws_ecs_cluster.main.arn]
      lastStatus        = ["RUNNING"]
      taskDefinitionArn = [{ prefix = "arn:aws:ecs:${var.aws_region}:${data.aws_caller_identity.current.account_id}:task-definition/graphene-db-ops" }]
    }
  })
}

resource "aws_cloudwatch_event_target" "db_shell_sns" {
  rule      = aws_cloudwatch_event_rule.db_shell_started.name
  target_id = "db-shell-sns-notification"
  arn       = aws_sns_topic.db_shell_access.arn

  input_transformer {
    input_paths = {
      taskArn   = "$.detail.taskArn"
      startedBy = "$.detail.startedBy"
      time      = "$.time"
    }
    input_template = <<-EOF
      "DB ops task started.\n\nTask: <taskArn>\nStarted by: <startedBy>\nTime: <time>\n\nThis is an audit notification. If this access was not expected, investigate immediately."
    EOF
  }
}

# Allow EventBridge to publish to the SNS topic
resource "aws_sns_topic_policy" "db_shell_access" {
  arn = aws_sns_topic.db_shell_access.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridgePublish"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "sns:Publish"
        Resource = aws_sns_topic.db_shell_access.arn
        Condition = {
          ArnLike = {
            "aws:SourceArn" = aws_cloudwatch_event_rule.db_shell_started.arn
          }
        }
      },
      {
        Sid    = "AllowAccountOwner"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "sns:GetTopicAttributes",
          "sns:SetTopicAttributes",
          "sns:AddPermission",
          "sns:RemovePermission",
          "sns:DeleteTopic",
          "sns:Subscribe",
          "sns:ListSubscriptionsByTopic",
          "sns:Publish"
        ]
        Resource = aws_sns_topic.db_shell_access.arn
      }
    ]
  })
}
