# Notifications

Import `notification` from `@/platform/notifications`.

Supported operations are `success`, `error`, `warning`, `info`, `confirm`, and `loading`. Confirmation returns a boolean; loading returns one close function. Spanish labels are the default.

Only the action owner displays feedback. Services and API interceptors must not notify. Mutation hooks may notify only when they fully own the user action; otherwise the page handler owns feedback.

Feature code must not import SweetAlert2 or another toast provider directly. Normalize failures with `getApiError()` before presenting them, and never display raw machine codes.
