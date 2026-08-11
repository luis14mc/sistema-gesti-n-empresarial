# Phase 13A — Data-Integrity Pre-Remediation Sweep (Read-Only)

**Status:** Queries authored and verified against the Prisma schema. **Execution PENDING** — no live database was reachable from the audit environment (the configured `DATABASE_URL` is a remote pooler endpoint not accessible here). Run each query **read-only** against a production/staging snapshot and record results in the `result` column and in the accompanying JSON.

**Rules:** No automatic repair. Every query below is a `SELECT` only. Do not run repairs from application startup. Confirmed issues are remediated later via explicit, dry-run-default scripts under `scripts/remediation/` (see Phase 13, §36).

**Table reference (Prisma `@@map`):** `purchase_orders` (CompraOrden), `compras_solicitudes` (CompraSolicitud legacy), `equipment`, `equipment_assignments`, `equipment_disposals`, `oficios`, `document_sequences`, `system_audit_events`, `domain_event_outbox`, `notifications`.

---

## Integrity checks

### 1. Orphan child records (assignments → equipment)
```sql
SELECT a.id
FROM equipment_assignments a
LEFT JOIN equipment e ON e.id = a."equipmentId"
WHERE e.id IS NULL;
```

### 2. Missing organization ownership (operational tables)
```sql
SELECT 'equipment' AS tbl, id FROM equipment WHERE "organizationId" IS NULL
UNION ALL SELECT 'purchase_orders', id FROM purchase_orders WHERE "organizationId" IS NULL
UNION ALL SELECT 'equipment_assignments', id FROM equipment_assignments WHERE "organizationId" IS NULL
UNION ALL SELECT 'oficios', id FROM oficios WHERE "organizationId" IS NULL;
```

### 3. Duplicate document sequences
```sql
SELECT "organizationId", "documentType", year, COUNT(*)
FROM document_sequences
GROUP BY "organizationId", "documentType", year
HAVING COUNT(*) > 1;
```

### 4. Duplicate ACTIVE assignments per equipment (audit finding M-1)
```sql
SELECT "equipmentId", COUNT(*) AS active_count
FROM equipment_assignments
WHERE status = 'ACTIVE'
GROUP BY "equipmentId"
HAVING COUNT(*) > 1;
```

### 5. Approved disposal whose equipment is NOT disposed
```sql
SELECT d.id AS disposal_id, e.id AS equipment_id, e.status
FROM equipment_disposals d
JOIN equipment e ON e.id = d."equipmentId"
WHERE d.status = 'APPROVED'
  AND e.status <> 'DISPOSED';
```

### 6. Disposed equipment that still has an ACTIVE assignment
```sql
SELECT e.id AS equipment_id, a.id AS assignment_id
FROM equipment e
JOIN equipment_assignments a ON a."equipmentId" = e.id AND a.status = 'ACTIVE'
WHERE e.status IN ('DISPOSED', 'RETIRED', 'LOST');
```

### 7. Purchase totals inconsistent (canonical `purchase_orders`)
Recompute total = subtotal − discount + tax and flag drift > 0.01.
```sql
SELECT id, subtotal, discount, tax, total,
       (subtotal - discount + tax) AS recomputed
FROM purchase_orders
WHERE "deletedAt" IS NULL
  AND ABS(total - (subtotal - discount + tax)) > 0.01;
```

### 8. Purchase orders past DRAFT with no supplier
```sql
SELECT id, "orderNumber", status
FROM purchase_orders
WHERE "deletedAt" IS NULL
  AND status <> 'DRAFT'
  AND ("supplierName" IS NULL OR "supplierName" = '');
```

### 9. Generated/issued purchase orders missing their document
```sql
SELECT po.id, po."orderNumber", po.status
FROM purchase_orders po
LEFT JOIN "purchase_order_documents" d ON d."purchaseOrderId" = po.id
WHERE po."deletedAt" IS NULL
  AND po.status IN ('GENERATED', 'ISSUED', 'CLOSED')
  AND d.id IS NULL;
```
> Verify the documents table name against the schema mapping for `CompraOrdenDocumento` before running.

### 10. Oficios in an invalid / null state
```sql
SELECT id, number, status
FROM oficios
WHERE status IS NULL
   OR status NOT IN ('DRAFT','SENT','RECEIVED','IN_PROCESS','COMPLETED','ARCHIVED','CANCELLED');
```

### 11. Broken historical references (equipment history → equipment)
```sql
SELECT h.id
FROM equipment_history h
LEFT JOIN equipment e ON e.id = h."equipmentId"
WHERE e.id IS NULL;
```

### 12. Missing audit references (approved disposals without an audit event)
```sql
SELECT d.id
FROM equipment_disposals d
WHERE d.status = 'APPROVED'
  AND NOT EXISTS (
    SELECT 1 FROM system_audit_events s
    WHERE s."entityId" = d.id AND s.action = 'DISPOSAL_APPROVED'
  );
```

### 13. Unprocessed background jobs
**NOT APPLICABLE.** There is no background-job table in the schema (no async job model or producer exists; dispatch is synchronous/in-process — see 13D). No backlog is possible.

### 14. Outbox backlog
```sql
SELECT status, COUNT(*)
FROM domain_event_outbox
GROUP BY status;
```
> Expected: **0 rows.** The outbox has no producer (`appendOutboxEvent` is never called) and no consumer. Any rows would indicate an unexpected producer; classified dormant in 13E.

### 15. Notifications without a resolvable recipient
```sql
SELECT n.id
FROM notifications n
LEFT JOIN users u ON u.id = n."userId"
WHERE n."userId" IS NULL OR u.id IS NULL;
```

### 16. Legacy vs canonical procurement volume (informational — supports 13B strategy)
```sql
SELECT 'canonical purchase_orders' AS source, COUNT(*) FROM purchase_orders WHERE "deletedAt" IS NULL
UNION ALL
SELECT 'legacy compras_solicitudes', COUNT(*) FROM compras_solicitudes WHERE "deletedAt" IS NULL;
```
This count directly determines the historical-data strategy in `procurement-canonicalization.md` (§15 A/B/C).

---

## Interpretation guide

| Check | If rows returned |
|---|---|
| 1, 11 | CRITICAL orphan — investigate FK / cascade; repair script required |
| 2 | CRITICAL tenant gap — backfill organizationId under review |
| 3 | CRITICAL — duplicate numbering risk; de-dup under review |
| 4 | HIGH — confirms M-1; add DB partial-unique + repair |
| 5, 6 | CRITICAL — impossible lifecycle state; manual reconciliation |
| 7 | CRITICAL — financial drift; block reporting until reconciled |
| 8, 9 | HIGH — official document gaps |
| 10 | HIGH — invalid workflow state |
| 12 | MEDIUM — audit trail gap |
| 14 | Confirms outbox dormant (expected empty) |
| 15 | MEDIUM — undeliverable notifications |
| 16 | Informational — drives historical strategy |

**No repair is performed by this sweep.** Findings feed the repair scripts and the historical-data decision.
