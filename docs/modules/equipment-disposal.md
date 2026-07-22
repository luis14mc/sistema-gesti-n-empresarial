# Equipment Disposal

## Purpose and status

The equipment-disposal module creates and approves technical equipment-disposal determinations. It evaluates equipment against an organization policy, controls a review workflow, stores supporting evidence, generates the approved PDF, changes equipment status, and creates a replacement projection.

This module is organization-aware. Its guarantees do not extend automatically to other equipment or legacy modules.

## Module structure

- `domain`: scoring evaluator, policy validation, transition rules, domain types and errors.
- `application`: use-case service and organization-role permission mapping.
- `infrastructure`: scoped Prisma queries, tenant scope helpers, evidence storage, and PDF generation.
- `presentation`: Zod schemas, HTTP error mapping, PDF React component, and preview client.
- `src/app/api/equipment-disposal`: authenticated route handlers.

## Evaluation and draft creation

Creation accepts an equipment ID, purchase information, estimated repair and replacement costs, physical and functional condition, security support status, and optional technical notes. It does not accept an organization ID.

The service requires organization-scoped create permission and verifies that:

- The equipment belongs to the current organization.
- The organization has a disposal policy.
- The equipment has no active assignment.
- The equipment is not already in disposal, disposed, retired, or lost state.
- No draft or pending disposal already exists for that equipment in the organization.

The evaluator scores age, repair cost, condition, and security using the organization's configured weights and thresholds. The resulting score, recommendation, and rationales are captured on the disposal record.

Draft creation runs in a serializable transaction. It increments an organization/year `EQUIPMENT_DISPOSAL` sequence, creates a folio using the policy prefix, snapshots relevant equipment and evaluation data, sets the equipment to `DISPOSAL_IN_PROGRESS`, and records history and audit events.

## Workflow

Allowed status transitions are:

| From | To |
| --- | --- |
| `DRAFT` | `PENDING_APPROVAL`, `CANCELLED` |
| `PENDING_APPROVAL` | `APPROVED`, `REJECTED`, `CANCELLED` |
| `APPROVED` | Terminal |
| `REJECTED` | Terminal |
| `CANCELLED` | Terminal |

Submitting moves a draft to pending approval. Rejecting or cancelling requires a reason and restores the equipment's previous status. Approval requires at least one evidence document.

Approval generates and stores the PDF before claiming the pending record with its current version. The transactional update uses status and version predicates to detect concurrent approval. On success it:

- Marks the disposal approved and records approver and approval time.
- Saves PDF storage key, rendered data snapshot, and template snapshot.
- Marks the equipment `DISPOSED`, sets `retiredAt`, and records the disposal folio as retirement reason.
- Creates a pending replacement projection for the estimated replacement amount.
- Records PDF, approval, and equipment-status history/audit events.

If the database transaction fails after PDF storage, the service attempts to remove the stored PDF. Approval is idempotent when the disposal is already approved.

## HTTP endpoints

All endpoints require a valid JWT and resolve an active organization membership. Responses use the platform API envelope except for streamed files.

| Method | Endpoint | Behavior |
| --- | --- | --- |
| `GET` | `/api/equipment-disposal` | Paginated list; supports `page`, `pageSize` (maximum 100), `status`, and `search`. |
| `POST` | `/api/equipment-disposal` | Evaluate equipment and create a draft. |
| `GET` | `/api/equipment-disposal/{id}` | Return organization-scoped detail, evidence, history, and replacement projection. |
| `POST` | `/api/equipment-disposal/{id}/submit` | Move a draft to pending approval. |
| `POST` | `/api/equipment-disposal/{id}/approve` | Approve, generate PDF, dispose equipment, and create projection. |
| `POST` | `/api/equipment-disposal/{id}/reject` | Reject with `{ "reason": string }`. |
| `POST` | `/api/equipment-disposal/{id}/cancel` | Cancel with `{ "reason": string }`. |
| `GET` | `/api/equipment-disposal/{id}/documents` | List evidence metadata. |
| `POST` | `/api/equipment-disposal/{id}/documents` | Upload multipart field `file` while draft or pending. |
| `GET` | `/api/equipment-disposal/{id}/documents/{documentId}/view` | Stream authorized evidence inline with `private, no-store`. |
| `DELETE` | `/api/equipment-disposal/{id}/documents/{documentId}` | Delete evidence while the disposal is a draft. |
| `GET` | `/api/equipment-disposal/{id}/pdf` | Download the stored PDF for an approved disposal with `private, no-store`. |

The endpoint set has no general disposal update endpoint and no implemented policy-configuration endpoint, despite corresponding permission names existing in the permission catalog.

## Evidence documents

Evidence accepts PDF, PNG, JPEG, and WebP files up to 10 MiB. Validation checks the declared MIME type and matching filename extension. A SHA-256 hash detects duplicate content within one disposal and organization.

Files are stored before metadata is committed. If duplicate detection or metadata creation fails, the route attempts to remove the new object. Metadata records original/stored names, MIME type, size, hash, uploader, disposal, and organization.

Evidence object prefixes are:

```text
organizations/{organizationId}/equipment-disposals/{disposalId}/evidence
```

## PDF generation and storage

Approval renders `DisposalDocument` to static HTML and converts it to Letter-size PDF with the shared Puppeteer renderer. The document contains organization identity, equipment snapshot, costs and conditions, evaluation result and rationales, policy signature title, and optional footer text.

The generated PDF uses this prefix:

```text
organizations/{organizationId}/equipment-disposals/{disposalId}/pdf
```

The repository stores both a data snapshot and a template snapshot with the approved record so the inputs used for the generated document remain traceable. The PDF itself is not regenerated by the download endpoint; download streams the stored object.

Storage is selected through `STORAGE_DRIVER`:

- `local` is the default and writes under `public/uploads`; it is development-oriented.
- `s3` requires bucket, region, and AWS credentials and writes private objects by default.

Disposal view/download routes read through the storage adapter after organization and permission checks. They do not redirect the caller to the adapter's public or signed URL.

## Replacement projection

Approval upserts one `ReplacementProjection` per disposal. The projection belongs to the same organization and equipment, starts as `PENDING`, and uses the disposal's estimated replacement price. It can optionally reference a `CompraOrden` in the schema.

The current disposal module creates and returns the projection but does not implement a projection planning workflow, budget aggregation, purchase-order creation, or projection status endpoints. Those are downstream capabilities, not current behavior.

## Isolation and legacy equipment limitation

Disposal records, policy, sequence, documents, history, and projections require an organization ID. All disposal entry points resolve the organization from authenticated membership and scope their target queries.

`Equipment.organizationId` remains nullable for legacy compatibility. The disposal creation query requires an exact organization match, so unowned legacy equipment cannot enter this workflow until it is backfilled. This module-level protection does not imply that every equipment endpoint or other legacy module is tenant-scoped.

## Operational behavior

- Each disposal route creates a request ID and emits structured start, completion, or failure logs.
- Workflow history is stored in `EquipmentDisposalHistory`; service workflow events also create `AuditRecord` entries.
- Invalid transitions return conflict responses.
- Organization access and disposal permissions are checked separately.
- PDF generation depends on an available browser runtime.

## Staged next phases

1. **Complete module administration:** expose validated disposal-policy configuration and decide whether editable draft fields require a dedicated update use case.
2. **Harden files and documents:** add content-signature scanning, retention rules, and operational reconciliation for orphaned database rows or storage objects.
3. **Develop projections:** add organization-scoped projection lists, budgeting/status transitions, and an explicit purchase-order handoff.
4. **Complete legacy ownership:** backfill all equipment, make equipment organization ownership mandatory when migration permits, and review related assignment/history ownership.
5. **Expand verification:** add route-level cross-tenant integration tests, concurrency tests for sequence/approval, storage failure tests, and PDF rendering checks.
