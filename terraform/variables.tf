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

# Turso Configuration
variable "turso_database_url" {
  description = "Turso database URL"
  type        = string
  default     = "libsql://graphene-prod-us-graphene.aws-us-east-1.turso.io"
}

variable "turso_auth_token" {
  description = "Turso auth token (set via TF_VAR_turso_auth_token)"
  type        = string
  sensitive   = true
}
