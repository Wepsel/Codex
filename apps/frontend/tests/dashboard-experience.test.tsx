import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import type { AlertItem, ClusterSummary, WorkloadSummary } from "@kube-suite/shared";

vi.mock("@/components/session-context", () => ({
  useSession: () => ({
    user: {
      company: { role: "admin", status: "active" }
    }
  })
}));

vi.mock("@/components/copilot/copilot-panel", () => ({
  CopilotPanel: () => null
}));

vi.mock("@/components/wizard/deploy-wizard", () => ({
  DeployWizard: () => null
}));

import { DashboardExperience } from "@/components/dashboard/dashboard-experience";

const summary: ClusterSummary = {
  id: "demo",
  name: "Demo",
  context: "demo",
  distribution: "EKS",
  version: "1.29.0",
  nodes: 3,
  workloads: 8,
  pods: 24,
  phase: "Healthy",
  lastSync: new Date().toISOString(),
  cpuUsage: 0.4,
  memoryUsage: 0.5,
  namespaces: []
};

const workloads: WorkloadSummary[] = [];
const alerts: AlertItem[] = [];

describe("DashboardExperience", () => {
  it("renders action buttons", () => {
    render(<DashboardExperience summary={summary} workloads={workloads} alerts={alerts} />);
    expect(screen.getByText(/Deploy wizard/i)).toBeInTheDocument();
    expect(screen.getByText(/Copilot/i)).toBeInTheDocument();
  });
});