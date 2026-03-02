# AWS-managed KMS keys (created automatically by AWS services)
data "aws_kms_alias" "secretsmanager" {
  name = "alias/aws/secretsmanager"
}

# KMS key for encrypting user secrets (database credentials, etc)
resource "aws_kms_key" "secrets" {
  description         = "Encrypts user-provided secrets like database credentials"
  enable_key_rotation = true

  tags = {
    Name        = "graphene-secrets"
    Environment = "production"
    Workload    = "cloud-application"
    Purpose     = "secrets-encryption"
  }

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowKeyManagement"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${var.aws_account_id}:root"
        }
        Action = [
          "kms:PutKeyPolicy",
          "kms:GetKeyPolicy",
          "kms:GetKeyRotationStatus",
          "kms:ListResourceTags",
          "kms:DescribeKey",
          "kms:EnableKeyRotation",
          "kms:DisableKeyRotation",
          "kms:ScheduleKeyDeletion",
          "kms:CancelKeyDeletion",
          "kms:TagResource",
          "kms:UntagResource",
          "kms:CreateAlias",
          "kms:DeleteAlias",
          "kms:UpdateAlias"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowECSExecutionRoleUsage"
        Effect = "Allow"
        Principal = {
          AWS = aws_iam_role.ecs_execution.arn
        }
        Action = [
          "kms:Encrypt",
          "kms:Decrypt",
          "kms:GenerateDataKey*",
          "kms:DescribeKey"
        ]
        Resource = "*"
      }
    ]
  })
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/graphene-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}

# Individual secrets for the cloud application

# Database password - auto-generated and managed by Secrets Manager
resource "random_password" "database" {
  length           = 32
  special          = true
  override_special = "-_" # Keep it simple for URL safety
}

# Store the full DATABASE_URL as a secret for ECS
resource "aws_secretsmanager_secret" "database_url" {
  name        = "DATABASE_URL"
  description = "Aurora PostgreSQL connection URL"
}

resource "aws_secretsmanager_secret_version" "database_url" {
  secret_id     = aws_secretsmanager_secret.database_url.id
  secret_string = "postgresql://${var.database_username}:${random_password.database.result}@${aws_rds_cluster.graphene.endpoint}:5432/${var.database_name}"
}

resource "aws_secretsmanager_secret" "stytch_secret" {
  name        = "STYTCH_SECRET"
  description = "Stytch API secret"
}

resource "aws_secretsmanager_secret_version" "stytch_secret" {
  secret_id     = aws_secretsmanager_secret.stytch_secret.id
  secret_string = stytch_secret.prod.secret
}

resource "aws_secretsmanager_secret" "github_webhook_secret" {
  name        = "GITHUB_WEBHOOK_SECRET"
  description = "GitHub webhook secret"
}

resource "aws_secretsmanager_secret_version" "github_webhook_secret" {
  secret_id     = aws_secretsmanager_secret.github_webhook_secret.id
  secret_string = "placeholder" # Managed manually in AWS console after initial deployment

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "github_app_client_secret" {
  name        = "GITHUB_APP_CLIENT_SECRET"
  description = "GitHub App client secret"
}

resource "aws_secretsmanager_secret_version" "github_app_client_secret" {
  secret_id     = aws_secretsmanager_secret.github_app_client_secret.id
  secret_string = "placeholder" # Managed manually in AWS console after initial deployment

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "github_app_private_key" {
  name        = "GITHUB_APP_PRIVATE_KEY"
  description = "GitHub App private key"
}

resource "aws_secretsmanager_secret_version" "github_app_private_key" {
  secret_id     = aws_secretsmanager_secret.github_app_private_key.id
  secret_string = "placeholder" # Managed manually in AWS console after initial deployment

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "slack_client_id" {
  name        = "SLACK_CLIENT_ID"
  description = "Slack OAuth client ID"
}

resource "aws_secretsmanager_secret_version" "slack_client_id" {
  secret_id     = aws_secretsmanager_secret.slack_client_id.id
  secret_string = "placeholder" # Managed manually in AWS console after initial deployment

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "slack_client_secret" {
  name        = "SLACK_CLIENT_SECRET"
  description = "Slack OAuth client secret"
}

resource "aws_secretsmanager_secret_version" "slack_client_secret" {
  secret_id     = aws_secretsmanager_secret.slack_client_secret.id
  secret_string = "placeholder" # Managed manually in AWS console after initial deployment

  lifecycle {
    ignore_changes = [secret_string]
  }
}

resource "aws_secretsmanager_secret" "slack_signing_secret" {
  name        = "SLACK_SIGNING_SECRET"
  description = "Slack signing secret for request verification"
}

resource "aws_secretsmanager_secret_version" "slack_signing_secret" {
  secret_id     = aws_secretsmanager_secret.slack_signing_secret.id
  secret_string = "placeholder" # Managed manually in AWS console after initial deployment

  lifecycle {
    ignore_changes = [secret_string]
  }
}

# Agent token secret - auto-generated for signing agent JWTs
resource "random_password" "agent_token_secret" {
  length  = 64
  special = false # Keep it simple for JWT signing
}

resource "aws_secretsmanager_secret" "agent_token_secret" {
  name        = "AGENT_TOKEN_SECRET"
  description = "Secret key for signing agent authentication JWTs"
}

resource "aws_secretsmanager_secret_version" "agent_token_secret" {
  secret_id     = aws_secretsmanager_secret.agent_token_secret.id
  secret_string = random_password.agent_token_secret.result
}
