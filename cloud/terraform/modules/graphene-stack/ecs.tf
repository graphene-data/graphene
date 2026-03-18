# Security Group for ALB
resource "aws_security_group" "alb" {
  name        = "graphene-alb-sg"
  description = "Security group for Graphene ALB"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description = "Allow HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "Allow HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "Graphene ALB Security Group"
  }
}

# Security Group for ECS tasks
resource "aws_security_group" "ecs" {
  name        = "graphene-ecs-sg"
  description = "Security group for Graphene ECS tasks"
  vpc_id      = data.aws_vpc.default.id

  ingress {
    description     = "Allow app traffic from ALB"
    from_port       = 3000
    to_port         = 3000
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

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

resource "aws_lb" "cloud" {
  name               = "graphene-cloud-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = data.aws_subnets.default.ids
}

resource "aws_lb_target_group" "cloud" {
  name        = "graphene-cloud-tg"
  port        = 3000
  protocol    = "HTTP"
  target_type = "ip"
  vpc_id      = data.aws_vpc.default.id

  health_check {
    path                = "/_health"
    protocol            = "HTTP"
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 5
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.cloud.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.cloud.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-Res-2021-06"
  certificate_arn   = aws_acm_certificate.wildcard.arn

  default_action {
    type = "fixed-response"

    fixed_response {
      content_type = "text/plain"
      message_body = "Not found"
      status_code  = "404"
    }
  }
}

resource "aws_lb_listener_rule" "cloud" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.cloud.arn
  }

  condition {
    host_header {
      values = [var.domain_name, "*.${var.domain_name}"]
    }
  }
}

resource "aws_ecs_task_definition" "cloud" {
  family                   = "graphene-cloud-v3"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "1024"
  memory                   = "2048"
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([{
    name      = "cloud"
    image     = "${aws_ecr_repository.cloud.repository_url}:latest"
    essential = true
    portMappings = [{
      containerPort = 3000
      hostPort      = 3000
      protocol      = "tcp"
    }]
    environment = [
      { name = "GITHUB_APP_SLUG", value = var.github_app_slug },
      { name = "GITHUB_APP_ID", value = var.github_app_id },
      { name = "DOMAIN", value = var.domain_name },
      { name = "STYTCH_PROJECT_ID", value = var.stytch_project_id },
      { name = "GITHUB_APP_CLIENT_ID", value = var.github_app_client_id },
      { name = "STYTCH_DOMAIN", value = var.stytch_domain }
    ]
    secrets = [
      { name = "AGENT_TOKEN_SECRET", valueFrom = aws_secretsmanager_secret.agent_token_secret.arn },
      { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.database_url.arn },
      { name = "GITHUB_APP_CLIENT_SECRET", valueFrom = aws_secretsmanager_secret.github_app_client_secret.arn },
      { name = "GITHUB_APP_PRIVATE_KEY", valueFrom = aws_secretsmanager_secret.github_app_private_key.arn },
      { name = "GITHUB_APP_WEBHOOK_SECRET", valueFrom = aws_secretsmanager_secret.github_webhook_secret.arn },
      { name = "SLACK_CLIENT_ID", valueFrom = aws_secretsmanager_secret.slack_client_id.arn },
      { name = "SLACK_CLIENT_SECRET", valueFrom = aws_secretsmanager_secret.slack_client_secret.arn },
      { name = "SLACK_SIGNING_SECRET", valueFrom = aws_secretsmanager_secret.slack_signing_secret.arn },
      { name = "ANTHROPIC_API_KEY", valueFrom = aws_secretsmanager_secret.anthropic_api_key.arn },
      { name = "STYTCH_SECRET", valueFrom = aws_secretsmanager_secret.stytch_secret.arn }
    ]
    logConfiguration = {
      logDriver = "awslogs"
      options = {
        "awslogs-group"         = aws_cloudwatch_log_group.cloud.name
        "awslogs-region"        = var.aws_region
        "awslogs-stream-prefix" = "ecs"
      }
    }
  }])
}

resource "aws_ecs_service" "cloud" {
  name                              = "graphene-cloud-v3"
  cluster                           = aws_ecs_cluster.main.id
  task_definition                   = aws_ecs_task_definition.cloud.arn
  desired_count                     = 1
  launch_type                       = "FARGATE"
  health_check_grace_period_seconds = 30
  enable_execute_command            = true

  network_configuration {
    subnets          = data.aws_subnets.default.ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.cloud.arn
    container_name   = "cloud"
    container_port   = 3000
  }

  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }

  depends_on = [aws_lb_listener_rule.cloud]
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
