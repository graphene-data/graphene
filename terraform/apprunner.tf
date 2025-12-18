# App Runner service (uses default auto-scaling config)
resource "aws_apprunner_service" "cloud" {
  service_name = "graphene-prod-us"

  source_configuration {
    authentication_configuration {
      access_role_arn = aws_iam_role.apprunner_ecr_access.arn
    }

    image_repository {
      image_configuration {
        port = "3000"

        runtime_environment_variables = {
          STYTCH_DOMAIN        = var.stytch_prod_domain
          STYTCH_PROJECT_ID    = var.stytch_prod_project_id
          TURSO_DATABASE_URL   = var.turso_database_url
          GITHUB_APP_SLUG      = var.github_app_slug
          GITHUB_APP_ID        = var.github_app_id
          GITHUB_APP_CLIENT_ID = var.github_app_client_id
        }

        runtime_environment_secrets = {
          STYTCH_SECRET            = aws_secretsmanager_secret.stytch_secret.arn
          TURSO_AUTH_TOKEN         = aws_secretsmanager_secret.turso_auth_token.arn
          GITHUB_WEBHOOK_SECRET    = aws_secretsmanager_secret.github_webhook_secret.arn
          GITHUB_APP_CLIENT_SECRET = aws_secretsmanager_secret.github_app_client_secret.arn
          GITHUB_APP_PRIVATE_KEY   = aws_secretsmanager_secret.github_app_private_key.arn
        }
      }

      image_identifier      = "${aws_ecr_repository.cloud.repository_url}:latest"
      image_repository_type = "ECR"
    }

    auto_deployments_enabled = true
  }

  instance_configuration {
    cpu               = "1024"
    memory            = "2048"
    instance_role_arn = aws_iam_role.apprunner_instance.arn
  }

  health_check_configuration {
    protocol            = "TCP"
    path                = "/"
    interval            = 10
    timeout             = 5
    healthy_threshold   = 1
    unhealthy_threshold = 5
  }

  network_configuration {
    egress_configuration {
      egress_type = "DEFAULT"
    }
  }

  observability_configuration {
    observability_enabled = false
  }
}

resource "aws_apprunner_custom_domain_association" "cloud" {
  domain_name          = "*.graphenedata.com"
  service_arn          = aws_apprunner_service.cloud.arn
  enable_www_subdomain = false
}
