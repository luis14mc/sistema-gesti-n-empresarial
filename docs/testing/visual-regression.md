# Phase 10E — Visual regression

Visual regression is implemented with Playwright screenshots. The
snapshots are stored under `tests/accessibility/__snapshots__/` once
the suite is first executed. The suite is reviewed at every PR that
touches the UI.

## Coverage

The critical UI surfaces are captured at four breakpoints:

| Breakpoint    | Width × Height |
| ------------- | -------------- |
| Mobile-360    | 360 × 800      |
| Tablet-768    | 768 × 1024     |
| Desktop-1366  | 1366 × 768     |
| Desktop-1920  | 1920 × 1080    |

The pages captured are:

```
/dashboard
/oficios/cni
/equipos
/compras
/notificaciones
/ajustes/organizacion
```

## Tolerance

The harness uses `maxDiffPixelRatio: 0.01` (1% diff). The team may
tighten this to 0.005 once the baseline stabilises. Anti-aliasing
differences in different browsers are absorbed by the tolerance.

## Updating baselines

When a deliberate UI change is merged, the visual regression baselines
must be regenerated. The generation flow is:

```bash
pnpm exec playwright test tests/accessibility/visual-regression.e2e.spec.ts --update-snapshots
```

The PR that updates the baselines must include before/after screenshots
in the description and a reviewer from the design system team.

## Layout invariants

The harness also asserts on layout invariants:

- No horizontal page overflow at each breakpoint.
- The sidebar collapses to a hamburger at < 768px.
- Dialogs are centred and fit within the viewport.
- Tables are horizontally scrollable inside their container, not the
  page.
