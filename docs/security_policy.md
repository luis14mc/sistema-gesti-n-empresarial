# Política de Seguridad de la Información

## 1. Propósito
Establecer las directrices formales para proteger la confidencialidad, integridad y disponibilidad del Sistema de Gestión Empresarial y los datos que procesa, de acuerdo con los lineamientos de la norma **ISO/IEC 27001:2022**.

## 2. Alcance
Esta política aplica a todos los empleados, contratistas y terceros que utilicen, administren o desarrollen el sistema.

## 3. Directrices de Control de Acceso (A.8)
- **Principio de Mínimo Privilegio:** Todo usuario ingresará al sistema con el nivel más bajo de acceso requerido para sus funciones (rol `USER`). Los permisos superiores (`ADMIN`, `IT`, `RRHH`) deben solicitarse formalmente y ser aprobados.
- **Autenticación:** Las contraseñas deben cifrarse en la base de datos utilizando algoritmos fuertes (bcrypt). Las sesiones se gestionan mediante JWT con vigencia de máximo 1 hora.

## 4. Gestión de Activos y Manejo de Información
- **Credenciales:** Está estrictamente prohibido exponer contraseñas, secretos JWT o tokens de API en código fuente, archivos `.env.example` o repositorios (Control A.8.12).
- **Destrucción de Datos:** La eliminación de registros se gestionará preferiblemente mediante "Soft-Deletes". En caso de borrado definitivo, se debe asegurar que no queden remanentes accesibles.

## 5. Auditoría y Trazabilidad (A.8.15)
- Toda acción de escritura, modificación, acceso administrativo o falla en la seguridad debe quedar documentada inmutablemente en el registro de auditoría (`AuditRecord`).
- Ningún usuario, incluyendo administradores, podrá alterar los registros de auditoría del sistema.

## 6. Sanciones (A.6)
El incumplimiento intencional de estas políticas, particularmente el uso malicioso de credenciales o la manipulación de registros de auditoría, resultará en la revocación inmediata del acceso y posibles medidas disciplinarias.
