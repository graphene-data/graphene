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
  value       = var.enable_delve_auditor ? aws_iam_role.delve_auditor[0].arn : null
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

output "database_url_secret_arn" {
  description = "ARN of the DATABASE_URL secret"
  value       = aws_secretsmanager_secret.database_url.arn
}

output "ecs_execution_role_arn" {
  description = "ARN of the ECS execution role"
  value       = aws_iam_role.ecs_execution.arn
}

output "db_shell_sns_topic_arn" {
  description = "ARN of the SNS topic for db-shell access notifications"
  value       = aws_sns_topic.db_shell_access.arn
}

# Migration task outputs - for CI to run migrations
output "migrate_task_definition" {
  description = "Task definition ARN for running migrations"
  value       = aws_ecs_task_definition.db_migrate.arn
}

output "migrate_cluster" {
  description = "ECS cluster name for running migrations"
  value       = aws_ecs_cluster.main.name
}

output "migrate_subnets" {
  description = "Subnets for running migration task"
  value       = join(",", data.aws_subnets.default.ids)
}

output "migrate_security_group" {
  description = "Security group for running migration task"
  value       = aws_security_group.ecs.id
}
