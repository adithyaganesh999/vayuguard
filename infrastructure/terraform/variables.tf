# =============================================================================
# VayuGuard - Terraform Variables
# =============================================================================
# Configurable parameters for AWS infrastructure deployment
# =============================================================================

# ---------- General ----------
variable "aws_region" {
  description = "AWS region for infrastructure deployment"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment (staging, production)"
  type        = string
  default     = "staging"

  validation {
    condition     = contains(["staging", "production"], var.environment)
    error_message = "Environment must be either 'staging' or 'production'."
  }
}

variable "project_name" {
  description = "Project name used as prefix for all resources"
  type        = string
  default     = "vayuguard"
}

# ---------- Networking ----------
variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"

  validation {
    condition     = can(cidrnetmask(var.vpc_cidr))
    error_message = "Must be a valid CIDR block."
  }
}

# ---------- ECS Fargate - Frontend ----------
variable "frontend_cpu" {
  description = "CPU units for frontend ECS task (256, 512, 1024, 2048)"
  type        = number
  default     = 256

  validation {
    condition     = contains([256, 512, 1024, 2048], var.frontend_cpu)
    error_message = "Frontend CPU must be 256, 512, 1024, or 2048."
  }
}

variable "frontend_memory" {
  description = "Memory (MiB) for frontend ECS task"
  type        = number
  default     = 512
}

variable "frontend_desired_count" {
  description = "Desired number of frontend task instances"
  type        = number
  default     = 2
}

# ---------- ECS Fargate - Backend ----------
variable "backend_cpu" {
  description = "CPU units for backend ECS task"
  type        = number
  default     = 512
}

variable "backend_memory" {
  description = "Memory (MiB) for backend ECS task"
  type        = number
  default     = 1024
}

variable "backend_desired_count" {
  description = "Desired number of backend task instances"
  type        = number
  default     = 3
}

variable "backend_max_count" {
  description = "Maximum number of backend tasks for auto-scaling"
  type        = number
  default     = 10
}

# ---------- ECS Fargate - ML Service ----------
variable "ml_cpu" {
  description = "CPU units for ML service ECS task"
  type        = number
  default     = 1024
}

variable "ml_memory" {
  description = "Memory (MiB) for ML service ECS task"
  type        = number
  default     = 4096
}

variable "ml_desired_count" {
  description = "Desired number of ML service task instances"
  type        = number
  default     = 2
}

# ---------- Database - RDS PostgreSQL ----------
variable "postgres_instance_class" {
  description = "RDS instance class for PostgreSQL"
  type        = string
  default     = "db.r6g.large"
}

variable "db_master_password" {
  description = "Master password for RDS PostgreSQL"
  type        = string
  sensitive   = true
}

# ---------- Database - DocumentDB ----------
variable "docdb_instance_class" {
  description = "Instance class for DocumentDB"
  type        = string
  default     = "db.r6g.large"
}

variable "docdb_master_password" {
  description = "Master password for DocumentDB"
  type        = string
  sensitive   = true
}

# ---------- ElastiCache Redis ----------
variable "redis_node_type" {
  description = "ElastiCache node type for Redis"
  type        = string
  default     = "cache.r6g.large"
}

# ---------- Container Registry ----------
variable "ecr_repository_url" {
  description = "ECR repository URL for VayuGuard images"
  type        = string
  default     = "012345678901.dkr.ecr.us-east-1.amazonaws.com/vayuguard"
}

variable "image_tag" {
  description = "Docker image tag to deploy"
  type        = string
  default     = "latest"
}

# ---------- TLS / SSL ----------
variable "certificate_arn" {
  description = "ACM certificate ARN for HTTPS"
  type        = string
}

# ---------- Monitoring ----------
variable "log_retention_days" {
  description = "CloudWatch log retention period in days"
  type        = number
  default     = 30

  validation {
    condition     = contains([1, 3, 5, 7, 14, 30, 60, 90, 120, 150, 180, 365], var.log_retention_days)
    error_message = "Must be a valid CloudWatch retention period."
  }
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for CloudWatch alarm notifications"
  type        = string
  default     = ""
}

# ---------- Tags ----------
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
