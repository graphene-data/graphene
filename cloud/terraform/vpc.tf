# VPC Configuration
# Currently using the default VPC for simplicity. 
# This can be expanded to create a dedicated VPC with private subnets for production.

data "aws_vpc" "default" {
  default = true
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

data "aws_availability_zones" "available" {
  state = "available"
}

# Outputs for use by other modules
output "vpc_id" {
  description = "VPC ID"
  value       = data.aws_vpc.default.id
}

output "subnet_ids" {
  description = "Subnet IDs"
  value       = data.aws_subnets.default.ids
}
