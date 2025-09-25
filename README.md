# Nebula Ops — Kubernetes Command Center

Nebula Ops is een cinematic, hyper-modern control center voor Kubernetes clusters. Het combineert een real-time dashboard, workload management en live telemetrie in een strak webplatform dat je net zo makkelijk lokaal draait als in een cluster.

## Features
- **Realtime cluster overzicht**: health-gauges, namespace drilldowns en workload trends.
- **Workload control**: bekijk deployments, replica status en rollout info met neon charts.
- * **Event & log feed**: websockets voor live audit-log, cluster events en pod logs.
- **Cinematic deploy wizard**: full-screen rollout simulator met YAML diff, timeline en live progress.
- **AI Ops copilot**: natural-language sidekick die kubectl-suggesties, quick actions en contextuele tips geeft.
- **Deploy automation**: manifest endpoint voorbereid voor GitOps/Helm wizards.
- **Security ready**: auth-middleware, audit trail hooks en RBAC extensies.
- **Cinematic access flow**: luxe login & registratie, standaard account `admin/admin` voor snelle start.

## Monorepo structuur
```
.
+-- apps
¦   +-- backend      # Express + Socket.IO API gateway naar Kubernetes
¦   +-- frontend     # Next.js 14 dashboard met Tailwind & React Query
+-- packages
¦   +-- shared       # Gedeelde TypeScript modellen en contracten
+-- config           # Dockerfiles, compose en env templates
+-- docs             # Architectuur & roadmap
```

## Getting started
1. **Installeer Node 20 + pnpm**
   ```bash
   corepack enable
   pnpm --version
   ```
2. **Installeer dependencies**
   ```bash
   pnpm install
   ```
3. **Zet env-variabelen**
   ```bash
   cp config/.env.example .env
   ```
4. **Start beide services**
   ```bash
   pnpm dev
   ```
   - Frontend: http://localhost:3000
   - Backend API & websockets: http://localhost:5010 (mock data by default)
   - Login: `admin` / `admin`

 & websockets: http://localhost:5010 (mock data by default)

## Testing
- Backend: `pnpm --filter @kube-suite/backend test`
- Frontend: `pnpm --filter @kube-suite/frontend test`

## Docker compose
Wil je alles containerized draaien?
```bash
cd config
docker compose up --build
```

## Integratie met echte clusters
- Zet `MOCK_MODE=false` en geef een geldig `KUBECONFIG` pad.
- Serviceaccount met read/write rechten (deployments, pods, events, logs).
- Voeg je eigen auth-provider toe in `apps/backend/src/middleware/auth.ts`.

## Roadmap ideeën
- Blueprint-wizards voor Helm charts & GitOps pipelines.
- Multi-cluster switcher + drag-to-connect cluster topology map.
- Integraties met Prometheus, Loki en Argo Rollouts.

Veel plezier met het uitbreiden – laat het dashboard shinen!


