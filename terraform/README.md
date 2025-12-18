# Graphene Cloud Terraform

### Configure Secrets

Create `terraform.tfvars` (gitignored) with your secret values:

```hcl
turso_auth_token = ""
stytch_workspace_key_id   = ""
stytch_workspace_key_secret = ""
```

### Running terraform
`aws login` to connect to the correct aws account
`./tf` script runs terraform using your aws credentials


### Bootstrap S3 Backend for terraform state (one-time)

Create the S3 bucket and DynamoDB table for state storage when creating a new account. Only needs to be done once.

```bash
# Create bucket (name must be globally unique)
aws s3api create-bucket --bucket graphene-cloud-tf-state-772069004272 --region us-east-1

# Enable versioning (protects against accidental state deletion)
aws s3api put-bucket-versioning --bucket graphene-cloud-tf-state-772069004272 \
  --versioning-configuration Status=Enabled
```
