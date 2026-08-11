# Phase 10A — Flaky-test policy

A flaky test is a test that passes and fails intermittently in the
absence of a code change. Flaky tests erode confidence in the entire
suite and slow down every CI run. This policy is binding for every
phase of the SGE modernisation.

## Detection

- A test is flagged when CI reports a failure that is not reproducible
  on the same commit after a re-run.
- The QA lead maintains a `flaky-tests.md` register (Phase 10G) that
  records: test ID, owner, first-seen date, expected resolution date,
  status (open, quarantined, fixed, deleted).

## Quarantine

- A flaky test must be moved under `tests/__quarantine__/` (or
  `it.skip(...)` with a `// FIXME: flaky — issue #NNN` comment) within
  one week of the first observed failure.
- The author is responsible for fixing the test. If the author is no
  longer available, the QA lead assigns the fix.
- The quarantine is **time-boxed**:
  - 14 days for unit / shape / contract tests.
  - 7 days for security regression tests.
  - 3 days for live-database integration tests.
  - 1 day for E2E tests (introduced in 10D).
- After the window expires, the test is either fixed or deleted.

## Forbidden

- No silent `retries:` in CI workflow steps to mask a flaky test.
- No `setTimeout(..., 1000)` to "give the system a moment". Use
  deterministic fixtures or a polling helper with a clear timeout.
- No `it.skip(...)` without a `// FIXME: flaky — issue #NNN` comment.
- No `flaky: true` annotation on a test that has not been triaged.
- No resurrection of a deleted flaky test without a clear root-cause
  note.

## Required practices

- A test that reads `performance.now()` or `Date.now()` is suspect;
  inject a clock.
- A test that depends on a real network call (without `SGE_LIVE_DB` /
  explicit stub) is suspect; replace it with a fake provider server.
- A test that uses `setTimeout` for "wait until done" is suspect;
  poll with a small backoff and a hard ceiling.
- A test that asserts on a private field or implementation detail is
  suspect; refactor to assert on observable behaviour.
- A test that depends on a global mutable singleton must reset the
  singleton in `beforeEach` or `afterEach`.

## Triage workflow

1. CI fails. The QA lead captures the test ID and the commit SHA.
2. If the failure is reproducible on the same commit, it is **not**
   flaky — open a regular defect.
3. If the failure is not reproducible, the test is flaky. The author
   moves it to `tests/__quarantine__/` and opens an issue with the
   `flaky` label.
4. The author has until the end of the quarantine window to fix it.
5. After the window:
   - If fixed, the test returns to the live tree with a regression
     note in the commit message.
   - If not fixed, the test is deleted and a regression note is added
     to the test register.

## Reporting

The release-quality report includes a "Flaky tests" section. A
release with an open quarantine beyond the window is a CRITICAL
defect and blocks the release.
