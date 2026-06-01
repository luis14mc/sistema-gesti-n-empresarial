# Requisitos Funcionales del Sistema

## 1. Objetivo
Listar las capacidades operativas y funcionales específicas que el software debe proveer a sus usuarios finales.

## 2. Alcance
Cubre todos los requerimientos de interacción del usuario (UI) y procesamiento de negocio de los 5 módulos principales.

## 3. Descripción de Requisitos (Matriz)

| ID | Módulo | Descripción Funcional | Criterios de Aceptación |
|---|---|---|---|
| **RF-01** | Usuarios | El sistema debe permitir inicio de sesión con correo y contraseña. | Manejo de errores visuales; retardo tras fallos; token válido. |
| **RF-02** | Roles (RBAC) | El sistema restringirá el acceso a los módulos según el rol (ADMIN, IT, RRHH, USER). | Redirección a Dashboard si no tiene permisos. |
| **RF-03** | Tickets | El usuario debe poder crear tickets de soporte especificando título, descripción y prioridad. | Validaciones en formulario (campos obligatorios). |
| **RF-04** | Tickets | Los usuarios básicos solo verán los tickets que crearon o que les fueron asignados. | Regla IDOR aplicada en base de datos. |
| **RF-05** | Equipos | IT y ADMIN podrán dar de alta equipos con número de serie y marca. | Número de serie debe ser único. |
| **RF-06** | Asistencias | El usuario registrará su asistencia (Check-in/Check-out). | No puede registrar dos "Check-in" seguidos sin "Check-out". |
| **RF-07** | Auditoría | Cualquier creación/edición generará un registro inmutable en el Audit Log. | Falla de auditoría interrumpe transacción principal. |

## 4. Responsables
- Aprobación: Cliente / Product Owner
- Ejecución: Equipo de Desarrollo

## 5. Observaciones
*(Lista sujeta a iteraciones controladas)*
