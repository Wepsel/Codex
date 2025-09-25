# Kubernetes Control Suite Architecture

## High-Level Overview
- **Frontend (`apps/frontend`)**: Next.js 14 dashboard with Tailwind CSS and shadcn/ui foundation. Provides real-time views of cluster health, workloads, events, and offers interactive wizards for deployments and maintenance tasks.
- **Backend (`apps/backend`)**: TypeScript service running on Express and Socket.IO. Acts as API gateway to Kubernetes, handles authentication, RBAC, caching, and streams cluster events to the UI.
- **Shared (`packages/shared`)**: Reusable TypeScript models, API contracts, UI themes, and utility helpers shared between frontend and backend.
- **Config (`config`)**: Environment templates, Helm chart scaffold, and Kubernetes manifests for deploying the stack.
- **Docs (`docs`)**: Product requirements, architecture rationale, runbooks, and onboarding material.

## Core Capabilities
1. **Cluster Overview Dashboard**
   - Global health summary, node map, workload status, and alerts feed.
   - High-contrast dark theme with accent gradients for modern aesthetic.

2. **Workload Management**
   - Browse namespaces, deployments, pods, jobs.
   - Drill-down pages for pod logs, metrics, and live events.
   - Action tray for scale, restart, rolling update, and rollbacks.

3. **Deploy & Automate**
   - Guided wizard for deploying manifests or Helm charts.
   - GitOps integration hooks and template catalog.

4. **Observability & Alerts**
   - Native Prometheus/Grafana bridges via backend data aggregation.
   - Configurable alert policies and notification channels.

5. **Security & Access**
   - OAuth 2.0 / OIDC login with pluggable providers.
   - Role-based dashboards and action permissions.
   - Audit log stream and export.
6. **Intelligent Assist**
   - Cinematic deploy wizard met diff preview en progress streaming.
   - AI Copilot voor natural-language acties en kubectl-suggesties.

   - OAuth 2.0 / OIDC login with pluggable providers.
   - Role-based dashboards and action permissions.
   - Audit log stream and export.

## Technology Selections
- **UI Stack**: Next.js 14 (App Router), Tailwind CSS, shadcn/ui, Framer Motion, Recharts.
- **State/Query**: TanStack Query + Zustand for local orchestration.
- **Realtime**: Socket.IO websockets, SSE fallback.
- **Backend**: Express + TypeScript, Zod validation, Prisma (PostgreSQL) for persistent data & audit logs.
- **Kubernetes SDK**: `@kubernetes/client-node` with typed wrappers and caching via Redis (optional).
- **Testing**: Jest & Supertest (backend), Vitest & Testing Library (frontend), Playwright for e2e.
- **CI/CD**: GitHub Actions, container builds via Docker, deployment via Helm chart.

## Next Steps
1. Scaffold workspace and toolchains (root package manifest, TS configs, linting, formatting).
2. Implement backend foundation: auth stub, proxy, metrics aggregator, websocket broadcaster.
3. Build frontend shell: layout, navigation, dashboard cards, theme tokens.
4. Connect backend ? frontend; implement mocked cluster data for local dev.
5. Add tests, storybook stories, and sample e2e flow.

