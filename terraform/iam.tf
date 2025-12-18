# GitHub OIDC Provider (for GitHub Actions to assume roles)
# Note: AWS manages thumbprints automatically for GitHub OIDC
resource "aws_iam_openid_connect_provider" "github" {
  url            = "https://token.actions.githubusercontent.com"
  client_id_list = ["sts.amazonaws.com"]
}

# CI Deploy Role - assumed by GitHub Actions for ECR push
resource "aws_iam_role" "ci_deploy" {
  name        = "ci-deploy"
  description = "Allows github actions to push new images to ECR and deploy them"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = { "token.actions.githubusercontent.com:aud" = "sts.amazonaws.com" }
        StringLike   = { "token.actions.githubusercontent.com:sub" = "repo:graphene-data/cloud:*" }
      }
    }]
  })
}

# Inline policy for CI to push to ECR
resource "aws_iam_role_policy" "ci_deploy_ecr" {
  name = "ecr-push"
  role = aws_iam_role.ci_deploy.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ecr:GetAuthorizationToken"]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ecr:BatchCheckLayerAvailability",
          "ecr:GetDownloadUrlForLayer",
          "ecr:BatchGetImage",
          "ecr:PutImage",
          "ecr:InitiateLayerUpload",
          "ecr:UploadLayerPart",
          "ecr:CompleteLayerUpload"
        ]
        Resource = aws_ecr_repository.cloud.arn
      }
    ]
  })
}

# App Runner ECR Access Role - allows App Runner to pull images from ECR
# Note: Uses AWS managed policy since that's required by App Runner
resource "aws_iam_role" "apprunner_ecr_access" {
  name        = "AppRunnerECRAccessRole"
  path        = "/service-role/"
  description = "This role gives App Runner permission to access ECR"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "build.apprunner.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "apprunner_ecr_access" {
  role       = aws_iam_role.apprunner_ecr_access.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"
}

# App Runner Instance Role - the role the running container assumes
resource "aws_iam_role" "apprunner_instance" {
  name = "app-runner-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "tasks.apprunner.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Inline policy for App Runner instance
resource "aws_iam_role_policy" "apprunner_instance_policy" {
  name = "apprunner-instance-policy"
  role = aws_iam_role.apprunner_instance.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [
          aws_secretsmanager_secret.stytch_secret.arn,
          aws_secretsmanager_secret.turso_auth_token.arn,
          aws_secretsmanager_secret.github_webhook_secret.arn,
          aws_secretsmanager_secret.github_app_client_secret.arn,
          aws_secretsmanager_secret.github_app_private_key.arn
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = "arn:aws:kms:us-east-1:772069004272:key/416d1be8-8f0d-47b9-abaf-7f9d5cad4e9d"
      }
    ]
  })
}
