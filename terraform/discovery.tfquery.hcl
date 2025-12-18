# Terraform Search queries for discovering existing resources
# Requires Terraform 1.14.0+ (currently in beta)
#
# Usage:
#   terraform query                                    # List discovered resources
#   terraform query -generate-config-out=imported.tf  # Generate import blocks
#
# Note: AWS provider currently only supports: aws_instance, aws_iam_role, aws_cloudwatch_log_group

# provider "aws" {
#   region = "us-east-1"
# }

# Discover IAM roles related to graphene/apprunner/ci
list "aws_iam_role" "graphene_roles" {
  provider = aws

  config {
    # Filter to roles with names containing relevant prefixes
    # Unfortunately AWS IAM roles don't support tag-based filtering in list
  }
}

list "aws_iam_policy" "graphene_policies" {
  provider = aws
}

list "aws_secretsmanager_secret" "secrets" {
  provider = aws
}

# Once more resources are supported by the AWS provider, you can add:
#
# list "aws_ecr_repository" "all" {
#   provider = aws
# }

# list "aws_apprunner_service" "all" {
#   provider = aws
# }

# list "aws_secretsmanager_secret" "all" {
#   provider = aws
# }
