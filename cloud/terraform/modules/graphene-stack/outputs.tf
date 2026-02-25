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

# ECS Service Outputs
output "ecs_service_url" {
  description = "URL of the ECS service ALB endpoint"
  value       = "https://${aws_lb.cloud.dns_name}"
}

output "ecs_alb_endpoint" {
  description = "ALB endpoint - point your external DNS here"
  value       = aws_lb.cloud.dns_name
}

output "ecs_service_arn" {
  description = "ARN of the ECS service"
  value       = aws_ecs_service.cloud.id
}

output "website_cloudfront_distribution_id" {
  description = "CloudFront distribution ID for website"
  value       = aws_cloudfront_distribution.website.id
}

output "website_cloudfront_domain_name" {
  description = "CloudFront domain name for website"
  value       = aws_cloudfront_distribution.website.domain_name
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

# DB Ops task outputs
output "db_ops_task_definition" {
  description = "Task definition ARN for db-ops (migrations and db-shell)"
  value       = aws_ecs_task_definition.db_ops.arn
}

output "db_ops_cluster" {
  description = "ECS cluster name for db-ops task"
  value       = aws_ecs_cluster.main.name
}

# ACM Certificate Outputs
output "acm_certificate_arn" {
  description = "ARN of the ACM wildcard certificate"
  value       = aws_acm_certificate.wildcard.arn
}

output "acm_certificate_domain_validation_options" {
  description = "DNS validation records needed for ACM certificate. Add these to your DNS provider to validate the certificate."
  value = {
    for dvo in aws_acm_certificate.wildcard.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      type   = dvo.resource_record_type
      record = dvo.resource_record_value
    }
  }
}

# Stytch Outputs
output "stytch_project_slug" {
  description = "Stytch project slug"
  value       = stytch_project.graphene.project_slug
}

output "stytch_public_token" {
  description = "Stytch public token for the production environment"
  value       = stytch_public_token.prod.public_token
}

output "stytch_secret_id" {
  description = "Stytch secret ID for the production environment"
  value       = stytch_secret.prod.secret_id
}

output "stytch_secret" {
  description = "Stytch secret for the production environment (for .env file)"
  value       = stytch_secret.prod.secret
  sensitive   = true
}
