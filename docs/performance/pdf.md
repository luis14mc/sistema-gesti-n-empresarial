# Phase 11D — PDF generation performance

## 1. Current implementation

`src/platform/pdf/browser.ts` resolves the Chromium executable path
and exports the standard launch arguments:

```ts
const args = ['--disable-dev-shm-usage'];
if (process.env.PUPPETEER_DISABLE_SANDBOX === 'true') {
  args.push('--no-sandbox', '--disable-setuid-sandbox');
}
```

The browser is launched per PDF job (Strategy A in the Phase 11
brief). No browser pool exists today.

## 2. Cost per job

| Phase                | Typical cost              |
| -------------------- | ------------------------- |
| Chromium launch      | 150 ms                    |
| Page creation        | 50 ms                     |
| HTML render          | 200 ms – 1 500 ms         |
| PDF serialisation    | 100 ms – 500 ms            |
| Shutdown             | 50 ms                     |
| Memory per instance  | ~80 MB resident          |

The total wall-clock cost for a small form is **0.5–2 s**; for a
disposal dictamen with assets is **1–5 s**.

## 3. PDF concurrency strategy

The recommended strategy is **per-process pool** (Strategy B):

- Each worker process holds **2 Chromium instances**.
- Each Chromium instance owns a job queue with a max length of **4**.
- The CI run measures the throughput degradation curve; the first
  bottleneck is typically the worker resident memory.

Strategy C (dedicated PDF worker service) is recommended only once
the cost of running Chromium in the same process as the application
exceeds the operational complexity of a separate service.

## 4. Browser leak guard

After a PDF burst, the post-run script
(`scripts/performance/check-browser-leaks.sh`) verifies:

- The number of `chrome` / `chromium` processes returns to the
  pre-run baseline.
- The shared memory segments are released.
- The temporary files are removed.

The script is wired into the k6 burst pipeline.

## 5. Memory caps

The browser process must be killed on the `page.on('error')` and
on `process.on('SIGTERM')` paths. The runtime (`src/worker/runtime.ts`)
exposes a `shutdown()` hook that aborts the underlying processor and
kills child processes.

## 6. Recommendations

- Use `--disable-dev-shm-usage` in every environment (avoids /dev/shm
  exhaustion in containers).
- Set Chromium `--disable-gpu` when running headless.
- Bound the per-job timeout at 30 s; abort the page and re-queue.
- Do not enable `--no-sandbox` in production; the env var is
  opt-in for restricted environments.
