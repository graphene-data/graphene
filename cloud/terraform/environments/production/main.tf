terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.26.0"
    }
    stytch = {
      source  = "stytchauth/stytch"
      version = "~> 3.0.1"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }

  backend "s3" {
    bucket       = "graphene-cloud-tf-state-772069004272"
    key          = "cloud/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
  }
}

# =============================================================================
# Variables
# =============================================================================

variable "stytch_workspace_key_id" {}
variable "stytch_workspace_key_secret" {
  sensitive = true
}

# =============================================================================
# Providers
# =============================================================================

provider "aws" {
  region = "us-east-1"

  default_tags {
    tags = {
      Project   = "graphene-cloud"
      ManagedBy = "terraform"
    }
  }
}

# Additional AWS providers for multi-region GuardDuty
provider "aws" {
  alias  = "us_east_2"
  region = "us-east-2"
}
provider "aws" {
  alias  = "us_west_1"
  region = "us-west-1"
}
provider "aws" {
  alias  = "us_west_2"
  region = "us-west-2"
}
provider "aws" {
  alias  = "af_south_1"
  region = "af-south-1"
}
provider "aws" {
  alias  = "ap_east_1"
  region = "ap-east-1"
}
provider "aws" {
  alias  = "ap_south_1"
  region = "ap-south-1"
}
provider "aws" {
  alias  = "ap_south_2"
  region = "ap-south-2"
}
provider "aws" {
  alias  = "ap_northeast_1"
  region = "ap-northeast-1"
}
provider "aws" {
  alias  = "ap_northeast_2"
  region = "ap-northeast-2"
}
provider "aws" {
  alias  = "ap_northeast_3"
  region = "ap-northeast-3"
}
provider "aws" {
  alias  = "ap_southeast_1"
  region = "ap-southeast-1"
}
provider "aws" {
  alias  = "ap_southeast_2"
  region = "ap-southeast-2"
}
provider "aws" {
  alias  = "ap_southeast_3"
  region = "ap-southeast-3"
}
provider "aws" {
  alias  = "ap_southeast_4"
  region = "ap-southeast-4"
}
provider "aws" {
  alias  = "ca_central_1"
  region = "ca-central-1"
}
provider "aws" {
  alias  = "eu_central_1"
  region = "eu-central-1"
}
provider "aws" {
  alias  = "eu_central_2"
  region = "eu-central-2"
}
provider "aws" {
  alias  = "eu_west_1"
  region = "eu-west-1"
}
provider "aws" {
  alias  = "eu_west_2"
  region = "eu-west-2"
}
provider "aws" {
  alias  = "eu_west_3"
  region = "eu-west-3"
}
provider "aws" {
  alias  = "eu_north_1"
  region = "eu-north-1"
}
provider "aws" {
  alias  = "eu_south_1"
  region = "eu-south-1"
}
provider "aws" {
  alias  = "eu_south_2"
  region = "eu-south-2"
}
provider "aws" {
  alias  = "me_south_1"
  region = "me-south-1"
}
provider "aws" {
  alias  = "me_central_1"
  region = "me-central-1"
}
provider "aws" {
  alias  = "sa_east_1"
  region = "sa-east-1"
}

provider "stytch" {
  workspace_key_id     = var.stytch_workspace_key_id
  workspace_key_secret = var.stytch_workspace_key_secret
}

# =============================================================================
# Module
# =============================================================================

module "graphene" {
  source = "../../modules/graphene-stack"

  aws_account_id = "772069004272"
  environment    = "production"
  domain_name    = "graphenedata.com"
  website_domain_names = [
    "www.graphenedata.com",
    "graphenedata.com"
  ]

  # Stytch configuration
  stytch_project_id = "project-live-6ce1d97b-eb01-42b7-a849-223d1a431224"
  stytch_domain     = "https://iris-gouda-0163.customers.stytch.com"
  stytch_sdk_domains = [
    {
      domain       = "https://graphenedata.com"
      slug_pattern = "https://{{slug}}.graphenedata.com"
    }
  ]
  stytch_redirect_url = "https://login.graphenedata.com/login"

  # GitHub App configuration
  github_app_slug      = "graphene-data"
  github_app_id        = "2480545"
  github_app_client_id = "Iv23litWr1CG7mzkNx5K"

  # Feature flags
  enable_delve_auditor = true

  # ACM/LB configuration
  configure_alb_extras = true

  providers = {
    aws                = aws
    aws.us_east_2      = aws.us_east_2
    aws.us_west_1      = aws.us_west_1
    aws.us_west_2      = aws.us_west_2
    aws.af_south_1     = aws.af_south_1
    aws.ap_east_1      = aws.ap_east_1
    aws.ap_south_1     = aws.ap_south_1
    aws.ap_south_2     = aws.ap_south_2
    aws.ap_northeast_1 = aws.ap_northeast_1
    aws.ap_northeast_2 = aws.ap_northeast_2
    aws.ap_northeast_3 = aws.ap_northeast_3
    aws.ap_southeast_1 = aws.ap_southeast_1
    aws.ap_southeast_2 = aws.ap_southeast_2
    aws.ap_southeast_3 = aws.ap_southeast_3
    aws.ap_southeast_4 = aws.ap_southeast_4
    aws.ca_central_1   = aws.ca_central_1
    aws.eu_central_1   = aws.eu_central_1
    aws.eu_central_2   = aws.eu_central_2
    aws.eu_west_1      = aws.eu_west_1
    aws.eu_west_2      = aws.eu_west_2
    aws.eu_west_3      = aws.eu_west_3
    aws.eu_north_1     = aws.eu_north_1
    aws.eu_south_1     = aws.eu_south_1
    aws.eu_south_2     = aws.eu_south_2
    aws.me_south_1     = aws.me_south_1
    aws.me_central_1   = aws.me_central_1
    aws.sa_east_1      = aws.sa_east_1
  }
}

# =============================================================================
# Production-specific imports (these resources already exist)
# =============================================================================

import {
  to = module.graphene.aws_guardduty_detector.main
  id = "60cdcd3ffa83f76d899ecd901fc06e9e"
}

import {
  to = module.graphene.aws_inspector2_enabler.main
  id = "772069004272-ECR:LAMBDA:LAMBDA_CODE"
}

import {
  to = module.graphene.aws_acm_certificate.wildcard
  id = "arn:aws:acm:us-east-1:772069004272:certificate/226c1e97-69ce-4169-bbed-8d4e8a218030"
}



# =============================================================================
# Outputs
# =============================================================================

output "ecr_repository_url" {
  value = module.graphene.ecr_repository_url
}

output "ecs_service_url" {
  value = module.graphene.ecs_service_url
}

output "ci_deploy_role_arn" {
  value = module.graphene.ci_deploy_role_arn
}

output "website_cloudfront_distribution_id" {
  value = module.graphene.website_cloudfront_distribution_id
}

output "website_cloudfront_domain_name" {
  value = module.graphene.website_cloudfront_domain_name
}
