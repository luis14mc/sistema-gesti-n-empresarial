# Requisitos No Funcionales (Atributos de Calidad)

## 1. Objetivo
Definir los atributos de calidad del sistema basados en la norma **ISO/IEC 25010** (Rendimiento, Seguridad, Usabilidad, Mantenibilidad).

## 2. Descripción de Requisitos No Funcionales

| ID | Categoría (ISO 25010) | Descripción | Métrica / Criterios de Aceptación |
|---|---|---|---|
| **RNF-01** | Rendimiento | Los listados (Tickets, Equipos) no deben exceder un límite seguro de registros consultados. | Máximo 100 registros por consulta de API (pageSize = 100). |
| **RNF-02** | Seguridad | Toda información en tránsito debe estar cifrada. | Uso obligatorio de TLS/HTTPS en producción (HSTS habilitado). |
| **RNF-03** | Seguridad | Protección contra ataques tipo inyección. | Uso obligatorio de `Prisma.*WhereInput` y prohibición de tipos `any`. |
| **RNF-04** | Disponibilidad | La base de datos debe ser resiliente a fallos. | Neon.tech Serverless Postgres con SLA 99.9% y PITR 7 días. |
| **RNF-05** | Usabilidad | La interfaz de usuario debe ser responsiva y adaptarse a resoluciones móviles y escritorio. | Framework Tailwind CSS implementando *mobile-first*. |
| **RNF-06** | Mantenibilidad | El código debe estar cubierto por pruebas automatizadas en las lógicas críticas. | Ejecución de `Vitest` obligatoria en el pipeline de CI/CD. |

## 3. Responsables
- Arquitecto de Software
- Ingeniero DevOps / SRE

## 4. Evidencias
- Configuración de `next.config.js` (Security Headers).
- Resultados de `npm run test` automatizados en GitHub Actions.

## 5. Observaciones
Ningún requerimiento funcional puede comprometer los requerimientos no funcionales de Seguridad (RNF-02, RNF-03).
