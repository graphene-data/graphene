# AWS Configuration
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
}

# Stytch's provider doesn't give you the project_id or domain, so we have to copy/paste them here
variable "stytch_project_id" {
  description = "Stytch project ID"
  type        = string
}
variable "stytch_domain" {
  description = "Stytch domain"
  type        = string
}

# Database Configuration
variable "database_name" {
  description = "Aurora PostgreSQL database name"
  type        = string
  default     = "graphene"
}

variable "database_username" {
  description = "Aurora PostgreSQL master username"
  type        = string
  default     = "graphene"
}

# GitHub App Configuration
variable "github_app_slug" {
  description = "GitHub App slug"
  type        = string
}

variable "github_app_id" {
  description = "GitHub App ID"
  type        = string
}

variable "github_app_client_id" {
  description = "GitHub App client ID"
  type        = string
}



# Monitoring Configuration
variable "alarm_notification_email" {
  description = "Email address for CloudWatch alarm notifications"
  type        = string
  default     = "alerts@graphenedata.com"
}

# Feature flags
variable "enable_delve_auditor" {
  description = "Whether to create the Delve auditor IAM role"
  type        = bool
  default     = true
}

variable "enable_optin_region_guardduty" {
  description = "Whether to create GuardDuty detectors in opt-in regions (requires regions to be enabled in AWS account)"
  type        = bool
  default     = true
}

# ACM Configuration (environment-specific)
variable "domain_name" {
  description = "Primary domain name for the environment (e.g., graphenedata.com, graphene-staging.com)"
  type        = string
}

variable "configure_alb_extras" {
  description = "Whether to configure ALB extras (certificate, listener rules, WAF). Requires ECS Express service to exist first."
  type        = bool
  default     = true
}



# Stytch SDK Configuration
variable "stytch_sdk_domains" {
  description = "Domains for Stytch SDK configuration"
  type = list(object({
    domain       = string
    slug_pattern = string
  }))
}

variable "stytch_redirect_url" {
  description = "Redirect URL for Stytch login"
  type        = string
}
