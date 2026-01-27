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

  cpu               = "1024"
  memory            = "2048"
  health_check_path = "/"

  network_configuration {
    subnets         = data.aws_subnets.default.ids
    security_groups = [aws_security_group.ecs.id]
  }

  # Workaround for provider bug: AWS returns env vars in different order than sent
  # https://github.com/hashicorp/terraform-provider-aws/issues/XXXXX
  lifecycle {
    ignore_changes = [primary_container, network_configuration, task_role_arn]
  }

  primary_container {
    image          = "${aws_ecr_repository.cloud.repository_url}:latest"
    container_port = 3000

    aws_logs_configuration = [{
      log_group         = aws_cloudwatch_log_group.cloud.name
      log_stream_prefix = "ecs"
    }]

    environment {
      name  = "STYTCH_DOMAIN"
      value = var.stytch_domain
    }
    environment {
      name  = "STYTCH_PROJECT_ID"
      value = var.stytch_project_id
    }
    secret {
      name       = "DATABASE_URL"
      value_from = aws_secretsmanager_secret.database_url.arn
    }
    environment {
      name  = "GITHUB_APP_SLUG"
      value = var.github_app_slug
    }
    environment {
      name  = "GITHUB_APP_ID"
      value = var.github_app_id
    }
    environment {
      name  = "GITHUB_APP_CLIENT_ID"
      value = var.github_app_client_id
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

  lifecycle {
    ignore_changes = [configuration]
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

resource "aws_ecs_task_definition" "db_shell" {
  family                   = "graphene-db-shell"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "db-shell"
    image     = "postgres:16-alpine"
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
        "awslogs-stream-prefix" = "db-shell"
      }
    }
  }])
}

# =============================================================================
# DB Migration Task (one-off task to run drizzle migrations)
# =============================================================================

resource "aws_ecs_task_definition" "db_migrate" {
  family                   = "graphene-db-migrate"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  execution_role_arn       = aws_iam_role.ecs_execution.arn

  container_definitions = jsonencode([{
    name      = "migrate"
    image     = "${aws_ecr_repository.cloud.repository_url}:latest"
    essential = true
    command   = ["node", "server/migrate.ts"]
    secrets = [{
      name      = "DATABASE_URL"
      valueFrom = aws_secretsmanager_secret.database_url.arn
    }]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.cloud.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "db-migrate"
      }
    }
  }])
}

# =============================================================================
# DB Shell Access Notifications
# =============================================================================

resource "aws_sns_topic" "db_shell_access" {
  name = "graphene-db-shell-access"
}

resource "aws_sns_topic_subscription" "db_shell_access_email" {
  topic_arn = aws_sns_topic.db_shell_access.arn
  protocol  = "email"
  endpoint  = var.alarm_notification_email
}
