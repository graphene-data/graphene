# AWS Configuration
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "aws_account_id" {
  description = "AWS account ID"
  type        = string
  default     = "772069004272"
}

# Secrets used to manage the stytch workspace
variable "stytch_workspace_key_id" {}
variable "stytch_workspace_key_secret" {
  sensitive = true
}

# Stytch's provider doesn't give you the project_id or domain, so we have to copy/paste them here
variable "stytch_prod_project_id" {
  description = "Stytch production project ID"
  type        = string
  default     = "project-live-6ce1d97b-eb01-42b7-a849-223d1a431224"
}
variable "stytch_prod_domain" {
  description = "Stytch production domain"
  type        = string
  default     = "https://iris-gouda-0163.customers.stytch.com"
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
  default     = "graphene-data"
}

variable "github_app_id" {
  description = "GitHub App ID"
  type        = string
  default     = "2480545"
}

variable "github_app_client_id" {
  description = "GitHub App client ID"
  type        = string
  default     = "Iv23litWr1CG7mzkNx5K"
}

variable "github_webhook_secret" {
  description = "GitHub webhook secret"
  type        = string
  sensitive   = true
}

variable "github_app_client_secret" {
  description = "GitHub App client secret"
  type        = string
  sensitive   = true
}

variable "github_app_private_key" {
  description = "GitHub App private key"
  type        = string
  sensitive   = true
}

# Monitoring Configuration
variable "alarm_notification_email" {
  description = "Email address for CloudWatch alarm notifications"
  type        = string
  default     = "alerts@graphenedata.com"
}
