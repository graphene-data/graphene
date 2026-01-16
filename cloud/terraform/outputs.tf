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

output "delve_auditor_role_arn" {
  description = "ARN of the Delve auditor role"
  value       = aws_iam_role.delve_auditor.arn
}

# ECS Express Mode Outputs
output "ecs_service_url" {
  description = "URL of the ECS Express service (for testing before DNS switch)"
  value       = "https://${aws_ecs_express_gateway_service.cloud.ingress_paths[0].endpoint}"
}

output "ecs_alb_endpoint" {
  description = "ALB endpoint - point your external DNS here"
  value       = aws_ecs_express_gateway_service.cloud.ingress_paths[0].endpoint
}

output "ecs_service_arn" {
  description = "ARN of the ECS Express service"
  value       = aws_ecs_express_gateway_service.cloud.service_arn
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
