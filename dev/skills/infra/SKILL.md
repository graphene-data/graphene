---
name: infra
description: Use when working with staging/production infrastructure, including terraform, aws, and database access.
---

# Infrastructure Guide

This guide covers working with Graphene's infrastructure. All commands shown here run against the staging environment, you have no access to production.
Credentials for AWS and Stytch are stored in .env.

- **Staging**: AWS account `025223626139` - use for testing infrastructure changes
- **Production**: AWS account `772069004272` - updated by CI only

## Deploying

Use `cloud/scripts/deploy.sh staging --skip-build` to build and deploy to staging. 
1. Runs database migrations
2. Updates the ECS service
3. Waits for deployment to complete

Docker is not available in this environment. If you need a new image built and pushed, stop and ask the user to do it.

## Terraform

Use `cloud/scripts/tf.sh staging <command>` in place of `terraform <command>` - it loads credentials for you.

Before starting work:
1. Run `tf.sh staging init -reconfigure` to sync S3 state locally
2. Run `tf.sh staging plan` to check for unexpected changes
3. If the plan shows changes you didn't make, **stop and notify the user** - someone else may have made changes

You should always work against staging, but feel free to make changes to it via terraform, and use the aws cli as needed.

## Database Access

You can run queries against the staging database like so:

```bash
./cloud/scripts/db-shell.sh staging "SELECT * FROM orgs"
```
