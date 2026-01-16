# Stytch configuration for Graphene Cloud
# See: https://registry.terraform.io/providers/stytchauth/stytch/latest/docs

locals {
  stytch_project_slug  = "graphene-ftdc"
  stytch_live_env_slug = "production"
  stytch_test_env_slug = "test-zean"
}

resource "stytch_project" "graphene" {
  name     = "Graphene"
  vertical = "B2B"

  live_environment = {
    name = "Production"
    environment_slug = "production"
  }
}

# Note: stytch_environment only manages TEST environments
# The live/production environment is managed via stytch_project.live_environment
resource "stytch_environment" "test" {
  project_slug = stytch_project.graphene.project_slug
  name         = "Test"
}

# =============================================================================
# B2B SDK Configuration - Production
# =============================================================================

resource "stytch_b2b_sdk_config" "prod" {
  project_slug     = stytch_project.graphene.project_slug
  environment_slug = stytch_project.graphene.live_environment.environment_slug

  config = {
    basic = {
      enabled                   = true
      allow_self_onboarding     = false
      enable_member_permissions = true
      bundle_ids                = []
      domains = [
        {
          domain       = "https://graphenedata.com"
          slug_pattern = "https://{{slug}}.graphenedata.com"
        },
      ]
    }
    sessions = {
      max_session_duration_minutes = 43200
    }
    passwords = {
      enabled                           = true
      pkce_required_for_password_resets = true
    }
    magic_links = {
      enabled       = false
      pkce_required = true
    }
    oauth = {
      enabled       = false
      pkce_required = true
    }
    sso = {
      enabled       = false
      pkce_required = true
    }
    otps = {
      email_enabled         = false
      sms_enabled           = false
      sms_autofill_metadata = []
    }
    totps = {
      enabled      = false
      create_totps = false
    }
    dfppa = {
      enabled      = "DISABLED"
      on_challenge = "ALLOW"
    }
    cookies = {
      http_only = "DISABLED"
    }
  }
}

# =============================================================================
# B2B SDK Configuration - Test
# =============================================================================

resource "stytch_b2b_sdk_config" "test" {
  project_slug     = stytch_project.graphene.project_slug
  environment_slug = stytch_environment.test.environment_slug

  config = {
    basic = {
      enabled                   = true
      allow_self_onboarding     = false
      enable_member_permissions = true
      bundle_ids                = []
      domains = [
        { domain = "http://localhost:3000", slug_pattern = "" },
        { domain = "http://localhost:3121", slug_pattern = "" },
        { domain = "http://localhost:4001", slug_pattern = "" },
        { domain = "http://localhost:4004", slug_pattern = "" },
        { domain = "http://localhost:4007", slug_pattern = "" },
        { domain = "http://localhost:4010", slug_pattern = "" },
      ]
    }
    sessions = {
      max_session_duration_minutes = 43200
    }
    passwords = {
      enabled                           = true
      pkce_required_for_password_resets = true
    }
    magic_links = {
      enabled       = false
      pkce_required = true
    }
    oauth = {
      enabled       = false
      pkce_required = true
    }
    sso = {
      enabled       = false
      pkce_required = true
    }
    otps = {
      email_enabled         = false
      sms_enabled           = false
      sms_autofill_metadata = []
    }
    totps = {
      enabled      = false
      create_totps = false
    }
    dfppa = {
      enabled      = "DISABLED"
      on_challenge = "ALLOW"
    }
    cookies = {
      http_only = "DISABLED"
    }
  }
}

# =============================================================================
# Redirect URLs - Production
# =============================================================================

resource "stytch_redirect_url" "prod_login" {
  project_slug     = stytch_project.graphene.project_slug
  environment_slug = stytch_project.graphene.live_environment.environment_slug
  url              = "https://login.graphenedata.com/login"

  valid_types = [
    { type = "LOGIN", is_default = true },
    { type = "SIGNUP", is_default = true },
    { type = "INVITE", is_default = true },
    { type = "RESET_PASSWORD", is_default = true },
    { type = "DISCOVERY", is_default = true },
  ]
}

# =============================================================================
# Public Tokens
# =============================================================================

resource "stytch_public_token" "prod" {
  project_slug     = stytch_project.graphene.project_slug
  environment_slug = stytch_project.graphene.live_environment.environment_slug
}

resource "stytch_public_token" "test" {
  project_slug     = stytch_project.graphene.project_slug
  environment_slug = stytch_environment.test.environment_slug
}

# =============================================================================
# Secrets
# =============================================================================

resource "stytch_secret" "prod" {
  project_slug     = stytch_project.graphene.project_slug
  environment_slug = stytch_project.graphene.live_environment.environment_slug
}

resource "stytch_secret" "test" {
  project_slug     = stytch_project.graphene.project_slug
  environment_slug = stytch_environment.test.environment_slug
}
