# Provider configuration for the module
# These providers must be passed in from the root module

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.26.0"
      configuration_aliases = [
        aws,
        aws.us_east_2,
        aws.us_west_1,
        aws.us_west_2,
        aws.af_south_1,
        aws.ap_east_1,
        aws.ap_south_1,
        aws.ap_south_2,
        aws.ap_northeast_1,
        aws.ap_northeast_2,
        aws.ap_northeast_3,
        aws.ap_southeast_1,
        aws.ap_southeast_2,
        aws.ap_southeast_3,
        aws.ap_southeast_4,
        aws.ca_central_1,
        aws.eu_central_1,
        aws.eu_central_2,
        aws.eu_west_1,
        aws.eu_west_2,
        aws.eu_west_3,
        aws.eu_north_1,
        aws.eu_south_1,
        aws.eu_south_2,
        aws.me_south_1,
        aws.me_central_1,
        aws.sa_east_1,
      ]
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
}
