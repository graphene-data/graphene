# ACM Certificate for *.graphenedata.com

resource "aws_acm_certificate" "wildcard" {
  domain_name               = "*.graphenedata.com"
  subject_alternative_names = ["graphenedata.com"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

# Look up the HTTPS listener on the ECS Express ALB (only if ALB extras are enabled)
data "aws_lb_listener" "https" {
  count             = var.configure_alb_extras ? 1 : 0
  load_balancer_arn = data.aws_lb.ecs_express[0].arn
  port              = 443
}

# Add our certificate to the ALB HTTPS listener
resource "aws_lb_listener_certificate" "wildcard" {
  count           = var.configure_alb_extras ? 1 : 0
  listener_arn    = data.aws_lb_listener.https[0].arn
  certificate_arn = aws_acm_certificate.wildcard.arn
}

# ECS express mode creates an ELB, but doesn't yet support custom domains, so we need to take the ELB rule it created, and update it.
resource "aws_lb_listener_rule" "ecs_express" {
  count        = var.configure_alb_extras && var.lb_target_group_arns != null ? 1 : 0
  listener_arn = data.aws_lb_listener.https[0].arn
  priority     = 1

  action {
    type = "forward"
    forward {
      target_group {
        arn    = var.lb_target_group_arns.primary
        weight = 100
      }
      target_group {
        arn    = var.lb_target_group_arns.secondary
        weight = 0
      }
    }
  }

  condition {
    host_header {
      values = var.lb_listener_rule_host_headers
    }
  }
}
