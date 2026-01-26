---
name: terraform
description: Use when making infrastructure changes to test against the staging AWS account.
---

# Testing Terraform Changes

You can test Terraform changes against the staging environment (AWS account `025223626139`) before applying to production.

## Before Starting

1. Run `./tf init -reconfigure` to sync local state with S3
2. Run `./tf plan` to check for unexpected changes
3. If the plan shows changes you didn't make, **stop and notify the user** - someone else may have made changes

## Making Changes

1. Edit the Terraform files in `cloud/terraform/`
2. Run `./tf plan` to preview changes
3. Run `./tf apply` to apply changes to staging
4. Test the changes work as expected

## Helper Script

Use the `./tf` script in `cloud/terraform/environments/staging/` - it loads credentials from `.env` automatically.

```bash
cd cloud/terraform/environments/staging
./tf plan
./tf apply
```
