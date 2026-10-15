-- Row counts per table (read-only). Run in production:
--   railway run psql "$DATABASE_URL" -f scripts/db/inventory-counts.sql
-- Not executed in CI.

SELECT 'attendance_policies' AS table_name, COUNT(*)::bigint AS row_count FROM "attendance_policies"
UNION ALL
SELECT 'audit_checklist_items' AS table_name, COUNT(*)::bigint AS row_count FROM "audit_checklist_items"
UNION ALL
SELECT 'audit_findings' AS table_name, COUNT(*)::bigint AS row_count FROM "audit_findings"
UNION ALL
SELECT 'audit_records' AS table_name, COUNT(*)::bigint AS row_count FROM "audit_records"
UNION ALL
SELECT 'audits' AS table_name, COUNT(*)::bigint AS row_count FROM "audits"
UNION ALL
SELECT 'compras_adjuntos' AS table_name, COUNT(*)::bigint AS row_count FROM "compras_adjuntos"
UNION ALL
SELECT 'compras_documentos' AS table_name, COUNT(*)::bigint AS row_count FROM "compras_documentos"
UNION ALL
SELECT 'compras_orden_documentos' AS table_name, COUNT(*)::bigint AS row_count FROM "compras_orden_documentos"
UNION ALL
SELECT 'compras_orden_historial' AS table_name, COUNT(*)::bigint AS row_count FROM "compras_orden_historial"
UNION ALL
SELECT 'compras_orden_items' AS table_name, COUNT(*)::bigint AS row_count FROM "compras_orden_items"
UNION ALL
SELECT 'compras_orden_sequences' AS table_name, COUNT(*)::bigint AS row_count FROM "compras_orden_sequences"
UNION ALL
SELECT 'compras_ordenes_legacy' AS table_name, COUNT(*)::bigint AS row_count FROM "compras_ordenes_legacy"
UNION ALL
SELECT 'compras_sequences' AS table_name, COUNT(*)::bigint AS row_count FROM "compras_sequences"
UNION ALL
SELECT 'compras_solicitud_items' AS table_name, COUNT(*)::bigint AS row_count FROM "compras_solicitud_items"
UNION ALL
SELECT 'compras_solicitudes' AS table_name, COUNT(*)::bigint AS row_count FROM "compras_solicitudes"
UNION ALL
SELECT 'corrective_actions' AS table_name, COUNT(*)::bigint AS row_count FROM "corrective_actions"
UNION ALL
SELECT 'cost_centers' AS table_name, COUNT(*)::bigint AS row_count FROM "cost_centers"
UNION ALL
SELECT 'departments' AS table_name, COUNT(*)::bigint AS row_count FROM "departments"
UNION ALL
SELECT 'disposal_documents' AS table_name, COUNT(*)::bigint AS row_count FROM "disposal_documents"
UNION ALL
SELECT 'disposal_policies' AS table_name, COUNT(*)::bigint AS row_count FROM "disposal_policies"
UNION ALL
SELECT 'document_sequences' AS table_name, COUNT(*)::bigint AS row_count FROM "document_sequences"
UNION ALL
SELECT 'domain_event_outbox' AS table_name, COUNT(*)::bigint AS row_count FROM "domain_event_outbox"
UNION ALL
SELECT 'employees' AS table_name, COUNT(*)::bigint AS row_count FROM "employees"
UNION ALL
SELECT 'equipment' AS table_name, COUNT(*)::bigint AS row_count FROM "equipment"
UNION ALL
SELECT 'equipment_assignments' AS table_name, COUNT(*)::bigint AS row_count FROM "equipment_assignments"
UNION ALL
SELECT 'equipment_disposal_history' AS table_name, COUNT(*)::bigint AS row_count FROM "equipment_disposal_history"
UNION ALL
SELECT 'equipment_disposals' AS table_name, COUNT(*)::bigint AS row_count FROM "equipment_disposals"
UNION ALL
SELECT 'equipment_history' AS table_name, COUNT(*)::bigint AS row_count FROM "equipment_history"
UNION ALL
SELECT 'equipment_maintenances' AS table_name, COUNT(*)::bigint AS row_count FROM "equipment_maintenances"
UNION ALL
SELECT 'integration_executions' AS table_name, COUNT(*)::bigint AS row_count FROM "integration_executions"
UNION ALL
SELECT 'job_positions' AS table_name, COUNT(*)::bigint AS row_count FROM "job_positions"
UNION ALL
SELECT 'notification_deliveries' AS table_name, COUNT(*)::bigint AS row_count FROM "notification_deliveries"
UNION ALL
SELECT 'notifications' AS table_name, COUNT(*)::bigint AS row_count FROM "notifications"
UNION ALL
SELECT 'oficio_documents' AS table_name, COUNT(*)::bigint AS row_count FROM "oficio_documents"
UNION ALL
SELECT 'oficio_import_batch_items' AS table_name, COUNT(*)::bigint AS row_count FROM "oficio_import_batch_items"
UNION ALL
SELECT 'oficio_import_batches' AS table_name, COUNT(*)::bigint AS row_count FROM "oficio_import_batches"
UNION ALL
SELECT 'oficio_numbering_configs' AS table_name, COUNT(*)::bigint AS row_count FROM "oficio_numbering_configs"
UNION ALL
SELECT 'oficio_signers' AS table_name, COUNT(*)::bigint AS row_count FROM "oficio_signers"
UNION ALL
SELECT 'oficio_tracking' AS table_name, COUNT(*)::bigint AS row_count FROM "oficio_tracking"
UNION ALL
SELECT 'oficios' AS table_name, COUNT(*)::bigint AS row_count FROM "oficios"
UNION ALL
SELECT 'organization_integrations' AS table_name, COUNT(*)::bigint AS row_count FROM "organization_integrations"
UNION ALL
SELECT 'organization_memberships' AS table_name, COUNT(*)::bigint AS row_count FROM "organization_memberships"
UNION ALL
SELECT 'organizations' AS table_name, COUNT(*)::bigint AS row_count FROM "organizations"
UNION ALL
SELECT 'payroll_isr_brackets' AS table_name, COUNT(*)::bigint AS row_count FROM "payroll_isr_brackets"
UNION ALL
SELECT 'payroll_settings' AS table_name, COUNT(*)::bigint AS row_count FROM "payroll_settings"
UNION ALL
SELECT 'payslips' AS table_name, COUNT(*)::bigint AS row_count FROM "payslips"
UNION ALL
SELECT 'promotional_items' AS table_name, COUNT(*)::bigint AS row_count FROM "promotional_items"
UNION ALL
SELECT 'promotional_movements' AS table_name, COUNT(*)::bigint AS row_count FROM "promotional_movements"
UNION ALL
SELECT 'proveedores' AS table_name, COUNT(*)::bigint AS row_count FROM "proveedores"
UNION ALL
SELECT 'purchase_order_documents' AS table_name, COUNT(*)::bigint AS row_count FROM "purchase_order_documents"
UNION ALL
SELECT 'purchase_order_history' AS table_name, COUNT(*)::bigint AS row_count FROM "purchase_order_history"
UNION ALL
SELECT 'purchase_order_item_taxes' AS table_name, COUNT(*)::bigint AS row_count FROM "purchase_order_item_taxes"
UNION ALL
SELECT 'purchase_order_items' AS table_name, COUNT(*)::bigint AS row_count FROM "purchase_order_items"
UNION ALL
SELECT 'purchase_order_sequences' AS table_name, COUNT(*)::bigint AS row_count FROM "purchase_order_sequences"
UNION ALL
SELECT 'purchase_order_templates' AS table_name, COUNT(*)::bigint AS row_count FROM "purchase_order_templates"
UNION ALL
SELECT 'purchase_orders' AS table_name, COUNT(*)::bigint AS row_count FROM "purchase_orders"
UNION ALL
SELECT 'replacement_projections' AS table_name, COUNT(*)::bigint AS row_count FROM "replacement_projections"
UNION ALL
SELECT 'report_executions' AS table_name, COUNT(*)::bigint AS row_count FROM "report_executions"
UNION ALL
SELECT 'role_permissions' AS table_name, COUNT(*)::bigint AS row_count FROM "role_permissions"
UNION ALL
SELECT 'role_settings' AS table_name, COUNT(*)::bigint AS row_count FROM "role_settings"
UNION ALL
SELECT 'software_license_assignments' AS table_name, COUNT(*)::bigint AS row_count FROM "software_license_assignments"
UNION ALL
SELECT 'software_license_seats' AS table_name, COUNT(*)::bigint AS row_count FROM "software_license_seats"
UNION ALL
SELECT 'software_products' AS table_name, COUNT(*)::bigint AS row_count FROM "software_products"
UNION ALL
SELECT 'software_subscriptions' AS table_name, COUNT(*)::bigint AS row_count FROM "software_subscriptions"
UNION ALL
SELECT 'system_audit_events' AS table_name, COUNT(*)::bigint AS row_count FROM "system_audit_events"
UNION ALL
SELECT 'tickets' AS table_name, COUNT(*)::bigint AS row_count FROM "tickets"
UNION ALL
SELECT 'time_entries' AS table_name, COUNT(*)::bigint AS row_count FROM "time_entries"
UNION ALL
SELECT 'user_permission_overrides' AS table_name, COUNT(*)::bigint AS row_count FROM "user_permission_overrides"
UNION ALL
SELECT 'users' AS table_name, COUNT(*)::bigint AS row_count FROM "users";
