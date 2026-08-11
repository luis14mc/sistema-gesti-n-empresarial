# Domain Architecture

SGE uses incremental modular domain architecture. HTTP routes validate transport input and create a `CommandContext`; application services enforce permissions and coordinate repositories; pure domain code owns rules and transitions; infrastructure implements persistence, storage, PDF, and integrations.

```text
Presentation -> Application -> Domain
Infrastructure -> Domain interfaces
```

The domain must not import Next.js request/response types, React, Axios, browser APIs, or UI labels.

## Aggregate roots

- `Organization` and membership establish tenant and operational authority.
- `Oficio` owns documents, tracking, and import metadata.
- `Equipment` coordinates assignment, maintenance, and disposal eligibility.
- `EquipmentAssignment` owns assignment and controlled return state.
- `EquipmentDisposal` owns evidence, evaluation, history, and replacement projection creation.
- `CompraOrden` is the canonical purchase-order aggregate and owns items, documents, and history.
- `Proveedor` is organization-owned supplier master data.
- `Audit` is institutional audit management and is separate from immutable system audit events.

Phase 3A adds shared typed errors, transition policies, command context, aggregate versions, sequence allocation, immutable audit events, and transactional outbox primitives. Business modules adopt these foundations one at a time.
