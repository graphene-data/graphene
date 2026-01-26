# ECR Repository for Docker images
resource "aws_ecr_repository" "cloud" {
  name                 = "graphene/cloud"
  image_tag_mutability = "MUTABLE"

  encryption_configuration {
    encryption_type = "AES256"
  }
}

# Enable enhanced scanning (Amazon Inspector) for ECR
resource "aws_ecr_registry_scanning_configuration" "enhanced_scanning" {
  scan_type = "ENHANCED"

  rule {
    scan_frequency = "CONTINUOUS_SCAN"
    repository_filter {
      filter      = "graphene/*"
      filter_type = "WILDCARD"
    }
  }
}
