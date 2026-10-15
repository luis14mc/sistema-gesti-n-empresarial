# Inventario de modelos (N0 / fase 1)

Referencias: cliente `prisma|tx`, **nombre de tabla** en `src/` (incl. `$queryRaw` / `$executeRaw` / strings).

## Modelos Prisma (64)

| Modelo | Tabla | Módulo | Client | SQL/tablas | Estado |
|--------|-------|--------|-------:|-----------:|--------|
| AttendancePolicy | `attendance_policies` | people | 1 | 4 | ACTIVO |
| Audit | `audits` | audits | 3 | 104 | ACTIVO |
| AuditChecklistItem | `audit_checklist_items` | audits | 1 | 7 | ACTIVO |
| AuditFinding | `audit_findings` | audits | 2 | 7 | ACTIVO |
| AuditRecord | `audit_records` | audits | 3 | 21 | ACTIVO |
| CompraAdjunto | `compras_adjuntos` | legacy | 1 | 13 | LEGACY |
| CompraDocumento | `compras_documentos` | legacy | 2 | 17 | LEGACY |
| CompraOrden | `purchase_orders` | procurement | 8 | 56 | ACTIVO |
| CompraOrdenDocumento | `purchase_order_documents` | procurement | 1 | 9 | ACTIVO |
| CompraOrdenHistorial | `purchase_order_history` | procurement | 1 | 9 | ACTIVO |
| CompraOrdenItem | `purchase_order_items` | procurement | 1 | 12 | ACTIVO |
| CompraOrdenItemTax | `purchase_order_item_taxes` | procurement | 0 | 11 | ACTIVO |
| CompraOrdenSequence | `purchase_order_sequences` | procurement | 0 | 5 | ACTIVO |
| CompraOrdenTemplate | `purchase_order_templates` | procurement | 3 | 14 | ACTIVO |
| CompraSequence | `compras_sequences` | legacy | 1 | 6 | LEGACY |
| CompraSolicitud | `compras_solicitudes` | legacy | 2 | 43 | LEGACY |
| CompraSolicitudItem | `compras_solicitud_items` | legacy | 1 | 11 | LEGACY |
| CorrectiveAction | `corrective_actions` | audits | 3 | 9 | ACTIVO |
| CostCenter | `cost_centers` | procurement | 1 | 13 | ACTIVO |
| Department | `departments` | people | 5 | 40 | ACTIVO |
| DisposalDocument | `disposal_documents` | assets | 3 | 9 | ACTIVO |
| DisposalPolicy | `disposal_policies` | assets | 5 | 7 | ACTIVO |
| DocumentSequence | `document_sequences` | platform | 1 | 13 | ACTIVO |
| DomainEventOutbox | `domain_event_outbox` | platform | 0 | 13 | ACTIVO |
| Employee | `employees` | people | 14 | 149 | ACTIVO |
| Equipment | `equipment` | assets | 16 | 1065 | ACTIVO |
| EquipmentAssignment | `equipment_assignments` | assets | 8 | 36 | ACTIVO |
| EquipmentDisposal | `equipment_disposals` | assets | 6 | 17 | ACTIVO |
| EquipmentDisposalHistory | `equipment_disposal_history` | assets | 3 | 8 | ACTIVO |
| EquipmentHistory | `equipment_history` | assets | 3 | 15 | ACTIVO |
| EquipmentMaintenance | `equipment_maintenances` | assets | 3 | 18 | ACTIVO |
| IntegrationExecution | `integration_executions` | platform | 1 | 15 | ACTIVO |
| JobPosition | `job_positions` | people | 4 | 9 | ACTIVO |
| LicenseAssignment | `software_license_assignments` | assets | 1 | 8 | ACTIVO |
| Notification | `notifications` | platform | 1 | 91 | ACTIVO |
| NotificationDelivery | `notification_deliveries` | platform | 0 | 14 | ACTIVO |
| Oficio | `oficios` | oficios | 11 | 421 | ACTIVO |
| OficioDocument | `oficio_documents` | oficios | 3 | 9 | ACTIVO |
| OficioImportBatch | `oficio_import_batches` | oficios | 2 | 9 | ACTIVO |
| OficioImportBatchItem | `oficio_import_batch_items` | oficios | 1 | 8 | ACTIVO |
| OficioNumberingConfig | `oficio_numbering_configs` | oficios | 2 | 20 | ACTIVO |
| OficioSigner | `oficio_signers` | oficios | 3 | 13 | ACTIVO |
| OficioTracking | `oficio_tracking` | oficios | 3 | 9 | ACTIVO |
| Organization | `organizations` | platform | 17 | 171 | ACTIVO |
| OrganizationIntegration | `organization_integrations` | platform | 4 | 15 | ACTIVO |
| OrganizationMembership | `organization_memberships` | platform | 22 | 13 | ACTIVO |
| PayrollIsrBracket | `payroll_isr_brackets` | payroll | 1 | 9 | ACTIVO |
| PayrollSettings | `payroll_settings` | payroll | 1 | 15 | ACTIVO |
| Payslip | `payslips` | payroll | 2 | 40 | ACTIVO |
| PromotionalItem | `promotional_items` | legacy | 1 | 6 | LEGACY |
| PromotionalMovement | `promotional_movements` | legacy | 1 | 6 | LEGACY |
| Proveedor | `proveedores` | procurement | 7 | 75 | ACTIVO |
| ReplacementProjection | `replacement_projections` | assets | 1 | 11 | ACTIVO |
| ReportExecution | `report_executions` | platform | 1 | 11 | ACTIVO |
| RolePermission | `role_permissions` | platform | 5 | 7 | ACTIVO |
| RoleSetting | `role_settings` | platform | 3 | 8 | ACTIVO |
| SoftwareLicenseSeat | `software_license_seats` | assets | 1 | 8 | ACTIVO |
| SoftwareProduct | `software_products` | assets | 1 | 8 | ACTIVO |
| SoftwareSubscription | `software_subscriptions` | assets | 1 | 22 | ACTIVO |
| SystemAuditEvent | `system_audit_events` | platform | 4 | 20 | ACTIVO |
| Ticket | `tickets` | legacy | 1 | 44 | LEGACY |
| TimeEntry | `time_entries` | legacy | 1 | 8 | LEGACY |
| User | `users` | people | 21 | 217 | ACTIVO |
| UserPermissionOverride | `user_permission_overrides` | platform | 4 | 14 | ACTIVO |

## Tablas archivadas (sin modelo Prisma)

(archivado N2 — ver docs/database/archive.md)

| Tabla | Schema |
|-------|--------|
| `compras_ordenes_legacy` | archive |
| `compras_orden_items` | archive |
| `compras_orden_documentos` | archive |
| `compras_orden_historial` | archive |
| `compras_orden_sequences` | archive |

## Enums duplicados (N5b — no unificar en fase 1)

- CompraEstado / CompraOrdenEstado / PurchaseOrderStatus

## Dinero en Float (activos)

- Tras N3: `equipment.cost`, `equipment_maintenances.cost` → Decimal. Legado solicitudes/promotional sigue Float hasta N2b/archivo.
