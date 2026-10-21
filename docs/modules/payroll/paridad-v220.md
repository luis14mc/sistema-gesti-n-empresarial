# Paridad Planilla SGE ↔ Pagos CNI v2.2.0

Referencia: `luis14mc/sistema-gestion-de-notificaciones-de-pagos` (`server.py`, `templates/index.html`).

| Función (original) | Ubicación SGE | Estado |
| --- | --- | --- |
| Panel Configuración SMTP (host, puerto, usuario, contraseña, emisor, remitente) | `PUT/GET /api/planilla/configuracion/smtp`, UI `src/app/planilla/configuracion/page.tsx`, `payroll_smtp_settings` | ✅ |
| Cifrado contraseña SMTP (AES-256-GCM + `PAYROLL_SECRETS_KEY`) | `src/modules/payroll/infrastructure/payroll-secrets-crypto.ts` | ✅ |
| Prioridad SMTP BD → env `SMTP_*` | `getOrganizationSmtpRuntimeConfig` | ✅ |
| Probar conexión SMTP (config guardada) | `POST /api/planilla/configuracion/smtp/probar` | ✅ |
| Personal: tarjetas totales / planilla / promedio | `src/app/planilla/empleados/page.tsx` + `listPayrollEmployees` stats | ✅ |
| Búsqueda por nombre, código, cargo | `listPayrollEmployees` (`position.name`) | ✅ |
| Tabla personal (código, IHSS, ISR*, otro, correo) | `src/app/planilla/empleados/page.tsx` | ✅ |
| Otro descuento + observación en empleado | `employees.otherDeductionNote`, edición planilla | ✅ |
| Concepto otro desde empleado al generar | `resolveOtroForGeneration` en `payroll-service.ts` | ✅ |
| Código autogenerado CNIxxx | `GET /api/payroll/employees/next-code` | ✅ |
| Alta/edición completa empleado (CRUD SQLite) | RRHH / módulo empleados institucional | ⚠️ SGE no duplica CRUD; planilla edita campos de nómina sobre empleados existentes |
| IHSS/ISR persistidos en fila empleado | Cálculo al vuelo al listar/generar | ⚠️ Equivalente funcional al generar boletas; no se guarda ISR/IHSS en `employees` |
| Boleta: selector, periodo 20–20, vista previa | `src/app/planilla/page.tsx` | ✅ |
| Exportar PDF / Enviar correo / PDF+correo individual | `generatePayslip` + `sendPayslipEmails` | ✅ |
| Generar todos (modo PDF / correo / ambos) + resumen ✓/✗ | `POST /api/payroll/payslips/batch` (`deliveryMode`) + modal UI | ✅ |
| Histórico: tarjetas, filtros, paginación, detalle, export auditoría | `src/app/planilla/historico/page.tsx` | ✅ |
| Config ISR/IHSS + tabla progresiva editable | `src/app/planilla/configuracion/page.tsx` + APIs settings/ISR | ✅ |
| Probar cálculo ISR | `POST /api/payroll/isr/preview` | ✅ |
| Recalcular todos los empleados | `POST /api/payroll/deductions/recalculate-all` (auditoría; cálculo en generación) | ⚠️ Ver nota ISR persistido |
| Restablecer tabla ISR 2026 | `resetIsrBrackets2026` | ✅ |
| Eliminar empleado con boletas | Desactivar (`payrollEnabled` / `isActive`) — no DELETE | ✅ (política SGE) |
| Plantilla visual PDF/correo CNI | Sin cambios (`payslip-pdf.ts`, email HTML) | ✅ (intencional) |
