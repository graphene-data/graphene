# ECR Outputs
output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.cloud.repository_url
}

output "ecr_repository_arn" {
  description = "ARN of the ECR repository"
  value       = aws_ecr_repository.cloud.arn
}

# IAM Outputs
output "ci_deploy_role_arn" {
  description = "ARN of the CI deploy role for GitHub Actions"
  value       = aws_iam_role.ci_deploy.arn
}

output "apprunner_instance_role_arn" {
  description = "ARN of the App Runner instance role"
  value       = aws_iam_role.apprunner_instance.arn
}

output "delve_auditor_role_arn" {
  description = "ARN of the Delve auditor role"
  value       = aws_iam_role.delve_auditor.arn
}

# App Runner Outputs
output "apprunner_service_url" {
  description = "URL of the App Runner service"
  value       = aws_apprunner_service.cloud.service_url
}

output "apprunner_service_arn" {
  description = "ARN of the App Runner service"
  value       = aws_apprunner_service.cloud.arn
}

# Secrets Manager Outputs
output "stytch_secret_arn" {
  description = "ARN of the Stytch secret"
  value       = aws_secretsmanager_secret.stytch_secret.arn
}

output "turso_auth_token_arn" {
  description = "ARN of the Turso auth token secret"
  value       = aws_secretsmanager_secret.turso_auth_token.arn
}
