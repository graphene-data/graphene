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
    # TODO: Update with staging account's state bucket
    bucket       = "graphene-tf-state-025223626139"
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
      Project     = "graphene-cloud"
      ManagedBy   = "terraform"
      Environment = "staging"
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
  # Opt-in region - skip validation since not enabled in staging
  skip_credentials_validation = true
  skip_requesting_account_id  = true
}
provider "aws" {
  alias  = "ap_east_1"
  region = "ap-east-1"
  # Opt-in region - skip validation since not enabled in staging
  skip_credentials_validation = true
  skip_requesting_account_id  = true
}
provider "aws" {
  alias  = "ap_south_1"
  region = "ap-south-1"
}
provider "aws" {
  alias  = "ap_south_2"
  region = "ap-south-2"
  # Opt-in region - skip validation since not enabled in staging
  skip_credentials_validation = true
  skip_requesting_account_id  = true
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
  # Opt-in region - skip validation since not enabled in staging
  skip_credentials_validation = true
  skip_requesting_account_id  = true
}
provider "aws" {
  alias  = "ap_southeast_4"
  region = "ap-southeast-4"
  # Opt-in region - skip validation since not enabled in staging
  skip_credentials_validation = true
  skip_requesting_account_id  = true
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
  # Opt-in region - skip validation since not enabled in staging
  skip_credentials_validation = true
  skip_requesting_account_id  = true
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
  # Opt-in region - skip validation since not enabled in staging
  skip_credentials_validation = true
  skip_requesting_account_id  = true
}
provider "aws" {
  alias  = "eu_south_2"
  region = "eu-south-2"
  # Opt-in region - skip validation since not enabled in staging
  skip_credentials_validation = true
  skip_requesting_account_id  = true
}
provider "aws" {
  alias  = "me_south_1"
  region = "me-south-1"
  # Opt-in region - skip validation since not enabled in staging
  skip_credentials_validation = true
  skip_requesting_account_id  = true
}
provider "aws" {
  alias  = "me_central_1"
  region = "me-central-1"
  # Opt-in region - skip validation since not enabled in staging
  skip_credentials_validation = true
  skip_requesting_account_id  = true
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

  # TODO: Update with staging account ID
  aws_account_id = "025223626139"
  domain_name    = "graphene-staging.com"

  # Stytch configuration - these values come from the Stytch dashboard
  # for the staging workspace's production project
  stytch_project_id = "project-live-f75f71b0-14d6-4f18-855c-372c36be4462"
  stytch_domain     = "https://zenith-erigeron-9137.customers.stytch.com"
  stytch_sdk_domains = [
    {
      domain       = "https://graphene-staging.com"
      slug_pattern = "https://{{slug}}.graphene-staging.com"
    }
  ]
  stytch_redirect_url = "https://login.graphene-staging.com/login"

  # GitHub App configuration - can use same app or staging-specific
  github_app_slug      = "graphene-data"
  github_app_id        = "2480545"
  github_app_client_id = "Iv23litWr1CG7mzkNx5K"

  # Feature flags - disable Delve auditor and opt-in region GuardDuty for staging
  enable_delve_auditor          = false
  enable_optin_region_guardduty = false

  # ACM/LB configuration - attach wildcard cert and configure host routing
  configure_alb_extras = true
  lb_listener_rule_host_headers = [
    "gr-cc11cf826d8e47d0b8b20755a72fff5d.ecs.us-east-1.on.aws",
    "*.graphene-staging.com",
    "graphene-staging.com"
  ]
  lb_target_group_arns = {
    primary   = "arn:aws:elasticloadbalancing:us-east-1:025223626139:targetgroup/ecs-gateway-tg-1a06ed137e5bb6c69/9277424ab3fa615a"
    secondary = "arn:aws:elasticloadbalancing:us-east-1:025223626139:targetgroup/ecs-gateway-tg-ee1ca35d9a6e0d737/a1dcdcac8d959db1"
  }

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

output "stytch_project_slug" {
  value = module.graphene.stytch_project_slug
}

output "stytch_public_token" {
  value = module.graphene.stytch_public_token
}

output "stytch_secret_id" {
  value = module.graphene.stytch_secret_id
}

output "stytch_secret" {
  value     = module.graphene.stytch_secret
  sensitive = true
}
