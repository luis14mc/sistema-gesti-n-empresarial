# Flujos de Proceso

## 1. Objetivo
Modelar textualmente la secuencia de pasos lógicos de los flujos críticos del sistema empresarial.

## 2. Flujo Crítico: Creación y Asignación de Ticket

1. **[Actor: USER]** Inicia sesión en el sistema.
2. **[Actor: USER]** Navega a la vista de "Mis Tickets" y hace clic en "Nuevo Ticket".
3. **[Sistema]** Muestra formulario modal de creación.
4. **[Actor: USER]** Llena Título, Descripción y Prioridad, y hace clic en "Guardar".
5. **[API]** Valida datos (Zod) e identidad (JWT/Cookie).
6. **[API]** Registra el Ticket en base de datos.
7. **[Auditoría]** Registra el evento en `AuditRecord`.
8. **[Actor: ADMIN/IT]** Recibe (o busca) el nuevo Ticket con estado "Abierto".
9. **[Actor: ADMIN/IT]** Asigna el Ticket a un miembro técnico.
10. **[Sistema]** Cambia el estado a "En Progreso" y alerta visualmente al técnico.

## 3. Flujo Crítico: Asistencia (Check-in)

1. **[Actor: EMPLEADO]** Ingresa al sistema.
2. **[Sistema]** Verifica en BD si existe un `TimeEntry` de la fecha actual sin hora de salida.
3. **[Actor: EMPLEADO]** Pulsa el botón "Registrar Entrada".
4. **[API]** Confirma la estampa de tiempo en el servidor y crea registro.
5. **[Sistema]** Transforma el botón de interfaz a "Registrar Salida".

## 4. Observaciones
La lógica de validación de los flujos siempre debe ocurrir en el backend (Server Actions / API Routes). Nunca se debe confiar exclusivamente en las restricciones de los botones del Frontend.
