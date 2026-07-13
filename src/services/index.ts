// Barrel export de todos los servicios de API
// Cada servicio encapsula las llamadas HTTP de un módulo específico
//
// NOTA: Los módulos 'tickets', 'inventory' (promotional-items) y 'time-entries'
// fueron deprecados en frontend (Plan 1 mes - Sprint 1).
// Sus endpoints API se mantienen pero no se exponen en la UI.

export * from './auth.service';
export * from './users.service';
export * from './oficios.service';
export * from './equipment.service';
export * from './equipment-assignments.service';
export * from './audits.service';
export * from './corrective-actions.service';
export * from './purchases.service';
export * from './employees.service';
export * from './uploads.service';
