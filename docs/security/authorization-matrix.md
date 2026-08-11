# Authorization matrix

The executable source of truth is `src/platform/security/authorization/permissions.ts`. This document explains intent and restrictions; tests verify that every role and capability produces an explicit decision.

## Organization roles

| Role | Module | Permitted actions | Scope | Restrictions |
| --- | --- | --- | --- | --- |
| `OWNER` | All organization modules | Every capability listed in `ORGANIZATION_PERMISSIONS` | Current active organization | No platform permissions; no cross-tenant bypass |
| `ADMIN` | All organization modules | Every capability listed in `ORGANIZATION_PERMISSIONS` | Current active organization | No platform permissions; cannot act without active membership |
| `IT_MANAGER` | Users | Read | Current organization | Cannot create, update, deactivate, or manage memberships |
| `IT_MANAGER` | Offices | Read, download | Current organization | No workflow mutation |
| `IT_MANAGER` | Equipment | Read, create, update, assign, maintain, dispose; disposal create/update/submit/approve/reject/cancel/download | Current organization | Cannot configure disposal policy |
| `IT_MANAGER` | Purchase orders | Read, download | Current organization | No purchase workflow mutation |
| `IT_MANAGER` | Reports | View/export, equipment financial reports, dashboard | Current organization | No purchase financial or audit reports |
| `IT_TECHNICIAN` | Offices | Read, download | Current organization | No workflow mutation |
| `IT_TECHNICIAN` | Equipment | Read, create, update, assign, maintain; disposal create/update/submit/download | Current organization | Cannot approve/reject/cancel/configure disposal |
| `IT_TECHNICIAN` | Purchase orders and reports | Read/download; view/export standard reports | Current organization | No financial or audit reports |
| `PROCUREMENT` | Offices | Read, create, update, send, receive, complete, cancel, download | Current organization | No bulk import |
| `PROCUREMENT` | Equipment | Read; disposal read/download | Current organization | No equipment mutation |
| `PROCUREMENT` | Purchase orders | Read, create, update, generate, cancel, download | Current organization | Tenant-owned suppliers and documents remain mandatory |
| `PROCUREMENT` | Reports | View/export and purchase financial reports | Current organization | No equipment financial or audit reports |
| `HR` | Users | Read, create, update | Current organization | Cannot deactivate accounts or change memberships/roles |
| `HR` | Offices | Read, create, update, send, receive, complete, cancel, download | Current organization | No bulk import |
| `HR` | Equipment and purchases | Read/download only | Current organization | No workflow mutation |
| `HR` | Reports | View/export standard reports | Current organization | No financial or audit reports |
| `AUDITOR` | Users, offices, equipment, purchases | Read/download | Current organization | No operational mutation |
| `AUDITOR` | Reports and audit | View/export financial and audit reports; read audit logs | Current organization | Audit export requires separate export capability when implemented |
| `USER` | Offices, equipment, disposal, purchase orders, dashboard | Read only | Current organization | No download capability where separately protected; no mutation |

## Platform roles

| Role | Permission | Module/action | Scope | Restrictions |
| --- | --- | --- | --- | --- |
| `PLATFORM_ADMIN` | `platform.health.read` | Platform health/read | Platform | Does not grant tenant access |
| `PLATFORM_ADMIN` | `platform.audit.read` | Platform audit/read | Platform | Restricted data minimization still applies |
| `PLATFORM_ADMIN` | `reports.platform` | Platform reports/view | Platform | Does not grant organization report access |
| `SUPPORT_ADMIN` | `platform.health.read` | Platform health/read | Platform | No tenant data, impersonation, write, or audit capability |

## Enforcement coverage

Phase 6A application-service enforcement is active for:

- Equipment-disposal read and workflow services
- Reporting query and export services
- Audit-log query service

The audit found legacy routes that still use global roles or route-only checks, especially users, employees, offices, equipment/assignment/maintenance, purchases, and institutional audits. Those routes are not represented as hardened until they are moved behind an application-service capability boundary and covered by tenant-aware tests.
