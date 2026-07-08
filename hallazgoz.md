# 🔍 Hallazgos de Revisión UI vs Nueva Estructura Prisma

*Informe detallado de discrepancias encontradas el 27 de febrero de 2026*

## 🔴 Discrepancias Críticas (Bloqueantes/Integridad)

### 1. Gestión de Adjuntos Institucionales
- **[Tickets]**: Se implementó la obligatoriedad de `attachmentUrl` en el backend, pero en el panel de detalle (`TicketDetailPanel`) no existe un visualizador para esta imagen. El usuario puede subirla pero no puede verla después.
- **[Oficios]**: 
    - El formulario de creación en el frontend NO incluye el campo para `attachmentUrl`. El backend fallará al intentar crear un oficio sin este campo obligatorio.
    - El panel de detalle no muestra el enlace al documento PDF/Imagen adjunto.

### 2. Sincronización de Tipos (TypeScript)
- Se detectaron casting a `any` en `src/app/api/tickets/route.ts` y otros archivos debido a que el cliente de Prisma regenerado no parece estar siendo reconocido plenamente por el servidor de lenguaje en tiempo real. 
- Existen campos como `deletedAt` que, aunque operativos en el motor DB, requieren una actualización manual de los tipos en `src/types/index.ts` para evitar el uso de `any`.

---

## 🟡 Observaciones de Experiencia de Usuario (UI/UX)

### 3. Integración de Auditoría
- Se creó la página `/admin/audit-logs`, pero está aislada. No hay forma de saltar desde un Ticket o un Equipo específico a su historial de auditoría filtrado.
- La trazabilidad es técnica (BD) pero no intuitiva para el administrador en la vista de gestión.

### 4. Visualización GPS en Asistencia
- El sistema captura y muestra las coordenadas correctamente. Sin embargo, la UI usa un enlace de texto simple. 
- **Sugerencia**: Usar iconos de mapas modernos y quizás un pequeño mapa estático o interactivo en el detalle del registro para una sensación más "Premium".

### 5. Gestión de Soft Deletes
- No hay una vista de "Papelera" o "Archivados" para que un administrador pueda restaurar un registro (Ticket/Equipo/Oficio) marcado con `deletedAt`. Actualmente, la eliminación es "para siempre" desde el punto de vista de la UI normal.

---

## 🟢 Fortalezas Identificadas
- **Dashboard Real**: El dashboard ya no es estático; consume datos reales de Prisma satisfactoriamente.
- **Flujo de Asistencia**: La lógica de geolocalización es sólida y bloquea el marcado si no se concede permiso, asegurando la integridad de los datos de campo.
- **Clean Architecture**: Los servicios y hooks están bien separados, lo que facilita la corrección de estos hallazgos.
