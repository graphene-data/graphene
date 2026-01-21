# ECS Express Mode service (replaces App Runner)
resource "aws_ecs_express_gateway_service" "cloud" {
  service_name            = "graphene-cloud"
  cluster                 = aws_ecs_cluster.main.name
  execution_role_arn      = aws_iam_role.ecs_execution.arn
  infrastructure_role_arn = aws_iam_role.ecs_infrastructure.arn

  cpu               = "1024"
  memory            = "2048"
  health_check_path = "/"

  # Workaround for provider bug: AWS returns env vars in different order than sent
  # https://github.com/hashicorp/terraform-provider-aws/issues/XXXXX
  lifecycle {
    ignore_changes = [primary_container]
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
      value = var.stytch_prod_domain
    }
    environment {
      name  = "STYTCH_PROJECT_ID"
      value = var.stytch_prod_project_id
    }
    environment {
      name  = "TURSO_DATABASE_URL"
      value = var.turso_database_url
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
      name       = "TURSO_AUTH_TOKEN"
      value_from = aws_secretsmanager_secret.turso_auth_token.arn
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
