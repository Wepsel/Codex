import type { Server } from "socket.io";
import { broadcastEvent, getSocketRef } from "../lib/socket";
import type { SocketChannels } from "../lib/socket";
import { mockAuditLog, mockEvents, mockLogs } from "./mock-data";
import type { DeploymentProgressEvent, DeploymentStage } from "@kube-suite/shared";

let intervalId: NodeJS.Timeout | null = null;

const progressStages: DeploymentStage[] = ["plan", "build", "ship", "rollout", "complete"];

export function startStreaming(io: Server<SocketChannels>) {
  if (intervalId) {
    return;
  }

  intervalId = setInterval(() => {
    const log = mockLogs[Math.floor(Math.random() * mockLogs.length)];
    const audit = mockAuditLog[Math.floor(Math.random() * mockAuditLog.length)];
    const event = mockEvents[Math.floor(Math.random() * mockEvents.length)];

    broadcastEvent(io, "logs", {
      type: "log-entry",
      payload: { ...log, timestamp: new Date().toISOString() }
    });

    broadcastEvent(io, "audit", {
      type: "audit-entry",
      payload: { ...audit, createdAt: new Date().toISOString() }
    });

    broadcastEvent(io, "audit", {
      type: "cluster-event",
      payload: { ...event }
    });

    // Every loop emit a subtle workflow heartbeat to keep the UI alive.
    broadcastEvent(io, "workflow", {
      type: "deployment-progress",
      payload: buildProgressEvent("telemetry-heartbeat", "complete", 100, "System check complete")
    });
  }, 4_000);
}

export function stopStreaming() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function simulateDeploymentProgress(id: string, manifestName: string) {
  const io = getSocketRef();
  if (!io) {
    return;
  }

  progressStages.forEach((stage, index) => {
    setTimeout(() => {
      const percentage = Math.min(100, Math.round((index / (progressStages.length - 1)) * 100));
      const message = stageMessage(stage, manifestName);

      broadcastEvent(io, "workflow", {
        type: "deployment-progress",
        payload: buildProgressEvent(id, stage, percentage, message)
      });
    }, index * 2_000);
  });
}

function buildProgressEvent(
  id: string,
  stage: DeploymentStage,
  percentage: number,
  message: string
): DeploymentProgressEvent {
  return {
    id,
    stage,
    status: stage === "complete" ? "success" : "running",
    percentage,
    message,
    timestamp: new Date().toISOString()
  };
}

function stageMessage(stage: DeploymentStage, manifestName: string): string {
  switch (stage) {
    case "plan":
      return `Validating manifest ${manifestName}`;
    case "build":
      return `Building container image for ${manifestName}`;
    case "ship":
      return `Pushing rollout bundles for ${manifestName}`;
    case "rollout":
      return `Rolling out ${manifestName} to cluster`;
    case "complete":
      return `${manifestName} deployed successfully`;
    default:
      return "Processing";
  }
}
