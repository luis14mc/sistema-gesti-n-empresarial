# Documento de Alcance del Proyecto

## 1. Objetivo
Delimitar claramente qué funcionalidades y procesos están incluidos (y cuáles están excluidos) en el desarrollo del Sistema de Gestión Empresarial.

## 2. Alcance: Entregables Incluidos (In-Scope)
- **Módulo de Autenticación:** Login, registro (restringido), RBAC, auditoría de accesos.
- **Módulo de Tickets:** Creación, asignación, cambio de estado y resolución.
- **Módulo de Oficios:** Registro de documentos formales y trazabilidad.
- **Módulo de Equipos e Inventario:** Alta de hardware, depreciación básica, y asignación de activos a empleados.
- **Módulo de Asistencia:** Registro de entrada y salida (Time Entries).
- **Módulo de Auditoría:** Bitácora inmutable de eventos críticos.

## 3. Exclusiones (Out-of-Scope)
- Integración con sistemas de nómina externos (SAP, Oracle).
- Módulo de facturación o contabilidad avanzada.
- Aplicaciones móviles nativas (iOS/Android).

## 4. Responsables
- **Levantamiento de Alcance:** Analista de Negocio / Product Owner.
- **Validación Técnica:** Arquitecto de Software.

## 5. Criterios de Aceptación
- El sistema debe cubrir al 100% los entregables "In-Scope" listados en la sección 2 para considerarse la Fase 1 completada.

## 6. Evidencias
- Diagramas de casos de uso (referenciados en la documentación de diseño).

## 7. Observaciones
Cualquier requerimiento que caiga en "Out-of-Scope" deberá someterse al proceso de "Solicitud de Cambio" documentado en la Fase 07.
