# Reproducible performance fixtures

See docs/PERFORMANCE_AUDIT.md for commands, measured conditions, limitations and original results. Baseline API and photo encoder are preserved from local b10f352 (corresponding remote 7ff6986); no account or invitation data is included. main.sha is the Git blob hash used to reject a mislabeled browser baseline.

Run the browser baseline against an isolated checkout of that baseline through PERF_APP_ROOT. Do not reset the working development tree. Each benchmark uses a disposable database/browser context and synthetic records. Do not run benchmark timing concurrently with tests. Runtime package overrides PLAYWRIGHT_MODULE, PGLITE_MODULE and SHARP_MODULE identify installed dependencies; do not copy unrelated project data. Local raw output is test-results/performance; committed observations and EXPLAIN plans are in docs/performance.
