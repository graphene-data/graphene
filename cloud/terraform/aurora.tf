# Aurora PostgreSQL Serverless v2 Cluster

# DB Subnet Group
resource "aws_db_subnet_group" "aurora" {
  name       = "graphene-aurora-subnet-group"
  subnet_ids = data.aws_subnets.default.ids

  tags = {
    Name = "Graphene Aurora DB Subnet Group"
  }
}

# Security Group for Aurora
resource "aws_security_group" "aurora" {
  name        = "graphene-aurora-sg"
  description = "Security group for Graphene Aurora PostgreSQL cluster"
  vpc_id      = data.aws_vpc.default.id

  # No egress rules needed - Aurora only receives connections

  tags = {
    Name = "Graphene Aurora Security Group"
  }
}

# Allow Aurora ingress from ECS tasks
resource "aws_security_group_rule" "aurora_from_ecs" {
  type                     = "ingress"
  description              = "PostgreSQL from ECS"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  security_group_id        = aws_security_group.aurora.id
  source_security_group_id = aws_security_group.ecs.id
}

# Aurora PostgreSQL Cluster
resource "aws_rds_cluster" "graphene" {
  cluster_identifier     = "graphene-prod"
  engine                 = "aurora-postgresql"
  engine_mode            = "provisioned"
  engine_version         = "16.6"
  database_name          = var.database_name
  master_username        = var.database_username
  master_password        = random_password.database.result
  db_subnet_group_name   = aws_db_subnet_group.aurora.name
  vpc_security_group_ids = [aws_security_group.aurora.id]

  # Serverless v2 scaling
  serverlessv2_scaling_configuration {
    min_capacity = 0.5 # Minimum 0.5 ACUs (~$0.06/hour)
    max_capacity = 4.0 # Maximum 4 ACUs for cost control
  }

  # Backup configuration (also enables PITR - Point-in-Time Recovery)
  # PITR is automatically enabled when backup_retention_period > 0
  backup_retention_period = 7
  preferred_backup_window = "03:00-04:00" # UTC
  
  # Copy tags to snapshots for audit trail
  copy_tags_to_snapshot = true

  # Maintenance window
  preferred_maintenance_window = "sun:04:00-sun:05:00" # UTC

  # Enable encryption at rest
  storage_encrypted = true

  # Enable deletion protection in production
  deletion_protection = true

  # Skip final snapshot on destroy (change to false for production safety)
  skip_final_snapshot       = false
  final_snapshot_identifier = "graphene-prod-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"

  # Enable enhanced monitoring
  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = {
    Name = "Graphene Production Aurora Cluster"
  }

  lifecycle {
    ignore_changes = [
      # Ignore snapshot identifier changes
      final_snapshot_identifier,
    ]
  }
}

# Aurora PostgreSQL Instance (Serverless v2)
resource "aws_rds_cluster_instance" "graphene" {
  identifier         = "graphene-prod-instance-1"
  cluster_identifier = aws_rds_cluster.graphene.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.graphene.engine
  engine_version     = aws_rds_cluster.graphene.engine_version

  # Enable enhanced monitoring (1 minute granularity)
  monitoring_interval = 60
  monitoring_role_arn = aws_iam_role.rds_enhanced_monitoring.arn

  # Performance Insights
  performance_insights_enabled          = true
  performance_insights_retention_period = 7 # days

  tags = {
    Name = "Graphene Production Aurora Instance"
  }
}

# IAM Role for Enhanced Monitoring
resource "aws_iam_role" "rds_enhanced_monitoring" {
  name = "graphene-rds-enhanced-monitoring"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "monitoring.rds.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "Graphene RDS Enhanced Monitoring Role"
  }
}

resource "aws_iam_role_policy_attachment" "rds_enhanced_monitoring" {
  role       = aws_iam_role.rds_enhanced_monitoring.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonRDSEnhancedMonitoringRole"
}

# SNS Topic for RDS Alarms
resource "aws_sns_topic" "rds_alarms" {
  name = "graphene-rds-alarms"
}

resource "aws_sns_topic_subscription" "rds_alarms_email" {
  topic_arn = aws_sns_topic.rds_alarms.arn
  protocol  = "email"
  endpoint  = var.alarm_notification_email
}

# CloudWatch Alarms for Aurora

# CPU Utilization Alarm
resource "aws_cloudwatch_metric_alarm" "aurora_cpu" {
  alarm_name          = "graphene-aurora-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = 300 # 5 minutes
  statistic           = "Average"
  threshold           = 80 # 80%
  alarm_description   = "Alert when Aurora CPU exceeds 80%"
  alarm_actions       = [aws_sns_topic.rds_alarms.arn]
  ok_actions          = [aws_sns_topic.rds_alarms.arn]

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.graphene.cluster_identifier
  }
}

# Database Connections Alarm
resource "aws_cloudwatch_metric_alarm" "aurora_connections" {
  alarm_name          = "graphene-aurora-high-connections"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300 # 5 minutes
  statistic           = "Average"
  threshold           = 80 # connections
  alarm_description   = "Alert when Aurora connections exceed 80"
  alarm_actions       = [aws_sns_topic.rds_alarms.arn]
  ok_actions          = [aws_sns_topic.rds_alarms.arn]

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.graphene.cluster_identifier
  }
}

# ACU Utilization Alarm (Serverless v2 specific)
resource "aws_cloudwatch_metric_alarm" "aurora_acu" {
  alarm_name          = "graphene-aurora-high-acu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "ServerlessDatabaseCapacity"
  namespace           = "AWS/RDS"
  period              = 300 # 5 minutes
  statistic           = "Average"
  threshold           = 3.5 # ACUs (approaching max of 4.0)
  alarm_description   = "Alert when Aurora ACU usage approaches maximum"
  alarm_actions       = [aws_sns_topic.rds_alarms.arn]
  ok_actions          = [aws_sns_topic.rds_alarms.arn]

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.graphene.cluster_identifier
  }
}

# Free Local Storage Alarm
resource "aws_cloudwatch_metric_alarm" "aurora_storage" {
  alarm_name          = "graphene-aurora-low-storage"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "FreeLocalStorage"
  namespace           = "AWS/RDS"
  period              = 300 # 5 minutes
  statistic           = "Average"
  threshold           = 5368709120 # 5 GB in bytes
  alarm_description   = "Alert when Aurora free storage is below 5GB"
  alarm_actions       = [aws_sns_topic.rds_alarms.arn]
  ok_actions          = [aws_sns_topic.rds_alarms.arn]

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.graphene.cluster_identifier
  }
}


