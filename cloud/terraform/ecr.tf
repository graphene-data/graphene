# ECR Repository for Docker images
resource "aws_ecr_repository" "cloud" {
  name                 = "graphene/cloud"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = false
  }

  encryption_configuration {
    encryption_type = "AES256"
  }
}
