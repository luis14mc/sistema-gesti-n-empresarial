import { redirect } from 'next/navigation';

// ============================================
// /admin/audit-logs → /audit/logs (redirección legacy)
// Sprint 2: unificación de vistas de auditoría
// ============================================
export default function AdminAuditLogsLegacyRedirect() {
  redirect('/audit/logs');
}
