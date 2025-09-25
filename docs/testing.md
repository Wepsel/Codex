# Teststrategie

## Backend
- **Unit & integratietests** via Jest + Supertest (`pnpm --filter @kube-suite/backend test`).
- Mock-mode zorgt voor deterministische responses, zodat tests draaien zonder cluster.
- Voor productie: voeg contract tests toe met een echte cluster sandbox.

## Frontend
- **Component tests** met Vitest en Testing Library (`pnpm --filter @kube-suite/frontend test`).
- Critical UI (dashboard metrics, alert panel) krijgt snapshot + behavioural assertions.
- Playwright E2E scenario''s kunnen eenvoudig worden toegevoegd in `apps/frontend/tests/e2e`.

## Quality gates
- `pnpm lint` om ESLint regels te checken voor alle workspaces.
- `pnpm build` compileert backend en frontend, ideaal voor CI pipelines.
- GitHub Actions template kan `pnpm install`, `pnpm lint`, `pnpm test`, `pnpm build` runnen.
