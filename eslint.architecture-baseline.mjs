// Lista de excepciones CONGELADA de la regla "sin Prisma en presentación" (ADR 003).
// Solo puede REDUCIRSE: al migrar un archivo a su módulo, quítalo de aquí.
// tests/architecture/architecture-rules.test.ts falla si se agrega una entrada
// nueva o si una entrada apunta a un archivo que ya no existe.
// Generada el 2026-10-21; reducida en fase 1 equipos (56 archivos).
export const PRISMA_IN_PRESENTATION_BASELINE = [
  'src/app/api/audits/[id]/checklist/route.ts',
  'src/app/api/audits/[id]/findings/route.ts',
  'src/app/api/audits/[id]/route.ts',
  'src/app/api/audits/route.ts',
  'src/app/api/corrective-actions/[id]/route.ts',
  'src/app/api/corrective-actions/route.ts',
  'src/app/api/equipment-disposal/[id]/documents/[documentId]/route.ts',
  'src/app/api/equipment-disposal/[id]/documents/[documentId]/view/route.ts',
  'src/app/api/equipment-disposal/[id]/documents/route.ts',
  'src/app/api/equipment-disposal/[id]/pdf/route.ts',
  'src/app/api/organizations/current/integrations/[id]/executions/route.ts',
  'src/app/api/organizations/current/integrations/[id]/route.ts',
  'src/app/api/organizations/current/integrations/route.ts',
  'src/app/api/organizations/current/route.ts',
  'src/app/api/planilla/configuracion/smtp/probar/route.ts',
  'src/app/api/reports/[code]/export/route.ts',
  'src/app/dashboard/page.tsx',
];

// Excepciones congeladas: application sin Next.js ni Prisma directo (ADR 003 fase 2c).
// src/modules/users/application debe quedar limpio (sin entrada aquí).
/** Archivos legacy que aún importan @/lib/prisma fuera de infrastructure (solo puede reducirse). */
export const PRISMA_OUTSIDE_INFRASTRUCTURE_BASELINE = [
  'src/modules/equipment/import-export/equipment-create.ts',
  'src/modules/equipment/import-export/equipment-export.ts',
  'src/modules/equipment/import-export/equipment-import.ts',
  'src/modules/equipment-disposal/application/service.ts',
  'src/modules/notifications/application/dispatcher.ts',
  'src/modules/notifications/application/queries.ts',
  'src/modules/notifications/application/recipient-resolver.ts',
  'src/modules/oficios/import-export/oficios-import.ts',
  'src/modules/organizations/application/context.ts',
  'src/modules/organizations/application/lifecycle.ts',
  'src/modules/organizations/application/platform-context.ts',
  'src/modules/organizations/application/queries.ts',
  'src/modules/payroll/application/payroll-service.ts',
  'src/modules/payroll/application/payroll-smtp-settings-service.ts',
  'src/modules/payroll/application/payslip-email-service.ts',
  'src/modules/payroll/application/settings-loader.ts',
];

export const APPLICATION_LAYER_BASELINE = [
  'src/modules/equipment-disposal/application/service.ts',
  'src/modules/notifications/application/dispatcher.ts',
  'src/modules/notifications/application/queries.ts',
  'src/modules/notifications/application/recipient-resolver.ts',
  'src/modules/organizations/application/context.ts',
  'src/modules/organizations/application/lifecycle.ts',
  'src/modules/organizations/application/platform-context.ts',
  'src/modules/organizations/application/queries.ts',
  'src/modules/payroll/application/payroll-service.ts',
  'src/modules/payroll/application/payroll-smtp-settings-service.ts',
  'src/modules/payroll/application/payslip-email-service.ts',
  'src/modules/payroll/application/settings-loader.ts',
];
