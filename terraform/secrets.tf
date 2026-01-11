# AWS-managed KMS keys (created automatically by AWS services)
data "aws_kms_alias" "secretsmanager" {
  name = "alias/aws/secretsmanager"
}

# KMS key for encrypting user secrets (database credentials, etc)
resource "aws_kms_key" "secrets" {
  description         = "Encrypts user-provided secrets like database credentials"
  enable_key_rotation = true
}

resource "aws_kms_alias" "secrets" {
  name          = "alias/graphene-secrets"
  target_key_id = aws_kms_key.secrets.key_id
}

# Individual secrets for the cloud application

resource "aws_secretsmanager_secret" "turso_auth_token" {
  name        = "TURSO_AUTH_TOKEN"
  description = "Turso database auth token"
}

resource "aws_secretsmanager_secret_version" "turso_auth_token" {
  secret_id     = aws_secretsmanager_secret.turso_auth_token.id
  secret_string = var.turso_auth_token
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
  secret_string = var.github_webhook_secret
}

resource "aws_secretsmanager_secret" "github_app_client_secret" {
  name        = "GITHUB_APP_CLIENT_SECRET"
  description = "GitHub App client secret"
}

resource "aws_secretsmanager_secret_version" "github_app_client_secret" {
  secret_id     = aws_secretsmanager_secret.github_app_client_secret.id
  secret_string = var.github_app_client_secret
}

resource "aws_secretsmanager_secret" "github_app_private_key" {
  name        = "GITHUB_APP_PRIVATE_KEY"
  description = "GitHub App private key"
}

resource "aws_secretsmanager_secret_version" "github_app_private_key" {
  secret_id     = aws_secretsmanager_secret.github_app_private_key.id
  secret_string = var.github_app_private_key
}
