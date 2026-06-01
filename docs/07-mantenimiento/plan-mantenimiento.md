# Plan de Mantenimiento

## 1. Objetivo
Garantizar la estabilidad operativa del sistema en el largo plazo, mitigando la degradación del software y previniendo la acumulación de deuda técnica.

## 2. Tipos de Mantenimiento Contemplados
- **Correctivo:** Resolución de errores reportados post-lanzamiento (Bugs urgentes).
- **Preventivo:** Actualización de librerías (`npm update`), parcheo de vulnerabilidades (NPM Audit) de forma mensual.
- **Evolutivo:** Adición de nuevas características basadas en el Change Request Tracker.

## 3. Monitoreo y Auditoría Operativa
El equipo de TI deberá revisar trimestralmente la tabla `AuditRecord` para identificar comportamientos anómalos de usuarios o escaladas de intentos de acceso.

## 4. Gestión de Dependencias
- Las dependencias principales (Next.js, Prisma, React) se mantendrán en sus versiones *Minor* estables.
- Actualizaciones mayores (*Major Updates*) requerirán un RFC arquitectónico previo debido al riesgo de ruptura.
