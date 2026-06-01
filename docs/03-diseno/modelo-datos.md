# Modelo de Datos

## 1. Objetivo
Documentar las entidades principales del dominio de datos y sus relaciones estructurales en la base de datos PostgreSQL.

## 2. Entidades Principales (Esquema v2)

### Entidad: User
- **Descripción:** Empleados y administradores del sistema.
- **Campos Clave:** `id`, `email`, `role`, `departmentId`, `positionId`.
- **Relaciones:** 1:N con `Ticket` (creador/asignado), 1:N con `EquipmentAssignment`, 1:N con `TimeEntry`.

### Entidad: Ticket
- **Descripción:** Solicitudes de soporte (HelpDesk).
- **Campos Clave:** `id`, `title`, `status`, `priority`, `createdById`, `assignedToId`.
- **Relaciones:** N:1 con `User` (Creador), N:1 con `User` (Técnico Asignado).

### Entidad: Equipment (Inventario)
- **Descripción:** Activos de hardware y software corporativo.
- **Campos Clave:** `id`, `inventoryCode`, `brand`, `model`, `status`.
- **Relaciones:** 1:N con `EquipmentAssignment` (historial de tenencia).

### Entidad: TimeEntry (Asistencia)
- **Descripción:** Registros de reloj checador (Check-in / Check-out).
- **Campos Clave:** `id`, `userId`, `date`, `entryTime`, `exitTime`.
- **Relaciones:** N:1 con `User`.

### Entidad: AuditRecord
- **Descripción:** Bitácora inmutable de eventos críticos de seguridad o sistema.
- **Campos Clave:** `id`, `userId`, `module`, `category`, `description`.

## 3. Diccionario de Datos Físico
La versión autoritativa del diccionario de datos se encuentra codificada en el archivo `prisma/schema.prisma`. Cualquier alteración a las tablas debe reflejarse primero en dicho archivo, someterse a *Pull Request* y migrar hacia PostgreSQL vía `npx prisma db push` o `npx prisma migrate`.
