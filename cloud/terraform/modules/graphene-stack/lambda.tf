# Lambda function for screenshot capture using Chrome
# Uses pre-built Chrome layer from shelfio/chrome-aws-lambda-layer

locals {
  # Layer ARN from https://github.com/shelfio/chrome-aws-lambda-layer
  # Chromium v143.0.4 for x86_64 in us-east-1
  chrome_layer_arn = "arn:aws:lambda:us-east-1:764866452798:layer:chrome-aws-lambda-x64:2"
}

# S3 bucket for Lambda deployment packages
resource "aws_s3_bucket" "lambda_deployments" {
  bucket = "graphene-lambda-deployments-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "lambda_deployments" {
  bucket = aws_s3_bucket.lambda_deployments.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "lambda_deployments" {
  bucket = aws_s3_bucket.lambda_deployments.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# IAM role for the screenshot Lambda function
resource "aws_iam_role" "lambda_screenshot" {
  name = "lambda-screenshot-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# Basic Lambda execution policy (CloudWatch Logs)
resource "aws_iam_role_policy_attachment" "lambda_screenshot_basic" {
  role       = aws_iam_role.lambda_screenshot.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# CloudWatch Log Group for Lambda
resource "aws_cloudwatch_log_group" "lambda_screenshot" {
  name              = "/aws/lambda/graphene-screenshot"
  retention_in_days = 30
}

# Lambda function
resource "aws_lambda_function" "screenshot" {
  function_name = "graphene-screenshot"
  description   = "Takes screenshots of web pages using Chrome/Playwright"
  role          = aws_iam_role.lambda_screenshot.arn
  handler       = "handler.handler"
  runtime       = "nodejs22.x"
  architectures = ["x86_64"]
  memory_size   = 1536
  timeout       = 60

  # Deployment package will be uploaded via CI/CD
  s3_bucket = aws_s3_bucket.lambda_deployments.id
  s3_key    = "screenshot/function.zip"

  layers = [local.chrome_layer_arn]

  depends_on = [
    aws_cloudwatch_log_group.lambda_screenshot,
    aws_iam_role_policy_attachment.lambda_screenshot_basic
  ]
}

# Data source to get current AWS account ID
data "aws_caller_identity" "current" {}

# Output the Lambda function ARN for reference
output "screenshot_lambda_arn" {
  value       = aws_lambda_function.screenshot.arn
  description = "ARN of the screenshot Lambda function"
}

# =============================================================================
# CloudWatch Alarms for Lambda Monitoring (SOC2 Compliance)
# =============================================================================

# KMS key for SNS topic encryption
resource "aws_kms_key" "sns_lambda_alarms" {
  description             = "KMS key for Lambda alarms SNS topic"
  deletion_window_in_days = 7
  enable_key_rotation     = true

  tags = {
    Name        = "sns-lambda-alarms"
    Environment = "production"
    Workload    = "monitoring"
    Purpose     = "sns-topic-encryption"
  }

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowKeyManagement"
        Effect = "Allow"
        Principal = {
          AWS = "arn:aws:iam::${data.aws_caller_identity.current.account_id}:root"
        }
        Action = [
          "kms:PutKeyPolicy",
          "kms:GetKeyPolicy",
          "kms:GetKeyRotationStatus",
          "kms:ListResourceTags",
          "kms:DescribeKey",
          "kms:EnableKeyRotation",
          "kms:DisableKeyRotation",
          "kms:ScheduleKeyDeletion",
          "kms:CancelKeyDeletion",
          "kms:TagResource",
          "kms:UntagResource",
          "kms:CreateAlias",
          "kms:DeleteAlias",
          "kms:UpdateAlias"
        ]
        Resource = "*"
      },
      {
        Sid    = "AllowCloudWatchAlarms"
        Effect = "Allow"
        Principal = {
          Service = "cloudwatch.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      },
      {
        Sid    = "AllowSNSUsage"
        Effect = "Allow"
        Principal = {
          Service = "sns.amazonaws.com"
        }
        Action = [
          "kms:Decrypt",
          "kms:GenerateDataKey*"
        ]
        Resource = "*"
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
        }
      }
    ]
  })
}

resource "aws_kms_alias" "sns_lambda_alarms" {
  name          = "alias/sns-lambda-alarms"
  target_key_id = aws_kms_key.sns_lambda_alarms.key_id
}

# SNS Topic for Lambda alarm notifications
resource "aws_sns_topic" "lambda_alarms" {
  name              = "graphene-lambda-alarms"
  kms_master_key_id = aws_kms_key.sns_lambda_alarms.id
}

# Email subscription for Lambda alarm notifications
resource "aws_sns_topic_subscription" "lambda_alarms_email" {
  topic_arn = aws_sns_topic.lambda_alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_notification_email
}

# Alarm: Lambda Errors
# Triggers when the function encounters errors during execution
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  alarm_name          = "graphene-screenshot-errors"
  alarm_description   = "Lambda function execution errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.screenshot.function_name
  }

  alarm_actions = [aws_sns_topic.lambda_alarms.arn]
  ok_actions    = [aws_sns_topic.lambda_alarms.arn]
}

# Alarm: Lambda Throttles
# Triggers when requests are throttled due to concurrency limits
resource "aws_cloudwatch_metric_alarm" "lambda_throttles" {
  alarm_name          = "graphene-screenshot-throttles"
  alarm_description   = "Lambda function throttling events"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Throttles"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.screenshot.function_name
  }

  alarm_actions = [aws_sns_topic.lambda_alarms.arn]
  ok_actions    = [aws_sns_topic.lambda_alarms.arn]
}

# Alarm: Lambda Duration (approaching timeout)
# Triggers when function duration exceeds 80% of timeout (48s of 60s)
resource "aws_cloudwatch_metric_alarm" "lambda_duration" {
  alarm_name          = "graphene-screenshot-duration"
  alarm_description   = "Lambda function approaching timeout threshold"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "Duration"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Average"
  threshold           = 48000 # 48 seconds (80% of 60s timeout)
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.screenshot.function_name
  }

  alarm_actions = [aws_sns_topic.lambda_alarms.arn]
  ok_actions    = [aws_sns_topic.lambda_alarms.arn]
}

# Alarm: Lambda Concurrent Executions
# Triggers when concurrent executions exceed warning threshold
resource "aws_cloudwatch_metric_alarm" "lambda_concurrent_executions" {
  alarm_name          = "graphene-screenshot-concurrent-executions"
  alarm_description   = "Lambda concurrent executions exceeding threshold"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ConcurrentExecutions"
  namespace           = "AWS/Lambda"
  period              = 60
  statistic           = "Maximum"
  threshold           = 100 # Warn when approaching default account limit
  treat_missing_data  = "notBreaching"

  dimensions = {
    FunctionName = aws_lambda_function.screenshot.function_name
  }

  alarm_actions = [aws_sns_topic.lambda_alarms.arn]
  ok_actions    = [aws_sns_topic.lambda_alarms.arn]
}
