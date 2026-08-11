# Components

## PageHeader

Use `PageHeader` once at the top of every authenticated main page. It supports title, description, breadcrumbs, primary action, and secondary actions. The legacy children action slot remains temporarily supported during migration.

## StatusBadge

Use `StatusBadge` with a semantic tone: `neutral`, `success`, `warning`, `info`, or `destructive`. Domain adapters own Spanish labels; unknown backend enums must not be displayed raw.

## States

- `LoadingState` uses skeletons and exposes an accessible polite status.
- `EmptyState` explains what is empty and may provide one next action.
- `ErrorState` provides a friendly message, optional retry, and optional request reference.

Base controls continue to use the existing shadcn primitives. Do not create module-specific copies of shared components.
