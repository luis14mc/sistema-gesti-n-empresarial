# Inventario de modelos (N0)

Generado como parte de la normalización de BD. **No implica cambios de schema.**

## Resumen

| Métrica | Valor |
|---------|------:|
| Modelos | 69 |
| Enums | 68 |
| LEGACY / SIN USO (ver tabla) | 14 |

## Convenciones de estado

- **ACTIVO**: referenciado en `src/` y parte del producto actual.
- **LEGACY**: tablas paralelas o reemplazadas; mantener solo por datos históricos.
- **SIN USO**: sin referencias directas en `src/` (`prisma.*` / `tx.*`); puede existir uso indirecto vía relaciones o scripts.

## Modelos

| Modelo | Tabla (`@@map`) | Módulo | Refs `prisma|tx` (archivos) | Menciones `src` | Estado |
|--------|-----------------|--------|---------------------------:|------------------:|--------|
| AttendancePolicy | `attendance_policies` | people | 1 | 0 | ACTIVO |
| Audit | `audits` | audits | 3 | 294 | ACTIVO |
| AuditChecklistItem | `audit_checklist_items` | audits | 1 | 5 | ACTIVO |
| AuditFinding | `audit_findings` | audits | 2 | 4 | ACTIVO |
| AuditRecord | `audit_records` | audits | 3 | 118 | ACTIVO |
| CompraAdjunto | `compras_adjuntos` | legacy | 1 | 8 | LEGACY |
| CompraDocumento | `compras_documentos` | legacy | 2 | 2 | LEGACY |
| CompraOrden | `purchase_orders` | procurement | 8 | 185 | ACTIVO |
| CompraOrdenDocumento | `purchase_order_documents` | procurement | 1 | 9 | ACTIVO |
| CompraOrdenDocumentoLegacy | `compras_orden_documentos` | legacy | 0 | 0 | LEGACY |
| CompraOrdenHistorial | `purchase_order_history` | procurement | 1 | 9 | ACTIVO |
| CompraOrdenHistorialLegacy | `compras_orden_historial` | legacy | 0 | 0 | LEGACY |
| CompraOrdenItem | `purchase_order_items` | procurement | 1 | 6 | ACTIVO |
| CompraOrdenItemLegacy | `compras_orden_items` | legacy | 0 | 0 | LEGACY |
| CompraOrdenItemTax | `purchase_order_item_taxes` | procurement | 0 | 2 | SIN USO |
| CompraOrdenLegacy | `compras_ordenes_legacy` | legacy | 0 | 0 | LEGACY |
| CompraOrdenSequence | `purchase_order_sequences` | procurement | 0 | 0 | SIN USO |
| CompraOrdenSequenceLegacy | `compras_orden_sequences` | legacy | 0 | 0 | LEGACY |
| CompraOrdenTemplate | `purchase_order_templates` | procurement | 3 | 3 | ACTIVO |
| CompraSequence | `compras_sequences` | legacy | 1 | 0 | LEGACY |
| CompraSolicitud | `compras_solicitudes` | legacy | 2 | 60 | LEGACY |
| CompraSolicitudItem | `compras_solicitud_items` | legacy | 1 | 8 | LEGACY |
| CorrectiveAction | `corrective_actions` | audits | 3 | 12 | ACTIVO |
| CostCenter | `cost_centers` | procurement | 1 | 0 | ACTIVO |
| Department | `departments` | people | 5 | 21 | ACTIVO |
| DisposalDocument | `disposal_documents` | assets | 3 | 13 | ACTIVO |
| DisposalPolicy | `disposal_policies` | assets | 5 | 25 | ACTIVO |
| DocumentSequence | `document_sequences` | platform | 1 | 10 | ACTIVO |
| DomainEventOutbox | `domain_event_outbox` | platform | 0 | 0 | SIN USO |
| Employee | `employees` | people | 14 | 183 | ACTIVO |
| Equipment | `equipment` | assets | 16 | 419 | ACTIVO |
| EquipmentAssignment | `equipment_assignments` | assets | 8 | 29 | ACTIVO |
| EquipmentDisposal | `equipment_disposals` | assets | 6 | 64 | ACTIVO |
| EquipmentDisposalHistory | `equipment_disposal_history` | assets | 3 | 0 | ACTIVO |
| EquipmentHistory | `equipment_history` | assets | 3 | 21 | ACTIVO |
| EquipmentMaintenance | `equipment_maintenances` | assets | 3 | 6 | ACTIVO |
| IntegrationExecution | `integration_executions` | platform | 1 | 7 | ACTIVO |
| JobPosition | `job_positions` | people | 4 | 2 | ACTIVO |
| LicenseAssignment | `software_license_assignments` | assets | 1 | 4 | ACTIVO |
| Notification | `notifications` | platform | 1 | 149 | ACTIVO |
| NotificationDelivery | `notification_deliveries` | platform | 0 | 3 | ACTIVO |
| Oficio | `oficios` | oficios | 11 | 495 | ACTIVO |
| OficioDocument | `oficio_documents` | oficios | 3 | 35 | ACTIVO |
| OficioImportBatch | `oficio_import_batches` | oficios | 2 | 13 | ACTIVO |
| OficioImportBatchItem | `oficio_import_batch_items` | oficios | 1 | 4 | ACTIVO |
| OficioNumberingConfig | `oficio_numbering_configs` | oficios | 2 | 10 | ACTIVO |
| OficioSigner | `oficio_signers` | oficios | 3 | 9 | ACTIVO |
| OficioTracking | `oficio_tracking` | oficios | 3 | 5 | ACTIVO |
| Organization | `organizations` | platform | 17 | 733 | ACTIVO |
| OrganizationIntegration | `organization_integrations` | platform | 4 | 12 | ACTIVO |
| OrganizationMembership | `organization_memberships` | platform | 22 | 6 | ACTIVO |
| PayrollIsrBracket | `payroll_isr_brackets` | payroll | 1 | 6 | ACTIVO |
| PayrollSettings | `payroll_settings` | payroll | 1 | 29 | ACTIVO |
| Payslip | `payslips` | payroll | 2 | 94 | ACTIVO |
| PromotionalItem | `promotional_items` | legacy | 1 | 7 | LEGACY |
| PromotionalMovement | `promotional_movements` | legacy | 1 | 3 | LEGACY |
| Proveedor | `proveedores` | procurement | 7 | 87 | ACTIVO |
| ReplacementProjection | `replacement_projections` | assets | 1 | 0 | ACTIVO |
| ReportExecution | `report_executions` | platform | 1 | 17 | ACTIVO |
| RolePermission | `role_permissions` | platform | 5 | 72 | ACTIVO |
| RoleSetting | `role_settings` | platform | 3 | 32 | ACTIVO |
| SoftwareLicenseSeat | `software_license_seats` | assets | 1 | 2 | ACTIVO |
| SoftwareProduct | `software_products` | assets | 1 | 0 | ACTIVO |
| SoftwareSubscription | `software_subscriptions` | assets | 1 | 21 | ACTIVO |
| SystemAuditEvent | `system_audit_events` | platform | 4 | 1 | ACTIVO |
| Ticket | `tickets` | legacy | 1 | 22 | LEGACY |
| TimeEntry | `time_entries` | legacy | 1 | 6 | LEGACY |
| User | `users` | people | 21 | 286 | ACTIVO |
| UserPermissionOverride | `user_permission_overrides` | platform | 4 | 0 | ACTIVO |

## Enums

| Enum | Valores | Usos en schema | Menciones en `src/` |
|------|---------|---------------:|---------------------:|
| AssignmentStatus | 5 | 1 | 5 |
| AttendanceStatus | 4 | 1 | 3 |
| AuditFindingSeverity | 5 | 1 | 0 |
| AuditStatus | 4 | 1 | 0 |
| AuditType | 3 | 1 | 0 |
| ChecklistResult | 4 | 1 | 0 |
| CompraDocumentoTipo | 7 | 1 | 0 |
| CompraEstado | 5 | 1 | 19 |
| CompraHistorialAccion | 10 | 1 | 0 |
| CompraOrdenEstado | 5 | 1 | 0 |
| CompraPrioridad | 4 | 0 | 0 |
| CompraTipo | 3 | 0 | 0 |
| CompraTipoAdjunto | 6 | 1 | 0 |
| CompraTipoDocumento | 1 | 1 | 0 |
| CompraUnidad | 9 | 2 | 6 |
| CorrectiveActionStatus | 5 | 1 | 0 |
| DisposalHistoryAction | 11 | 1 | 4 |
| DisposalResult | 3 | 1 | 2 |
| DisposalStatus | 5 | 1 | 18 |
| DocumentType | 4 | 1 | 2 |
| EquipmentCategory | 8 | 1 | 14 |
| EquipmentHistoryAction | 8 | 1 | 2 |
| EquipmentStatus | 8 | 2 | 26 |
| FunctionalCondition | 4 | 1 | 2 |
| IntegrationCapability | 12 | 1 | 11 |
| IntegrationExecutionStatus | 6 | 1 | 6 |
| IntegrationStatus | 5 | 1 | 7 |
| MaintenanceStatus | 4 | 1 | 2 |
| MaintenanceType | 4 | 1 | 2 |
| MembershipStatus | 5 | 1 | 9 |
| MovementType | 2 | 1 | 2 |
| NotificationChannel | 2 | 1 | 24 |
| NotificationDeliveryStatus | 5 | 0 | 2 |
| NotificationStatus | 5 | 1 | 8 |
| OficioImportBatchItemStatus | 4 | 1 | 2 |
| OficioImportBatchStatus | 5 | 1 | 3 |
| OficioRecordSource | 3 | 2 | 5 |
| OficioStatus | 11 | 1 | 35 |
| OficioTrackingAction | 17 | 1 | 3 |
| OficioType | 3 | 1 | 9 |
| OnboardingStatus | 4 | 1 | 11 |
| OrganizationRole | 11 | 4 | 103 |
| OrganizationStatus | 6 | 1 | 21 |
| OutboxStatus | 4 | 1 | 0 |
| PayslipDeliveryType | 3 | 1 | 0 |
| PayslipEmailStatus | 3 | 1 | 0 |
| PermissionEffect | 2 | 1 | 2 |
| PhysicalCondition | 5 | 1 | 2 |
| PlatformRole | 2 | 1 | 16 |
| PurchaseDocumentType | 7 | 1 | 21 |
| PurchaseHistoryAction | 12 | 1 | 2 |
| PurchaseOrderStatus | 5 | 1 | 47 |
| PurchaseTaxProfile | 5 | 1 | 0 |
| PurchaseUnit | 9 | 1 | 13 |
| ReplacementProjectionStatus | 3 | 1 | 0 |
| ReportExecutionStatus | 5 | 1 | 4 |
| Role | 4 | 1 | 101 |
| SecurityEventOutcome | 3 | 1 | 5 |
| SecurityEventSeverity | 4 | 1 | 4 |
| SecuritySupportStatus | 4 | 1 | 2 |
| SoftwareBillingCycle | 4 | 1 | 4 |
| SoftwareCurrency | 2 | 1 | 1 |
| SoftwareSeatStatus | 4 | 1 | 0 |
| SoftwareSeatType | 2 | 1 | 0 |
| SoftwareSubscriptionStatus | 3 | 1 | 0 |
| TicketPriority | 4 | 1 | 5 |
| TicketStatus | 4 | 1 | 5 |
| TipoDescuento | 3 | 1 | 0 |

## Duplicados y deuda conocida

### Estados de compra (nombres paralelos)

- **CompraEstado** (BORRADOR, GENERADA, EMITIDA, ANULADA, CERRADA)
- **CompraOrdenEstado** (BORRADOR, GENERADA, EMITIDA, ANULADA, CERRADA)
- **PurchaseOrderStatus** (DRAFT, GENERATED, ISSUED, CANCELLED, CLOSED)
- **CompraSolicitudEstado** — no definido en schema actual

Canónico en producto: `CompraOrdenEstado` / flujo `CompraOrden*`. `PurchaseOrderStatus` y cadenas `CompraSolicitud*` / `CompraEstado` son legado o UI histórica.

### Campos monetarios en `Float` (deben migrar a `Decimal` en fases futuras)

- `Equipment: cost                   Float?`
- `EquipmentMaintenance: cost          Float?`
- `TimeEntry: latitude  Float`
- `TimeEntry: longitude Float`
- `PromotionalItem: unitPrice     Float`
- `CompraSolicitud: subtotal  Float @default(0)`
- `CompraSolicitud: descuento Float @default(0)`
- `CompraSolicitud: total     Float @default(0)`
- `CompraSolicitudItem: precioUnitario    Float`
- `CompraSolicitudItem: total             Float`

## Notas

- Conteos de referencia son aproximados (`rg` sobre `src/`); revisar antes de borrar tablas.
- Confirmar tablas vacías en producción con `scripts/db/inventory-counts.sql` vía `railway run`.
- Existe **drift conocido** entre el historial de `prisma/migrations` y el datamodel actual (heredado de `main`); este PR no lo amplía. CI lo vigila con `scripts/db/check-drift.sh` (equivalencia vs `main` + hash baseline en `scripts/db/migration-drift-baseline.sha256`). Alinear en N2.
