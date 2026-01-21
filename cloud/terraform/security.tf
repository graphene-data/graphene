# SOC2/HIPAA Security Resources

# =============================================================================
# GuardDuty - Intrusion Detection (All Regions)
# =============================================================================

# Primary region GuardDuty detector (us-east-1)
resource "aws_guardduty_detector" "main" {
  enable = true
}

import {
  to = aws_guardduty_detector.main
  id = "60cdcd3ffa83f76d899ecd901fc06e9e"
}

resource "aws_guardduty_detector_feature" "s3_logs" {
  detector_id = aws_guardduty_detector.main.id
  name        = "S3_DATA_EVENTS"
  status      = "ENABLED"
}

resource "aws_guardduty_detector_feature" "malware_protection" {
  detector_id = aws_guardduty_detector.main.id
  name        = "EBS_MALWARE_PROTECTION"
  status      = "ENABLED"
}

resource "aws_guardduty_detector_feature" "ecs_runtime_monitoring" {
  detector_id = aws_guardduty_detector.main.id
  name        = "RUNTIME_MONITORING"
  status      = "ENABLED"

  additional_configuration {
    name   = "ECS_FARGATE_AGENT_MANAGEMENT"
    status = "ENABLED"
  }
}

# GuardDuty detectors for all other regions
resource "aws_guardduty_detector" "us_east_2" {
  provider = aws.us_east_2
}
resource "aws_guardduty_detector" "us_west_1" {
  provider = aws.us_west_1
}
resource "aws_guardduty_detector" "us_west_2" {
  provider = aws.us_west_2
}
resource "aws_guardduty_detector" "af_south_1" {
  provider = aws.af_south_1
}
resource "aws_guardduty_detector" "ap_east_1" {
  provider = aws.ap_east_1
}
resource "aws_guardduty_detector" "ap_south_1" {
  provider = aws.ap_south_1
}
resource "aws_guardduty_detector" "ap_south_2" {
  provider = aws.ap_south_2
}
resource "aws_guardduty_detector" "ap_northeast_1" {
  provider = aws.ap_northeast_1
}
resource "aws_guardduty_detector" "ap_northeast_2" {
  provider = aws.ap_northeast_2
}
resource "aws_guardduty_detector" "ap_northeast_3" {
  provider = aws.ap_northeast_3
}
resource "aws_guardduty_detector" "ap_southeast_1" {
  provider = aws.ap_southeast_1
}
resource "aws_guardduty_detector" "ap_southeast_2" {
  provider = aws.ap_southeast_2
}
resource "aws_guardduty_detector" "ap_southeast_3" {
  provider = aws.ap_southeast_3
}
resource "aws_guardduty_detector" "ap_southeast_4" {
  provider = aws.ap_southeast_4
}
resource "aws_guardduty_detector" "ca_central_1" {
  provider = aws.ca_central_1
}
resource "aws_guardduty_detector" "eu_central_1" {
  provider = aws.eu_central_1
}
resource "aws_guardduty_detector" "eu_central_2" {
  provider = aws.eu_central_2
}
resource "aws_guardduty_detector" "eu_west_1" {
  provider = aws.eu_west_1
}
resource "aws_guardduty_detector" "eu_west_2" {
  provider = aws.eu_west_2
}
resource "aws_guardduty_detector" "eu_west_3" {
  provider = aws.eu_west_3
}
resource "aws_guardduty_detector" "eu_north_1" {
  provider = aws.eu_north_1
}
resource "aws_guardduty_detector" "eu_south_1" {
  provider = aws.eu_south_1
}
resource "aws_guardduty_detector" "eu_south_2" {
  provider = aws.eu_south_2
}
resource "aws_guardduty_detector" "me_south_1" {
  provider = aws.me_south_1
}
resource "aws_guardduty_detector" "me_central_1" {
  provider = aws.me_central_1
}
resource "aws_guardduty_detector" "sa_east_1" {
  provider = aws.sa_east_1
}

# =============================================================================
# AWS Inspector - Vulnerability Scanning
# =============================================================================

resource "aws_inspector2_enabler" "main" {
  account_ids    = [var.aws_account_id]
  resource_types = ["ECR", "LAMBDA", "LAMBDA_CODE"]
}

import {
  to = aws_inspector2_enabler.main
  id = "772069004272-ECR:LAMBDA:LAMBDA_CODE"
}

# =============================================================================
# AWS WAF - Web Application Firewall
# =============================================================================

resource "aws_wafv2_web_acl" "main" {
  name        = "graphene-prod-waf"
  description = "WAF for SOC2/HIPAA compliance"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # Rule 1: SQL Injection Protection
  rule {
    name     = "AWSManagedRulesSQLiRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesSQLiRuleSet"
      sampled_requests_enabled   = true
    }
  }

  # Rule 2: XSS Protection (Core Rule Set)
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesCommonRuleSet"
      sampled_requests_enabled   = true
    }
  }

  # Rule 3: Known Bad Inputs (additional XSS/injection protection)
  rule {
    name     = "AWSManagedRulesKnownBadInputsRuleSet"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesKnownBadInputsRuleSet"
      sampled_requests_enabled   = true
    }
  }

  # Rule 4: Amazon IP Reputation List (Bot/threat protection)
  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesAmazonIpReputationList"
      sampled_requests_enabled   = true
    }
  }

  # Rule 5: Anonymous IP List (additional bot protection)
  rule {
    name     = "AWSManagedRulesAnonymousIpList"
    priority = 5

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAnonymousIpList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "AWSManagedRulesAnonymousIpList"
      sampled_requests_enabled   = true
    }
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "graphene-prod-waf"
    sampled_requests_enabled   = true
  }
}

# Look up the ALB created by ECS Express Mode (tagged with AmazonECSManaged=true)
data "aws_lb" "ecs_express" {
  tags = {
    AmazonECSManaged = "true"
  }
}

# Associate WAF with ECS Express Mode ALB
resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = data.aws_lb.ecs_express.arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}

# =============================================================================
# AWS Security Hub - Centralized Security Findings (Primary Region Only)
# =============================================================================

resource "aws_securityhub_account" "main" {
  enable_default_standards  = true
  control_finding_generator = "SECURITY_CONTROL"
}

# Configure Security Hub to aggregate findings from all regions
resource "aws_securityhub_finding_aggregator" "main" {
  linking_mode = "ALL_REGIONS"
  depends_on   = [aws_securityhub_account.main]
}

# Enable CIS AWS Foundations Benchmark
resource "aws_securityhub_standards_subscription" "cis" {
  standards_arn = "arn:aws:securityhub:${var.aws_region}::standards/cis-aws-foundations-benchmark/v/1.4.0"
  depends_on    = [aws_securityhub_account.main]
}

# Configure GuardDuty to send findings to Security Hub
resource "aws_securityhub_product_subscription" "guardduty" {
  product_arn = "arn:aws:securityhub:${var.aws_region}::product/aws/guardduty"
  depends_on  = [aws_securityhub_account.main]
}

# Configure Inspector to send findings to Security Hub
resource "aws_securityhub_product_subscription" "inspector" {
  product_arn = "arn:aws:securityhub:${var.aws_region}::product/aws/inspector"
  depends_on  = [aws_securityhub_account.main]
}
