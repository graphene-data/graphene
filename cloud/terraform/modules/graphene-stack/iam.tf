# =============================================================================
# GitHub OIDC Provider (for GitHub Actions to assume roles)
# =============================================================================
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
      Effect    = "Allow"
      Principal = { Federated = aws_iam_openid_connect_provider.github.arn }
      Action    = "sts:AssumeRoleWithWebIdentity"
      Condition = {
        StringEquals = {
          "token.actions.githubusercontent.com:aud"        = "sts.amazonaws.com"
          "token.actions.githubusercontent.com:repository" = "graphene-data/co"
        }
        StringLike = {
          "token.actions.githubusercontent.com:sub" = "repo:graphene-data/co:*"
        }
      }
    }]
  })
}

# Inline policy for CI to push to ECR, manage ECS deployments, and deploy Lambda functions
resource "aws_iam_role_policy" "ci_deploy_ecr" {
  name = "ecr-push-and-ecs-deploy"
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
      },
      {
        Effect = "Allow"
        Action = [
          "ecs:UpdateService",
          "ecs:DescribeServices",
          "ecs:DescribeClusters",
          "ecs:RegisterTaskDefinition"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "ec2:DescribeSubnets",
          "ec2:DescribeSecurityGroups"
        ]
        Resource = "*"
      },
      {
        # db-ops task: find running task, check image, start if needed
        Effect = "Allow"
        Action = [
          "ecs:ListTasks",
          "ecs:DescribeTasks",
          "ecs:RunTask",
          "ecs:StopTask",
          "ecs:ExecuteCommand"
        ]
        Resource = "*"
        Condition = {
          ArnEquals = {
            "ecs:cluster" = aws_ecs_cluster.main.arn
          }
        }
      },
      {
        Effect   = "Allow"
        Action   = ["ecr:DescribeImages"]
        Resource = aws_ecr_repository.cloud.arn
      },
      {
        Effect   = "Allow"
        Action   = ["iam:PassRole"]
        Resource = [aws_iam_role.ecs_execution.arn, aws_iam_role.ecs_task.arn]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject"
        ]
        Resource = "${aws_s3_bucket.lambda_deployments.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.website.arn
      },
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject",
          "s3:GetObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.website.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "cloudfront:CreateInvalidation",
          "cloudfront:GetDistribution",
          "cloudfront:ListDistributions"
        ]
        Resource = "*"
      },
      {
        Effect = "Allow"
        Action = [
          "lambda:UpdateFunctionCode",
          "lambda:GetFunction",
          "lambda:GetFunctionConfiguration"
        ]
        Resource = [
          aws_lambda_function.screenshot.arn,
          "${aws_lambda_function.screenshot.arn}:*"
        ]
      }
    ]
  })
}

# ECS Execution Role - used by the ECS agent *before* the container starts.
# Needs permissions to pull images from ECR, send logs to CloudWatch, and fetch secrets from Secrets Manager.
resource "aws_iam_role" "ecs_execution" {
  name = "ecs-execution-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role_policy" "ecs_execution_secrets" {
  name = "secrets-access"
  role = aws_iam_role.ecs_execution.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = ["secretsmanager:GetSecretValue"]
        Resource = [
          aws_secretsmanager_secret.agent_token_secret.arn,
          aws_secretsmanager_secret.stytch_secret.arn,
          aws_secretsmanager_secret.database_url.arn,
          aws_secretsmanager_secret.github_webhook_secret.arn,
          aws_secretsmanager_secret.github_app_client_secret.arn,
          aws_secretsmanager_secret.github_app_private_key.arn
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Decrypt"]
        Resource = data.aws_kms_alias.secretsmanager.target_key_arn
      },
      {
        Effect   = "Allow"
        Action   = ["kms:Encrypt", "kms:Decrypt"]
        Resource = aws_kms_key.secrets.arn
      },
      {
        Effect   = "Allow"
        Action   = ["lambda:InvokeFunction"]
        Resource = aws_lambda_function.screenshot.arn
      }
    ]
  })
}

# Delve Auditor Role - allows Delve to audit AWS resources
resource "aws_iam_role" "delve_auditor" {
  count                = var.enable_delve_auditor ? 1 : 0
  name                 = "DelveAuditor"
  max_session_duration = 43200

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { AWS = "arn:aws:iam::017820694923:root" }
      Action    = "sts:AssumeRole"
      Condition = {}
    }]
  })
}

resource "aws_iam_role_policy_attachment" "delve_auditor_readonly" {
  count      = var.enable_delve_auditor ? 1 : 0
  role       = aws_iam_role.delve_auditor[0].name
  policy_arn = "arn:aws:iam::aws:policy/ReadOnlyAccess"
}
