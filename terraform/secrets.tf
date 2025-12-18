# Individual secrets for the cloud application
# App Runner references these directly by ARN

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
