# =============================================================================
# VayuGuard - Terraform Infrastructure (AWS)
# =============================================================================
# ECS Fargate, RDS PostgreSQL, DocumentDB, ElastiCache, ALB, CloudWatch
# =============================================================================

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "vayuguard-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "vayuguard-terraform-locks"
  }
}

# ---------- AWS Provider ----------
provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "VayuGuard"
      Environment = var.environment
      ManagedBy   = "terraform"
      Owner       = "devops@vayuguard.com"
    }
  }
}

# ---------- Data Sources ----------
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# ---------- VPC ----------
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "vayuguard-vpc-${var.environment}"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  tags   = { Name = "vayuguard-igw-${var.environment}" }
}

# Public subnets for ALB
resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
  tags = { Name = "vayuguard-public-${count.index}-${var.environment}" }
}

# Private subnets for services
resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + 2)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  tags = { Name = "vayuguard-private-${count.index}-${var.environment}" }
}

# NAT Gateway for private subnet egress
resource "aws_eip" "nat" {
  domain = "vpc"
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
  depends_on    = [aws_internet_gateway.main]
  tags          = { Name = "vayuguard-nat-${var.environment}" }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }
  tags = { Name = "vayuguard-private-rt-${var.environment}" }
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ---------- Security Groups ----------
resource "aws_security_group" "alb" {
  name        = "vayuguard-alb-sg-${var.environment}"
  description = "ALB security group for VayuGuard"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "ecs" {
  name        = "vayuguard-ecs-sg-${var.environment}"
  description = "ECS Fargate services security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 0
    to_port         = 0
    protocol        = "-1"
    security_groups = [aws_security_group.alb.id]
  }
  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ---------- ALB ----------
resource "aws_lb" "main" {
  name               = "vayuguard-alb-${var.environment}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = var.environment == "production" ? true : false
}

resource "aws_lb_target_group" "frontend" {
  name        = "vayuguard-frontend-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    path                = "/"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 3
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group" "backend" {
  name        = "vayuguard-backend-tg"
  port        = 5000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    path                = "/api/v1/health"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 3
    unhealthy_threshold = 3
  }
}

resource "aws_lb_target_group" "ml_service" {
  name        = "vayuguard-ml-tg"
  port        = 8000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "ip"
  health_check {
    path                = "/health"
    interval            = 30
    timeout             = 10
    healthy_threshold   = 3
    unhealthy_threshold = 3
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn
  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.frontend.arn
  }
}

resource "aws_lb_listener_rule" "backend" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 100
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
  condition {
    path_pattern { values = ["/api/v1/*"] }
  }
}

resource "aws_lb_listener_rule" "ml_service" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 99
  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.ml_service.arn
  }
  condition {
    path_pattern { values = ["/api/ml/*"] }
  }
}

# ---------- ECS Cluster ----------
resource "aws_ecs_cluster" "main" {
  name = "vayuguard-cluster-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

resource "aws_cloudwatch_log_group" "ecs" {
  name              = "/vayuguard/ecs/${var.environment}"
  retention_in_days = var.log_retention_days
}

# ---------- ECS Task Definitions ----------
resource "aws_ecs_task_definition" "frontend" {
  family                   = "vayuguard-frontend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.frontend_cpu
  memory                   = var.frontend_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "frontend"
      image     = "${var.ecr_repository_url}/frontend:${var.image_tag}"
      essential = true
      portMappings = [{ containerPort = 3000, protocol = "tcp" }]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "frontend"
        }
      }
    }
  ])
}

resource "aws_ecs_task_definition" "backend" {
  family                   = "vayuguard-backend"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.backend_cpu
  memory                   = var.backend_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "backend"
      image     = "${var.ecr_repository_url}/backend:${var.image_tag}"
      essential = true
      portMappings = [{ containerPort = 5000, protocol = "tcp" }]
      environment = [
        { name = "NODE_ENV", value = var.environment },
        { name = "PORT", value = "5000" },
        { name = "ML_SERVICE_URL", value = "http://vayuguard-ml-service:8000" }
      ]
      secrets = [
        { name = "MONGODB_URI", valueFrom = aws_secretsmanager_secret.mongodb.arn },
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.postgres.arn },
        { name = "REDIS_URL", valueFrom = aws_secretsmanager_secret.redis.arn },
        { name = "JWT_SECRET", valueFrom = aws_secretsmanager_secret.jwt.arn }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "backend"
        }
      }
    }
  ])
}

resource "aws_ecs_task_definition" "ml_service" {
  family                   = "vayuguard-ml-service"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.ml_cpu
  memory                   = var.ml_memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn            = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name      = "ml-service"
      image     = "${var.ecr_repository_url}/ml-service:${var.image_tag}"
      essential = true
      portMappings = [{ containerPort = 8000, protocol = "tcp" }]
      environment = [
        { name = "MODEL_PATH", value = "/app/models" },
        { name = "WORKERS", value = "4" },
        { name = "LOG_LEVEL", value = "INFO" }
      ]
      secrets = [
        { name = "DATABASE_URL", valueFrom = aws_secretsmanager_secret.postgres.arn },
        { name = "REDIS_URL", valueFrom = aws_secretsmanager_secret.redis.arn }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.ecs.name
          "awslogs-region"        = var.aws_region
          "awslogs-stream-prefix" = "ml-service"
        }
      }
    }
  ])
}

# ---------- ECS Services ----------
resource "aws_ecs_service" "frontend" {
  name            = "vayuguard-frontend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.frontend.arn
  desired_count   = var.frontend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.frontend.arn
    container_name   = "frontend"
    container_port   = 3000
  }
}

resource "aws_ecs_service" "backend" {
  name            = "vayuguard-backend"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.backend.arn
  desired_count   = var.backend_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.backend.arn
    container_name   = "backend"
    container_port   = 5000
  }
}

resource "aws_ecs_service" "ml_service" {
  name            = "vayuguard-ml-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.ml_service.arn
  desired_count   = var.ml_desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets         = aws_subnet.private[*].id
    security_groups = [aws_security_group.ecs.id]
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.ml_service.arn
    container_name   = "ml-service"
    container_port   = 8000
  }
}

# ---------- RDS PostgreSQL ----------
resource "aws_db_subnet_group" "main" {
  name       = "vayuguard-db-subnet-${var.environment}"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_db_parameter_group" "main" {
  family = "postgres16"
  name   = "vayuguard-pg-params-${var.environment}"

  parameter {
    name  = "log_connections"
    value = "1"
  }
  parameter {
    name  = "log_min_duration_statement"
    value = "500"
  }
}

resource "aws_rds_cluster" "postgres" {
  engine                     = "aurora-postgresql"
  engine_version             = "16.1"
  database_name              = "vayuguard"
  master_username            = "vayuguard_admin"
  master_password            = var.db_master_password
  db_subnet_group_name       = aws_db_subnet_group.main.name
  vpc_security_group_ids     = [aws_security_group.ecs.id]
  availability_zones         = data.aws_availability_zones.available.names[:2]
  backup_retention_period    = var.environment == "production" ? 30 : 7
  preferred_backup_window    = "03:00-04:00"
  skip_final_snapshot        = var.environment != "production"
  final_snapshot_identifier  = "vayuguard-final-snapshot"
  storage_encrypted          = true
  deletion_protection        = var.environment == "production"
}

resource "aws_rds_cluster_instance" "postgres" {
  count                = var.environment == "production" ? 2 : 1
  identifier           = "vayuguard-pg-${count.index}-${var.environment}"
  cluster_identifier   = aws_rds_cluster.postgres.id
  instance_class       = var.postgres_instance_class
  engine               = aws_rds_cluster.postgres.engine
  engine_version       = aws_rds_cluster.postgres.engine_version
  performance_insights_enabled = true
}

# ---------- DocumentDB (MongoDB-compatible) ----------
resource "aws_docdb_subnet_group" "main" {
  name       = "vayuguard-docdb-subnet-${var.environment}"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_docdb_cluster" "main" {
  cluster_identifier      = "vayuguard-docdb-${var.environment}"
  engine                  = "docdb"
  engine_version          = "5.0.0"
  master_username         = "vayuguard_admin"
  master_password         = var.docdb_master_password
  db_subnet_group_name    = aws_docdb_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.ecs.id]
  backup_retention_period = var.environment == "production" ? 30 : 7
  preferred_backup_window = "04:00-05:00"
  skip_final_snapshot     = var.environment != "production"
  storage_encrypted       = true
}

resource "aws_docdb_cluster_instance" "main" {
  count              = var.environment == "production" ? 2 : 1
  identifier         = "vayuguard-docdb-${count.index}-${var.environment}"
  cluster_identifier = aws_docdb_cluster.main.id
  instance_class     = var.docdb_instance_class
}

# ---------- ElastiCache Redis ----------
resource "aws_elasticache_subnet_group" "main" {
  name       = "vayuguard-redis-subnet-${var.environment}"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id     = "vayuguard-redis-${var.environment}"
  description              = "VayuGuard Redis cluster"
  node_type                = var.redis_node_type
  number_cache_clusters    = var.environment == "production" ? 2 : 1
  subnet_group_name        = aws_elasticache_subnet_group.main.name
  security_group_ids       = [aws_security_group.ecs.id]
  parameter_group_name     = "default.redis7"
  engine                   = "redis"
  engine_version           = "7.1"
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  automatic_failover_enabled = var.environment == "production" ? true : false
  multi_az_enabled          = var.environment == "production" ? true : false
  snapshot_retention_limit = var.environment == "production" ? 7 : 1
}

# ---------- Secrets Manager ----------
resource "aws_secretsmanager_secret" "mongodb" {
  name                    = "vayuguard/mongodb-uri-${var.environment}"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "postgres" {
  name                    = "vayuguard/postgres-uri-${var.environment}"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "redis" {
  name                    = "vayuguard/redis-uri-${var.environment}"
  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret" "jwt" {
  name                    = "vayuguard/jwt-secret-${var.environment}"
  recovery_window_in_days = 7
}

# ---------- IAM Roles ----------
resource "aws_iam_role" "ecs_execution" {
  name = "vayuguard-ecs-execution-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_execution" {
  role       = aws_iam_role.ecs_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task" {
  name = "vayuguard-ecs-task-${var.environment}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = { Service = "ecs-tasks.amazonaws.com" }
    }]
  })
}

resource "aws_iam_role_policy" "ecs_task_secrets" {
  name = "vayuguard-secrets-access"
  role = aws_iam_role.ecs_task.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [aws_secretsmanager_secret.mongodb.arn, aws_secretsmanager_secret.postgres.arn, aws_secretsmanager_secret.redis.arn, aws_secretsmanager_secret.jwt.arn]
      },
      {
        Effect   = "Allow"
        Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
        Resource = aws_cloudwatch_log_group.ecs.arn
      }
    ]
  })
}

# ---------- CloudWatch Alarms ----------
resource "aws_cloudwatch_metric_alarm" "high_cpu" {
  alarm_name          = "vayuguard-high-cpu-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "CPUUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "VayuGuard ECS CPU usage above 80%"
  alarm_actions       = [var.sns_topic_arn]

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
  }
}

resource "aws_cloudwatch_metric_alarm" "high_memory" {
  alarm_name          = "vayuguard-high-memory-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "MemoryUtilization"
  namespace           = "AWS/ECS"
  period              = 300
  statistic           = "Average"
  threshold           = 80
  alarm_description   = "VayuGuard ECS memory usage above 80%"
  alarm_actions       = [var.sns_topic_arn]

  dimensions = {
    ClusterName = aws_ecs_cluster.main.name
  }
}

resource "aws_cloudwatch_metric_alarm" "db_connections" {
  alarm_name          = "vayuguard-db-connections-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "DatabaseConnections"
  namespace           = "AWS/RDS"
  period              = 300
  statistic           = "Average"
  threshold           = 500
  alarm_description   = "VayuGuard RDS connection count above 500"
  alarm_actions       = [var.sns_topic_arn]

  dimensions = {
    DBClusterIdentifier = aws_rds_cluster.postgres.cluster_identifier
  }
}

# ---------- Auto Scaling ----------
resource "aws_appautoscaling_target" "backend" {
  max_capacity       = var.backend_max_count
  min_capacity       = var.backend_desired_count
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.backend.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "backend_cpu" {
  name               = "vayuguard-backend-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.backend.resource_id
  scalable_dimension = aws_appautoscaling_target.backend.scalable_dimension
  service_namespace  = aws_appautoscaling_target.backend.service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value       = 70
    scale_in_cooldown  = 300
    scale_out_cooldown = 60
  }
}
