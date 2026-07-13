import { redirect } from 'next/navigation';

// ============================================
// /audit-records → /audit/logs (redirección legacy)
// Sprint 2: unificación de vistas de auditoría
// ============================================
export default function AuditRecordsLegacyRedirect() {
  redirect('/audit/logs');
}
