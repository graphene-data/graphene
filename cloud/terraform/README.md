# Graphene Cloud Terraform

### Setup for local dev
Install the aws CLI and `aws login`
Refresh local state to match what's in s3: `./tf init -reconfigure`

Use the `./tf` script to run terraform, as it loads in the aws credentials for you.

### Common commands
`./tf plan` see what infra changes will result from your code changes
`./tf apply` apply those changes.

### Bootstrap S3 Backend for terraform state (one-time)

Create the S3 bucket for state storage when creating a new account. Only needs to be done once.

```bash
# Create bucket (name must be globally unique)
aws s3api create-bucket --bucket graphene-cloud-tf-state-772069004272 --region us-east-1

# Enable versioning (protects against accidental state deletion)
aws s3api put-bucket-versioning --bucket graphene-cloud-tf-state-772069004272 \
  --versioning-configuration Status=Enabled
```
