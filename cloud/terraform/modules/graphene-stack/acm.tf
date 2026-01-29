# ACM Certificate for the environment's domain

resource "aws_acm_certificate" "wildcard" {
  domain_name               = "*.${var.domain_name}"
  subject_alternative_names = [var.domain_name]
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

# NOTE: The ECS-managed load balancer rule checks the host header, and has to be manually updated in each stack.
