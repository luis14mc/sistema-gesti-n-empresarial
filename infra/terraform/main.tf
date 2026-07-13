terraform {
  required_version = ">= 1.5"
  required_providers {
    aws    = { source = "hashicorp/aws", version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.5" }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project     = var.project_name
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "sge-team"
    }
  }
}

# =====================================================
# Variables
# =====================================================

variable "project_name" {
  description = "Nombre del proyecto (usado en nombres de recursos)"
  type        = string
  default     = "sge"
}

variable "environment" {
  description = "Entorno (staging|production)"
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "El environment debe ser 'staging' o 'production'."
  }
}

variable "aws_region" {
  description = "Región AWS"
  type        = string
  default     = "us-east-2"
}

variable "container_image" {
  description = "URI completa de la imagen ECR (ej: 123456789012.dkr.ecr.us-east-2.amazonaws.com/sge:v1.0.0)"
  type        = string
}

variable "container_port" {
  description = "Puerto del contenedor Next.js"
  type        = number
  default     = 3000
}

variable "neon_database_url" {
  description = "Connection string de Neon (pooled). Se inyecta como secreto."
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT_SECRET >= 32 caracteres"
  type        = string
  sensitive   = true
  validation {
    condition     = length(var.jwt_secret) >= 32
    error_message = "JWT_SECRET debe tener al menos 32 caracteres."
  }
}

# =====================================================
# Locals
# =====================================================

locals {
  name_prefix = "${var.project_name}-${var.environment}"
  common_tags = {
    Project     = var.project_name
    Environment = var.environment
  }
}

# =====================================================
# S3 — uploads
# =====================================================

resource "aws_s3_bucket" "uploads" {
  bucket = "${local.name_prefix}-uploads-${random_suffix.id}"
  tags   = local.common_tags
}

resource "random_id" "random_suffix" {
  byte_length = 4
}

# Bloquear acceso público por defecto
resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Versionado + lifecycle para auditoría (90 días en tier barato)
resource "aws_s3_bucket_versioning" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_lifecycle_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id

  rule {
    id     = "archive-old-uploads"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365 * 7  # Retención 7 años (ISO 27001)
    }

    noncurrent_version_expiration {
      noncurrent_days = 30
    }
  }
}

# =====================================================
# ECR — Container image registry
# =====================================================

resource "aws_ecr_repository" "app" {
  name                 = "${var.project_name}/${var.environment}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = local.common_tags
}

# =====================================================
# CloudWatch Logs
# =====================================================

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/${local.name_prefix}/app"
  retention_in_days = 30

  tags = local.common_tags
}

# =====================================================
# ECS — Fargate
# =====================================================

resource "aws_ecs_cluster" "main" {
  name = "${local.name_prefix}-cluster"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }

  tags = local.common_tags
}

resource "aws_ecs_task_definition" "app" {
  family                   = "${local.name_prefix}-app"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = 512
  memory                   = 1024
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "sge-app"
      image     = var.container_image
      essential = true
      port      = var.container_port

      environment = [
        { name = "NODE_ENV",     value = "production" },
        { name = "PORT",         value = tostring(var.container_port) },
        { name = "AWS_REGION",   value = var.aws_region },
        { name = "S3_BUCKET",    value = aws_s3_bucket.uploads.id },
        { name = "STORAGE_DRIVER", value = "s3" },
      ]

      secrets = [
        { name = "DATABASE_URL", valueFrom = aws_ssm_parameter.db_url.arn },
        { name = "JWT_SECRET",   valueFrom = aws_ssm_parameter.jwt_secret.arn },
      ]

      log_configuration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "wget -q --spider http://localhost:3000/api/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 30
      }
    }
  ])

  tags = local.common_tags
}

resource "aws_ecs_service" "app" {
  name            = "${local.name_prefix}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 2
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = module.network.public_subnet_ids
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = true
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "sge-app"
    container_port   = var.container_port
  }

  lifecycle {
    ignore_changes = [desired_count]
  }

  tags = local.common_tags
}

# =====================================================
# Network — VPC + subnets públicas (simplificado)
# =====================================================

module "network" {
  source = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "${local.name_prefix}-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["${var.aws_region}a", "${var.aws_region}b"]
  public_subnets  = ["10.0.1.0/24", "10.0.2.0/24"]
  private_subnets = ["10.0.10.0/24", "10.0.11.0/24"]

  enable_nat_gateway = false  # Single-AZ para minimizar coste MVP
  single_nat_gateway = true

  tags = local.common_tags
}

output "public_subnet_ids" {
  value = module.network.public_subnets
}

# =====================================================
# Security groups
# =====================================================

resource "aws_security_group" "app" {
  name        = "${local.name_prefix}-app-sg"
  description = "Acceso HTTP al contenedor Fargate"
  vpc_id      = module.network.vpc_id

  ingress {
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_security_group" "alb" {
  name        = "${local.name_prefix}-alb-sg"
  description = "Acceso público al ALB"
  vpc_id      = module.network.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

# =====================================================
# Application Load Balancer
# =====================================================

resource "aws_lb" "main" {
  name               = "${local.name_prefix}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = module.network.public_subnets

  tags = local.common_tags
}

resource "aws_lb_target_group" "app" {
  name        = "${local.name_prefix}-tg"
  port        = var.container_port
  protocol    = "HTTP"
  vpc_id      = module.network.vpc_id
  target_type = "ip"

  health_check {
    path                = "/api/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
    timeout             = 5
    matcher             = "200"
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# =====================================================
# Secrets — SSM Parameter Store (SecureString)
# =====================================================

resource "aws_ssm_parameter" "db_url" {
  name  = "/${var.project_name}/${var.environment}/database-url"
  type  = "SecureString"
  value = var.neon_database_url

  tags = local.common_tags
}

resource "aws_ssm_parameter" "jwt_secret" {
  name  = "/${var.project_name}/${var.environment}/jwt-secret"
  type  = "SecureString"
  value = var.jwt_secret

  tags = local.common_tags
}

# =====================================================
# IAM roles para ECS
# =====================================================

resource "aws_iam_role" "ecs_execution" {
  name = "${local.name_prefix}-ecs-execution"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# Permiso extra: leer parámetros de SSM
resource "aws_iam_role_policy" "ecs_execution_ssm" {
  name = "${local.name_prefix}-execution-ssm"
  role = aws_iam_role.ecs_execution.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = ["ssm:GetParameters"]
      Resource = [
        aws_ssm_parameter.db_url.arn,
        aws_ssm_parameter.jwt_secret.arn,
      ]
    }]
  })
}

resource "aws_iam_role" "ecs_task" {
  name = "${local.name_prefix}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

# Permiso: S3 RW sobre el bucket
resource "aws_iam_role_policy" "ecs_task_s3" {
  name = "${local.name_prefix}-task-s3"
  role = aws_iam_role.ecs_task.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject",
        "s3:ListBucket",
        "s3:GetObjectVersion",
      ]
      Resource = [
        aws_s3_bucket.uploads.arn,
        "${aws_s3_bucket.uploads.arn}/*",
      ]
    }]
  })
}

# =====================================================
# Outputs
# =====================================================

output "alb_dns_name" {
  description = "DNS del ALB (entrante principal)"
  value       = aws_lb.main.dns_name
}

output "ecr_repository_url" {
  description = "URL del repo ECR"
  value       = aws_ecr_repository.app.repository_url
}

output "s3_bucket_name" {
  description = "Nombre del bucket de uploads"
  value       = aws_s3_bucket.uploads.id
}

output "ecs_cluster_name" {
  description = "Nombre del cluster ECS"
  value       = aws_ecs_cluster.main.name
}

output "ecs_service_name" {
  description = "Nombre del servicio ECS"
  value       = aws_ecs_service.app.name
}
