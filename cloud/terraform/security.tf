# SOC2/HIPAA Security Resources

# =============================================================================
# GuardDuty - Intrusion Detection
# =============================================================================

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
