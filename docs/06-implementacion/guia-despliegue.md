# Guía de Despliegue

## 1. Entorno Objetivo
El sistema está diseñado preferencialmente para desplegarse en plataformas Serverless como Vercel o servidores Node.js gestionados mediante contenedores Docker.

## 2. Requisitos Previos
- Node.js versión 20.x o superior.
- Base de datos PostgreSQL (idealmente aprovisionada).
- Variables de entorno críticas configuradas (ver `SECURITY.md`).

## 3. Pasos de Despliegue

### Paso 1: Obtención de Código
```bash
git pull origin main
```

### Paso 2: Instalación Inmutable de Dependencias
```bash
npm ci
```

### Paso 3: Migración de Base de Datos
Actualizar el esquema sin pérdida de datos:
```bash
npx prisma db push
# O alternativamente, si se usan migraciones históricas:
# npx prisma migrate deploy
```

### Paso 4: Compilación Estática y Servidor
```bash
npm run build
```

### Paso 5: Inicio del Servidor
```bash
npm run start
```

## 4. Notas Post-Despliegue
Tras reiniciar el servicio, se debe verificar el archivo de log en búsqueda de advertencias (Warnings) al conectar con la base de datos.
