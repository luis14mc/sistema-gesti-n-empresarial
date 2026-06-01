# Política y Estrategia de Respaldos de Base de Datos

Este documento define la política formal de respaldos (backups) y el plan de recuperación para el Sistema de Gestión Empresarial, alineado con los requerimientos de la norma **ISO/IEC 27001 (Control A.8.13 - Información de respaldo)**.

## 1. Responsabilidad
El área de TI (Administradores del Sistema) es responsable de la configuración, monitoreo y prueba periódica de las copias de seguridad de la base de datos PostgreSQL alojada en Neon.tech.

## 2. Estrategia de Respaldos (Neon.tech)

Dado que la base de datos se encuentra en la plataforma Neon.tech, la estrategia principal aprovecha la característica *Point-in-Time Restore (PITR)* provista por el servicio en la nube.

### 2.1. Retención Automática (PITR)
- **Frecuencia:** Continua (Write-Ahead Logging).
- **Ventana de retención:** 7 días (Plan Estándar).
- **Objetivo (RPO):** Permite restaurar la base de datos a cualquier segundo específico dentro de la ventana de retención (RPO de ~1 segundo).

### 2.2. Respaldos Externos (Cold Backups)
Para protección contra fallos catastróficos a nivel de proveedor o borrado accidental de toda la cuenta de Neon.tech, se debe implementar una tarea de volcado lógico (`pg_dump`).
- **Frecuencia:** Semanal (Madrugada de cada domingo).
- **Herramienta:** GitHub Actions (job programado mediante CRON).
- **Almacenamiento:** Amazon S3 (o almacenamiento en frío equivalente) con versionado habilitado y bloqueo de inmutabilidad de 30 días.

## 3. Procedimiento de Restauración

### Restauración vía Neon (Error Lógico Reciente)
Si un error lógico elimina datos (por ejemplo, ejecución indebida del seed script):
1. Acceder al dashboard de Neon.tech.
2. Seleccionar la rama principal (ej. `main`).
3. Crear una nueva rama a partir de `main` seleccionando el punto en el tiempo (fecha/hora exacta) anterior al incidente.
4. Cambiar el `DATABASE_URL` temporalmente en producción hacia la nueva rama restaurada.
5. Tras verificar la integridad, promover la nueva rama restaurada a principal.

## 4. Pruebas de Restauración
Para cumplir con ISO 27001, la eficacia de los respaldos debe comprobarse regularmente:
- Se realizará un simulacro de restauración (crear una rama a partir del PITR y validar datos) de forma **trimestral**.
- El simulacro será documentado y archivado.
