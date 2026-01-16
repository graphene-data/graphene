# ACM Certificate for *.graphenedata.com

resource "aws_acm_certificate" "wildcard" {
  domain_name               = "*.graphenedata.com"
  subject_alternative_names = ["graphenedata.com"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

import {
  to = aws_acm_certificate.wildcard
  id = "arn:aws:acm:us-east-1:772069004272:certificate/226c1e97-69ce-4169-bbed-8d4e8a218030"
}

# Look up the HTTPS listener on the ECS Express ALB
data "aws_lb_listener" "https" {
  load_balancer_arn = data.aws_lb.ecs_express.arn
  port              = 443
}

# Add our certificate to the ALB HTTPS listener
resource "aws_lb_listener_certificate" "wildcard" {
  listener_arn    = data.aws_lb_listener.https.arn
  certificate_arn = aws_acm_certificate.wildcard.arn
}

# ECS express mode creates an ELB, but doesn't yet support custom domains, so we need to take the ELB rule it created, and update it.
resource "aws_lb_listener_rule" "ecs_express" {
  listener_arn = data.aws_lb_listener.https.arn
  priority     = 1

  action {
    type = "forward"
    forward {
      target_group {
        arn    = "arn:aws:elasticloadbalancing:us-east-1:772069004272:targetgroup/ecs-gateway-tg-c88558fa89795edf8/81cabbbe7edd24e0"
        weight = 100
      }
      target_group {
        arn    = "arn:aws:elasticloadbalancing:us-east-1:772069004272:targetgroup/ecs-gateway-tg-bbe2debacf5bf84d0/fc0e2807e1e63777"
        weight = 0
      }
    }
  }

  condition {
    host_header {
      values = [
        "gr-e4d20105fe4d49dc9c7cf30d33bc836a.ecs.us-east-1.on.aws",
        "*.graphenedata.com",
        "graphenedata.com"
      ]
    }
  }
}

import {
  to = aws_lb_listener_rule.ecs_express
  id = "arn:aws:elasticloadbalancing:us-east-1:772069004272:listener-rule/app/ecs-express-gateway-alb-bd5cc8e0/c4bd5bd2e3fe97ff/07d5c7e54f9cf75a/c7e8dd24cef66ec9"
}
