# Casos de Prueba (Test Cases)

## 1. Módulo: Autenticación
| ID | Descripción | Entrada | Salida Esperada | Estado |
|---|---|---|---|---|
| **TC-01** | Inicio de sesión válido | Email y contraseña correctos. | Cookie JWT firmada y redirección a Dashboard. | Pasa |
| **TC-02** | Contraseña incorrecta | Email válido, clave incorrecta. | Mensaje de error, retardo artificial aplicado. | Pasa |
| **TC-03** | Falsificación de Token | Alteración manual del base64 en la cookie. | Rechazo en middleware, redirección a Login. | Pasa |

## 2. Módulo: Control de Roles (RBAC)
| ID | Descripción | Entrada | Salida Esperada | Estado |
|---|---|---|---|---|
| **TC-04** | Acceso a registro no autorizado | GET a `/api/auth/register` por rol USER. | Error 401 Unauthorized. | Pasa |
| **TC-05** | IDOR en tickets | Usuario normal solicita tickets ajenos mediante API. | Retorna únicamente tickets propios. | Pasa |
