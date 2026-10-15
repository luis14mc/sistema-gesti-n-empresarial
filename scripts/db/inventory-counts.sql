-- Row counts (read-only). Missing public tables → NULL row_count.

SELECT 'attendance_policies' AS table_name, CASE WHEN to_regclass('public.attendance_policies') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."attendance_policies") ELSE NULL END AS row_count
UNION ALL
SELECT 'audit_checklist_items' AS table_name, CASE WHEN to_regclass('public.audit_checklist_items') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."audit_checklist_items") ELSE NULL END AS row_count
UNION ALL
SELECT 'audit_findings' AS table_name, CASE WHEN to_regclass('public.audit_findings') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."audit_findings") ELSE NULL END AS row_count
UNION ALL
SELECT 'audit_records' AS table_name, CASE WHEN to_regclass('public.audit_records') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."audit_records") ELSE NULL END AS row_count
UNION ALL
SELECT 'audits' AS table_name, CASE WHEN to_regclass('public.audits') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."audits") ELSE NULL END AS row_count
UNION ALL
SELECT 'compras_adjuntos' AS table_name, CASE WHEN to_regclass('public.compras_adjuntos') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."compras_adjuntos") ELSE NULL END AS row_count
UNION ALL
SELECT 'compras_documentos' AS table_name, CASE WHEN to_regclass('public.compras_documentos') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."compras_documentos") ELSE NULL END AS row_count
UNION ALL
SELECT 'compras_sequences' AS table_name, CASE WHEN to_regclass('public.compras_sequences') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."compras_sequences") ELSE NULL END AS row_count
UNION ALL
SELECT 'compras_solicitud_items' AS table_name, CASE WHEN to_regclass('public.compras_solicitud_items') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."compras_solicitud_items") ELSE NULL END AS row_count
UNION ALL
SELECT 'compras_solicitudes' AS table_name, CASE WHEN to_regclass('public.compras_solicitudes') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."compras_solicitudes") ELSE NULL END AS row_count
UNION ALL
SELECT 'corrective_actions' AS table_name, CASE WHEN to_regclass('public.corrective_actions') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."corrective_actions") ELSE NULL END AS row_count
UNION ALL
SELECT 'cost_centers' AS table_name, CASE WHEN to_regclass('public.cost_centers') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."cost_centers") ELSE NULL END AS row_count
UNION ALL
SELECT 'departments' AS table_name, CASE WHEN to_regclass('public.departments') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."departments") ELSE NULL END AS row_count
UNION ALL
SELECT 'disposal_documents' AS table_name, CASE WHEN to_regclass('public.disposal_documents') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."disposal_documents") ELSE NULL END AS row_count
UNION ALL
SELECT 'disposal_policies' AS table_name, CASE WHEN to_regclass('public.disposal_policies') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."disposal_policies") ELSE NULL END AS row_count
UNION ALL
SELECT 'document_sequences' AS table_name, CASE WHEN to_regclass('public.document_sequences') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."document_sequences") ELSE NULL END AS row_count
UNION ALL
SELECT 'domain_event_outbox' AS table_name, CASE WHEN to_regclass('public.domain_event_outbox') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."domain_event_outbox") ELSE NULL END AS row_count
UNION ALL
SELECT 'employees' AS table_name, CASE WHEN to_regclass('public.employees') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."employees") ELSE NULL END AS row_count
UNION ALL
SELECT 'equipment' AS table_name, CASE WHEN to_regclass('public.equipment') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."equipment") ELSE NULL END AS row_count
UNION ALL
SELECT 'equipment_assignments' AS table_name, CASE WHEN to_regclass('public.equipment_assignments') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."equipment_assignments") ELSE NULL END AS row_count
UNION ALL
SELECT 'equipment_disposal_history' AS table_name, CASE WHEN to_regclass('public.equipment_disposal_history') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."equipment_disposal_history") ELSE NULL END AS row_count
UNION ALL
SELECT 'equipment_disposals' AS table_name, CASE WHEN to_regclass('public.equipment_disposals') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."equipment_disposals") ELSE NULL END AS row_count
UNION ALL
SELECT 'equipment_history' AS table_name, CASE WHEN to_regclass('public.equipment_history') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."equipment_history") ELSE NULL END AS row_count
UNION ALL
SELECT 'equipment_maintenances' AS table_name, CASE WHEN to_regclass('public.equipment_maintenances') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."equipment_maintenances") ELSE NULL END AS row_count
UNION ALL
SELECT 'integration_executions' AS table_name, CASE WHEN to_regclass('public.integration_executions') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."integration_executions") ELSE NULL END AS row_count
UNION ALL
SELECT 'job_positions' AS table_name, CASE WHEN to_regclass('public.job_positions') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."job_positions") ELSE NULL END AS row_count
UNION ALL
SELECT 'notification_deliveries' AS table_name, CASE WHEN to_regclass('public.notification_deliveries') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."notification_deliveries") ELSE NULL END AS row_count
UNION ALL
SELECT 'notifications' AS table_name, CASE WHEN to_regclass('public.notifications') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."notifications") ELSE NULL END AS row_count
UNION ALL
SELECT 'oficio_documents' AS table_name, CASE WHEN to_regclass('public.oficio_documents') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."oficio_documents") ELSE NULL END AS row_count
UNION ALL
SELECT 'oficio_import_batch_items' AS table_name, CASE WHEN to_regclass('public.oficio_import_batch_items') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."oficio_import_batch_items") ELSE NULL END AS row_count
UNION ALL
SELECT 'oficio_import_batches' AS table_name, CASE WHEN to_regclass('public.oficio_import_batches') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."oficio_import_batches") ELSE NULL END AS row_count
UNION ALL
SELECT 'oficio_numbering_configs' AS table_name, CASE WHEN to_regclass('public.oficio_numbering_configs') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."oficio_numbering_configs") ELSE NULL END AS row_count
UNION ALL
SELECT 'oficio_signers' AS table_name, CASE WHEN to_regclass('public.oficio_signers') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."oficio_signers") ELSE NULL END AS row_count
UNION ALL
SELECT 'oficio_tracking' AS table_name, CASE WHEN to_regclass('public.oficio_tracking') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."oficio_tracking") ELSE NULL END AS row_count
UNION ALL
SELECT 'oficios' AS table_name, CASE WHEN to_regclass('public.oficios') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."oficios") ELSE NULL END AS row_count
UNION ALL
SELECT 'organization_integrations' AS table_name, CASE WHEN to_regclass('public.organization_integrations') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."organization_integrations") ELSE NULL END AS row_count
UNION ALL
SELECT 'organization_memberships' AS table_name, CASE WHEN to_regclass('public.organization_memberships') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."organization_memberships") ELSE NULL END AS row_count
UNION ALL
SELECT 'organizations' AS table_name, CASE WHEN to_regclass('public.organizations') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."organizations") ELSE NULL END AS row_count
UNION ALL
SELECT 'payroll_isr_brackets' AS table_name, CASE WHEN to_regclass('public.payroll_isr_brackets') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."payroll_isr_brackets") ELSE NULL END AS row_count
UNION ALL
SELECT 'payroll_settings' AS table_name, CASE WHEN to_regclass('public.payroll_settings') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."payroll_settings") ELSE NULL END AS row_count
UNION ALL
SELECT 'payslips' AS table_name, CASE WHEN to_regclass('public.payslips') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."payslips") ELSE NULL END AS row_count
UNION ALL
SELECT 'promotional_items' AS table_name, CASE WHEN to_regclass('public.promotional_items') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."promotional_items") ELSE NULL END AS row_count
UNION ALL
SELECT 'promotional_movements' AS table_name, CASE WHEN to_regclass('public.promotional_movements') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."promotional_movements") ELSE NULL END AS row_count
UNION ALL
SELECT 'proveedores' AS table_name, CASE WHEN to_regclass('public.proveedores') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."proveedores") ELSE NULL END AS row_count
UNION ALL
SELECT 'purchase_order_documents' AS table_name, CASE WHEN to_regclass('public.purchase_order_documents') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."purchase_order_documents") ELSE NULL END AS row_count
UNION ALL
SELECT 'purchase_order_history' AS table_name, CASE WHEN to_regclass('public.purchase_order_history') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."purchase_order_history") ELSE NULL END AS row_count
UNION ALL
SELECT 'purchase_order_item_taxes' AS table_name, CASE WHEN to_regclass('public.purchase_order_item_taxes') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."purchase_order_item_taxes") ELSE NULL END AS row_count
UNION ALL
SELECT 'purchase_order_items' AS table_name, CASE WHEN to_regclass('public.purchase_order_items') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."purchase_order_items") ELSE NULL END AS row_count
UNION ALL
SELECT 'purchase_order_sequences' AS table_name, CASE WHEN to_regclass('public.purchase_order_sequences') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."purchase_order_sequences") ELSE NULL END AS row_count
UNION ALL
SELECT 'purchase_order_templates' AS table_name, CASE WHEN to_regclass('public.purchase_order_templates') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."purchase_order_templates") ELSE NULL END AS row_count
UNION ALL
SELECT 'purchase_orders' AS table_name, CASE WHEN to_regclass('public.purchase_orders') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."purchase_orders") ELSE NULL END AS row_count
UNION ALL
SELECT 'replacement_projections' AS table_name, CASE WHEN to_regclass('public.replacement_projections') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."replacement_projections") ELSE NULL END AS row_count
UNION ALL
SELECT 'report_executions' AS table_name, CASE WHEN to_regclass('public.report_executions') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."report_executions") ELSE NULL END AS row_count
UNION ALL
SELECT 'role_permissions' AS table_name, CASE WHEN to_regclass('public.role_permissions') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."role_permissions") ELSE NULL END AS row_count
UNION ALL
SELECT 'role_settings' AS table_name, CASE WHEN to_regclass('public.role_settings') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."role_settings") ELSE NULL END AS row_count
UNION ALL
SELECT 'software_license_assignments' AS table_name, CASE WHEN to_regclass('public.software_license_assignments') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."software_license_assignments") ELSE NULL END AS row_count
UNION ALL
SELECT 'software_license_seats' AS table_name, CASE WHEN to_regclass('public.software_license_seats') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."software_license_seats") ELSE NULL END AS row_count
UNION ALL
SELECT 'software_products' AS table_name, CASE WHEN to_regclass('public.software_products') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."software_products") ELSE NULL END AS row_count
UNION ALL
SELECT 'software_subscriptions' AS table_name, CASE WHEN to_regclass('public.software_subscriptions') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."software_subscriptions") ELSE NULL END AS row_count
UNION ALL
SELECT 'system_audit_events' AS table_name, CASE WHEN to_regclass('public.system_audit_events') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."system_audit_events") ELSE NULL END AS row_count
UNION ALL
SELECT 'tickets' AS table_name, CASE WHEN to_regclass('public.tickets') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."tickets") ELSE NULL END AS row_count
UNION ALL
SELECT 'time_entries' AS table_name, CASE WHEN to_regclass('public.time_entries') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."time_entries") ELSE NULL END AS row_count
UNION ALL
SELECT 'user_permission_overrides' AS table_name, CASE WHEN to_regclass('public.user_permission_overrides') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."user_permission_overrides") ELSE NULL END AS row_count
UNION ALL
SELECT 'users' AS table_name, CASE WHEN to_regclass('public.users') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM public."users") ELSE NULL END AS row_count
UNION ALL
SELECT 'compras_orden_documentos' AS table_name, CASE WHEN to_regclass('archive.compras_orden_documentos') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM archive."compras_orden_documentos") ELSE NULL END AS row_count
UNION ALL
SELECT 'compras_orden_historial' AS table_name, CASE WHEN to_regclass('archive.compras_orden_historial') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM archive."compras_orden_historial") ELSE NULL END AS row_count
UNION ALL
SELECT 'compras_orden_items' AS table_name, CASE WHEN to_regclass('archive.compras_orden_items') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM archive."compras_orden_items") ELSE NULL END AS row_count
UNION ALL
SELECT 'compras_orden_sequences' AS table_name, CASE WHEN to_regclass('archive.compras_orden_sequences') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM archive."compras_orden_sequences") ELSE NULL END AS row_count
UNION ALL
SELECT 'compras_ordenes_legacy' AS table_name, CASE WHEN to_regclass('archive.compras_ordenes_legacy') IS NOT NULL THEN (SELECT COUNT(*)::bigint FROM archive."compras_ordenes_legacy") ELSE NULL END AS row_count;
