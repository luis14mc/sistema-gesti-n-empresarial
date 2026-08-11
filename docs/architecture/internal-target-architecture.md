# SGE — Internal Target Architecture

**Product:** internal cloud-based institutional management system for **CNI**.
**Not:** commercial SaaS · multi-customer product · API platform · integration marketplace · billing platform.

## Request path (the whole architecture)

```
Browser
  → Next.js (App Router)
    → Route Handlers / Server Actions
      → Application services (explicit domain services)
        → Prisma
          → PostgreSQL
```

Justified add-ons only:
- **Private file storage (S3 or local)** — documents, equipment/oficio uploads, disposal evidence. REQUIRED.
- **PDF generation** — purchase orders, disposal dictámenes. REQUIRED.
- **Small worker** — only for genuinely long-running work. Currently **dormant** (no async producers); kept as a synchronous-dispatch seam.
- **Email** — optional; `NOT_ENABLED_FOR_INITIAL_RELEASE`.

## Principles

YAGNI · KISS · single source of truth · modular monolith · explicit domain services · database integrity.
Avoid: premature microservices · event-driven architecture without business need · generic provider frameworks · commercial SaaS abstractions · duplicate models · unused infrastructure.

## Tenancy (KEEP_INTERNAL_ONLY)

`organizationId` remains as an **internal safety boundary** (defense-in-depth against IDOR). CNI is the default and only organization; normal users never choose one; org switcher/provisioning/lifecycle UI is not exposed. **No `organizationId` removal migration** is performed.

## Core institutional modules (the product — never removed)

Dashboard · Oficios · Equipment · Equipment Assignments · Equipment Returns · Maintenance · Equipment Disposal · Purchase Orders (canonical `CompraOrden`) · Suppliers · Employees · Users · Roles & Permissions · Institutional Audits · Reports · Documents · Configuration · System Audit.

## Navigation (institutional IA — Phase 14A)

```
Inicio          → Dashboard
Correspondencia → Todos los oficios · Oficios internos · Oficios CNI · Oficios Despacho · Importar oficios
Activos         → Equipos · Asignaciones · Baja de equipos   (Mantenimiento: 14F)
Compras         → Órdenes de compra · Nueva orden · Proveedores · Formato CNI · Reportes
Personas        → Empleados · Usuarios
Control          → Auditoría del sistema   (Auditoría institucional: 14F)
Administración  → Configuración
```

Not exposed (foundation-only / future): Platform · Organizations · Usage · Limits · Support sessions · Integrations · Webhooks · Subscription/billing · foundation-only Notifications.

See [`disabled-foundations.md`](disabled-foundations.md) and [`schema-classification.md`](schema-classification.md).
