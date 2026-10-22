# Acta de entrega — SGE (producción)

## 1. Datos del lanzamiento

| Campo | Valor |
| --- | --- |
| **Versión** | 1.0.0 (entrega operativa) |
| **Plataforma** | **Railway** (aplicación Node.js + PostgreSQL) |
| **Almacenamiento de archivos** | **Cloudflare R2** (API compatible S3; no AWS como plataforma principal) |
| **Arquitectura** | Monolito modular por capas — [ADR 003](../adr/003-arquitectura-monolito-modular.md) |
| **Seguridad** | Auditoría interna **2026-10-19** cerrada; remediaciones aplicadas en código y despliegue |

## 2. Módulos entregados

| Módulo | Alcance entregado |
| --- | --- |
| **Oficios / Correspondencia** | CNI, Despacho, internos; workflow, adjuntos, búsqueda, importación Excel |
| **Equipos** | Inventario, asignaciones, actas, devoluciones, cambio de equipo |
| **Mantenimiento / Bajas** | Mantenimientos de equipos; dictámenes / flujo de baja (equipment disposal) |
| **Compras** | Órdenes de compra (borrador → generar → emitir → cerrar/anular), proveedores, documentos, reportes y exportación |
| **Planilla** | Configuración ISR/IHSS, generación mensual, boletas PDF, envío por correo, histórico |
| **Usuarios / Roles / Permisos** | Usuarios, roles de organización, matriz de permisos y overrides |
| **Auditoría** | Registro de eventos del sistema (consulta según rol) |
| **Reportes** | Catálogo y exportaciones según permisos |
| **Licencias de software** | Gestión de licencias (módulo platform) |

**Fuera de alcance / deprecado:** Tickets (helpdesk), Asistencia (marcaje), inventario promocional legacy; no forman parte de esta entrega.

## 3. Estado de calidad

- Checklist de producción: [checklist-produccion.md](./checklist-produccion.md)
- Pruebas de aceptación usuarios: [pruebas-aceptacion-usuarios.md](../05-pruebas/pruebas-aceptacion-usuarios.md)
- CI: typecheck, lint y tests automatizados en repositorio

## 4. Pendientes posentrega (no bloquean entrega)

| Tema | Notas |
| --- | --- |
| Normalización de BD | Ramas `chore/db-normalization-*`; patrón expandir → migrar → contraer |
| Microsoft Graph | Integración de correo/calendario institucional (si aplica) |
| `pnpm` en imagen Docker | Hoy runtime usa standalone + dependencias necesarias para Prisma CLI; optimización opcional |
| Validación de IP detrás de proxy | Endurecer confianza en `X-Forwarded-For` / rate limit en edge Railway |

## 5. Firmas

| Rol | Nombre | Fecha |
| --- | --- | --- |
| Responsable técnico | | |
| QA / aceptación usuario | | |
| Patrocinador | | |
