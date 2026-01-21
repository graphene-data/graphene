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

# Stytch provider - uses workspace management keys
# Credentials via TF_VAR_stytch_workspace_key_id and TF_VAR_stytch_workspace_key_secret
provider "stytch" {
  workspace_key_id     = var.stytch_workspace_key_id
  workspace_key_secret = var.stytch_workspace_key_secret
}
