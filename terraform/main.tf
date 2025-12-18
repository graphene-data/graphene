terraform {
  # 1.5.0 minimum for import blocks; 1.14.0+ for terraform search/query feature
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
  }

  backend "s3" {
    bucket       = "graphene-cloud-tf-state-772069004272"
    key          = "cloud/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project   = "graphene-cloud"
      ManagedBy = "terraform"
    }
  }
}

# Stytch provider - uses workspace management keys
# Credentials via TF_VAR_stytch_workspace_key_id and TF_VAR_stytch_workspace_key_secret
provider "stytch" {
  workspace_key_id     = var.stytch_workspace_key_id
  workspace_key_secret = var.stytch_workspace_key_secret
}
