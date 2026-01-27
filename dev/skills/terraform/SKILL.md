---
name: terraform
description: Use when making infrastructure changes to test against the staging AWS account.
---

# Testing Terraform Changes

You can test Terraform changes against the staging environment (AWS account `025223626139`) before applying to production.

Use `cloud/scripts/tf.sh staging <command>` in place of the `terraform <command>` command, it will load creds for you.
You should always work against the staging env, production is updated by CI and the creds in this env won't work for it.

Before starting work, `tf.sh staging init -reconfigure` to sync S3 state locally.
Then run `plan` to make sure there are no unexpected. changes.
If the plan shows changes you didn't make, **stop and notify the user** - someone else may have made changes.
