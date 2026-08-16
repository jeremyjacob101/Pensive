# Test suite

The repository test suite is split by runtime and risk:

- `npm run test:unit` runs deterministic web helpers, React components/pages/routes/hooks, and script safety tests.
- `npm run test:convex` runs authenticated Convex function tests against an in-memory `convex-test` database. They never connect to a deployment.
- `npm run test:coverage` produces an informational HTML/LCOV report in `test-results/coverage`; behavior assertions and build/type/lint failures are the correctness gates.
- `npm run test:e2e` runs browser smoke, accessibility, responsive, and read-only HTTP contract tests. It requires all three variables below.
- `npm run ios:test` regenerates the Xcode project and runs the unit, HTTP/API integration, and UI workflow targets. UI fixtures use a loopback URL and never a remote deployment.
- `npm run test:all` runs the complete local sequence.

Browser E2E variables must point to disposable non-production targets:

```sh
PENSIVE_E2E_BASE_URL=http://127.0.0.1:1111 \
PENSIVE_E2E_API_URL=https://<non-production>.convex.site \
PENSIVE_E2E_CONVEX_URL=https://<non-production>.convex.cloud \
npm run test:e2e
```

The Playwright config rejects production hostnames and refuses to start without explicit target URLs. The CI `Testing` environment should provide the two Convex URLs; the workflow uses a local Vite server for the web bundle so pull requests test the submitted frontend code against the disposable backend.

Live iOS contract checks are opt-in through `PENSIVE_RUN_LIVE_IOS_CONTRACT=1` and `PENSIVE_IOS_TEST_HTTP_URL`. The script rejects production-looking values before making a request. The normal iOS unit, integration, and UI targets remain deterministic and local.

The four Test Suite jobs are the required PR checks on `main` and `staging`: `Static quality`, `Web and Convex behavior tests`, `Browser E2E (non-production)`, and `iOS unit, integration, and UI tests`. A push to `staging` deploys Convex only from the Test Suite's `Deploy staging` job, which depends on all four jobs succeeding. Coverage and browser reports remain temporary CI artifacts; they are not committed to the repository.

Hotfix pushes run the same four jobs. The hotfix promotion workflow waits for those exact check results on the exact hotfix commit before it can advance `main`.
