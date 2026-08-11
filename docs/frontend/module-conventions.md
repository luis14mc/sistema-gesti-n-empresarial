# Frontend Module Conventions

## Boundaries

- `src/components/ui`: reusable visual primitives and compositions.
- `src/components/<domain>`: domain presentation adapters.
- `src/hooks`: shared queries and mutations with stable query keys.
- `src/modules`: domain/application architecture; Phase 2 must not rewrite it.
- `src/platform`: cross-cutting frontend infrastructure such as notifications and API contracts.

## Rules

- Resolve organization context on the server; never expose editable organization ownership.
- Preserve backend authorization even when permissions hide unavailable actions.
- Consume errors through `getApiError()`.
- Use semantic tokens, Spanish labels, and centralized status mappings.
- Keep server document components free of hooks, browser APIs, and `use client`.
- Avoid duplicated queries between page, form, preview, and workspace.
- Heavy document viewers should load lazily; live previews render React and do not invoke Puppeteer.

Each module migration must include focused tests and report remaining inconsistencies before the next module begins.
