# Política de Seguridad

Nos tomamos muy en serio la seguridad de nuestro Sistema de Gestión Empresarial. Este documento dicta cómo reportar vulnerabilidades y las prácticas fundamentales de desarrollo seguro.

## 1. Reporte de Vulnerabilidades
Si descubres una vulnerabilidad de seguridad, **por favor, no la hagas pública creando un Issue**.
Envíenos un correo electrónico directamente al equipo de seguridad corporativo. Evaluaremos el riesgo y proporcionaremos un parche en la brevedad posible.

## 2. Manejo de Credenciales
- Queda **estrictamente prohibido** versionar contraseñas, claves secretas o tokens en los repositorios de código.
- Los archivos de variables de entorno de ejemplo (`.env.example`) solo deben contener *placeholders* (ej. `TU_CLAVE_AQUI`).
- La auditoría automatizada rechazará PRs que expongan llaves.

## 3. Uso de Variables de Entorno
- Variables exclusivas del lado del servidor (ej. `DATABASE_URL`, `JWT_SECRET`) nunca deben llevar el prefijo `NEXT_PUBLIC_`.
- El acceso a variables de servidor solo debe ocurrir dentro de `src/app/api`, Server Actions o Server Components.

## 4. Buenas Prácticas de Acceso (RBAC)
- Todas las rutas API nuevas deben protegerse utilizando el decorador `withAuth()` definiendo los roles permitidos.
- Todo desarrollo que afecte permisos debe ser probado contra vulnerabilidades IDOR (Insecure Direct Object Reference) asegurando que usuarios básicos solo puedan modificar o consultar sus propios recursos (`where: { userId: req.user.userId }`).

## 5. Revisión de Dependencias
- Se requiere mantener las dependencias actualizadas. 
- Regularmente se ejecutará `npm audit` para identificar y mitigar vulnerabilidades (`CVEs`) en paquetes de terceros.
- Antes de añadir un paquete nuevo, se evaluará su licencia, actividad comunitaria y reportes de seguridad.
