# =====================================================
# AWS Infrastructure — SGE
# Terraform mínimo para App Runner / Fargate en AWS
# =====================================================

Este directorio contiene la IaC para desplegar el SGE en AWS usando:

- **VPC + subnets** (`terraform-aws-modules/vpc`)
- **ECR** (registro de imágenes Docker)
- **ECS Fargate** (ejecución serverless del contenedor)
- **ALB** (Application Load Balancer para entrada HTTP/HTTPS)
- **S3** (almacenamiento de archivos subidos)
- **SSM Parameter Store** (secrets cifrados: DATABASE_URL, JWT_SECRET)
- **IAM** (roles + políticas de mínimo privilegio)
- **CloudWatch Logs** (logs centralizados, retención 30 días)

## Componentes

| Recurso | Nombre generado | Propósito |
|---|---|---|
| ECR repo | `sge-{env}` | Imágenes Docker |
| ECS cluster | `sge-{env}-cluster` | Cluster Fargate |
| ECS task | `sge-{env}-app` | Definición de contenedor |
| ECS service | `sge-{env}-service` | Orquestación (desired=2 tareas) |
| ALB | `sge-{env}-alb` | Balanceo HTTP/HTTPS |
| Target group | `sge-{env}-tg` | Apunta al contenedor |
| S3 bucket | `sge-{env}-uploads-<random>` | Archivos subidos |
| Log group | `/ecs/sge-{env}/app` | Logs del contenedor |
| SSM params | `/sge/{env}/database-url`, `/sge/{env}/jwt-secret` | Secretos |
| IAM roles | `sge-{env}-ecs-execution`, `sge-{env}-ecs-task` | Permisos |

## Quick Start

### 1. Preparar el secreto de Neon y JWT

```bash
export TF_VAR_neon_database_url="postgresql://neondb_owner:PASS@HOST/cni_system?sslmode=require"
export TF_VAR_jwt_secret="$(openssl rand -base64 48)"
```

### 2. Construir y subir la imagen

```bash
# Login a ECR
aws ecr get-login-password --region us-east-2 | \
  docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-2.amazonaws.com

# Build + tag + push
docker build -t sge:v1.0.0 .
docker tag sge:v1.0.0 123456789012.dkr.ecr.us-east-2.amazonaws.com/sge/staging:v1.0.0
docker push 123456789012.dkr.ecr.us-east-2.amazonaws.com/sge/staging:v1.0.0
```

### 3. Aplicar IaC

```bash
cd infra/terraform
cp terraform.tfvars.example terraform.tfvars
# Editar terraform.tfvars con container_image y demás

terraform init
terraform plan -out plan.tfplan
terraform apply plan.tfplan
```

### 4. Verificar

```bash
# Output con ALB DNS
terraform output alb_dns_name

# Smoke test
curl http://$(terraform output -raw alb_dns_name)/api/health
```

## Variables de entrada

| Variable | Tipo | Default | Sensible | Descripción |
|---|---|---|---|---|
| `project_name` | string | `sge` | no | Prefijo de recursos |
| `environment` | enum | `staging` | no | `staging` o `production` |
| `aws_region` | string | `us-east-2` | no | Región AWS |
| `container_image` | string | (requerido) | no | URI ECR completa |
| `container_port` | number | `3000` | no | Puerto Next.js |
| `neon_database_url` | string | (requerido) | **sí** | Cadena pooled de Neon |
| `jwt_secret` | string | (requerido) | **sí** | ≥32 caracteres |

## Costos estimados (staging)

| Recurso | Coste/mes |
|---|---|
| Fargate 2× (0.25 vCPU, 0.5 GB) | ~$8 |
| ALB | ~$20 |
| S3 (1 GB + requests) | ~$1 |
| CloudWatch Logs (5 GB) | ~$3 |
| SSM Parameters | ~$0.50 |
| Data transfer | ~$2 |
| **Total** | **~$35 USD** |

## Alternativa más simple: AWS App Runner

Si prefieres no administrar ECS/ALB/VPC, considera AWS App Runner:
- 1 servicio, 0 gestión de infraestructura
- Pricing: $0.007/hora de cómputo + $0.10/GB memoria
- HTTPS automático con certificados gestionados
- Conecta directamente al repo ECR o GitHub

Sin embargo, App Runner **no soporta VPC privada** sin NAT, lo que
complica la conexión a Neon si Neon está en VPC restringida. Para este
proyecto, Fargate + ALB ofrece más control sin coste significativamente
mayor.

## Rollback

```bash
# Re-deploy versión anterior
terraform apply \
  -var="container_image=123456789012.dkr.ecr.us-east-2.amazonaws.com/sge/staging:v0.9.0"
```

O usando ECS update-service con `--force-new-deployment` apuntando a la
revisión anterior del task definition.

## Notas de seguridad

- **Secrets** nunca en código: todas las credenciales se pasan vía `TF_VAR_*` o
  se leen de SSM Parameter Store (cifrado KMS-managed).
- **S3** bloquea acceso público (`block_public_acls`, etc.).
- **SG** del contenedor solo acepta tráfico desde el SG del ALB (no directo).
- **Logs**: retención 30 días; enviar a bucket S3 inmutable para >30 días
  si auditoría a largo plazo lo requiere.
- **Versioning** en S3 activado + lifecycle a Glacier tras 90 días.
- **WAF**: pendiente Sprint 4+ (rate limiting por IP/geo, AWS managed rules).
