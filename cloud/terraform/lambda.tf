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
