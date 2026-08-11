# Schema Classification (Phase 14)

Classification of Prisma models ahead of any deprecation (14E). **No table is dropped before**: zero active code dependency · zero historical data value · tested migration · rollback plan. Prefer deprecation → legacy-read-only → destructive delete.

**Legend:** `ACTIVE` · `LEGACY_READ_ONLY` · `FOUNDATION_UNUSED` · `DEPRECATED` · `REMOVE_LATER`.

| Model / group | Classification | Rationale | Deletion pre-conditions |
|---------------|----------------|-----------|-------------------------|
| `Oficio*`, `Equipment*`, `EquipmentAssignment`, `EquipmentMaintenance`, `EquipmentDisposal*`, `DisposalDocument`, `DisposalPolicy` | ACTIVE | Core workflows | — keep |
| `CompraOrden` (+ `Item`/`Documento`/`Historial`/`Sequence`/`Template`), `CompraDocumento`, `CompraAdjunto`, `Proveedor`, `CostCenter` | ACTIVE | Canonical procurement | — keep |
| `Employee`, `User`, `Department`, `DocumentSequence` | ACTIVE | Core | — keep |
| `Audit`, `AuditFinding`, `AuditChecklistItem`, `CorrectiveAction` | ACTIVE (wire in 14F) | Institutional audits | — keep |
| `Organization`, `OrganizationMembership` | ACTIVE (internal-only) | Tenant safety boundary | **do not drop** |
| `SystemAuditEvent` | ACTIVE | System audit log | — keep |
| `ReportExecution` | ACTIVE (review) | Keep if execution is real; else collapse to sync | — |
| `CompraSolicitud`, `CompraSolicitudItem` | DEPRECATED | APIs 410; canonical = `CompraOrden`; sole ref in `src/lib/compras/service.ts` | remove read → verify no historical dependency → drop |
| `CompraOrdenLegacy`, `CompraOrdenItemLegacy`, `CompraOrdenDocumentoLegacy`, `CompraOrdenHistorialLegacy`, `CompraOrdenSequenceLegacy` | LEGACY_READ_ONLY | Shadow canonical | confirm no reads / migration path → drop |
| `DomainEventOutbox` | FOUNDATION_UNUSED | Zero producers/consumers | drop after confirming no rows relied upon |
| `OrganizationIntegration`, `IntegrationExecution` | FOUNDATION_UNUSED | No adapter/consumer | disable routes → drop |
| `Notification`, `NotificationDelivery` | FOUNDATION_UNUSED (v1) | One caller, disabled surface | keep minimal seam or drop |
| `Ticket`, `TimeEntry`, `AttendancePolicy`, `AuditRecord`, `PromotionalItem`, `PromotionalMovement`, `JobPosition`, `ReplacementProjection` | DEPRECATED | Out of the 17 required domains; APIs 410 where present; `jobPosition` 0 code refs | confirm no reads/reports → drop |
| Enum `SecuritySupportStatus` | REMOVE_LATER | SaaS support-session vestige | drop with schema cleanup |

**Absent (never introduced — no action):** `OrganizationModule`, `OrganizationLimit`, `OrganizationUsage`, `ExternalIdentity`, `ExternalSyncRecord`, `WebhookSubscription`, `InboundIntegrationEvent`, `BackgroundJob`.

**Procurement decision (preserved):** `CompraOrden` is canonical. No active UI/report/dashboard may read `CompraSolicitud` (C-1 repointed dashboard + reports to `CompraOrden`).
