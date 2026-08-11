# Phase 10E — Accessibility testing

The accessibility suite uses axe-core via `@axe-core/playwright`. The
harness is in `tests/accessibility/axe-harness.ts` and the route coverage
is in `tests/accessibility/axe-pages.e2e.spec.ts`. WCAG 2.2 AA is the
target.

## Coverage

Every critical route is asserted for axe-core violations:

```
/login
/dashboard
/oficios/cni
/equipos
/compras
/notificaciones
/ajustes/organizacion
```

axe is invoked with the tags `wcag2a`, `wcag2aa`, and `wcag22aa`. The
harness publishes a JSON report per test as a CI artifact.

## Critical vs. serious

- **Critical** violations block the release. They are usually
  `aria-*` or `label` rule failures that prevent assistive technologies
  from understanding the page.
- **Serious** violations are reported as warnings. They are upgraded to
  blocking after a 30-day grace period once the team has had time to
  plan the fix.

The CI gate is enforced by `expectNoCriticalViolations` and
`expectNoSeriousViolations` in the harness.

## Keyboard navigation

`tests/accessibility/keyboard.e2e.spec.ts` verifies:
- Tab reaches every interactive element in the sidebar.
- Enter opens a sidebar menu item.
- Escape closes a dialog.
- Tab order is logical inside a form.

Mouse-only assertions are explicitly rejected at code review.

## Colour independence

Reduced-motion and colour-independence checks are part of the axe run.
The dashboard and reports are required to convey status without colour
alone — charts must use patterns or labels.

## Targets

| Check                    | Gate |
| ------------------------ | ---- |
| axe critical violations  | block |
| axe serious violations   | block |
| keyboard navigation      | block |
| reduced-motion respected | block |
| focus visible            | block |
| headings hierarchy       | block |
