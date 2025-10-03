"use client";

import { useEffect, useState } from "react";
import { io, type Socket } from "socket.io-client";
import type {
  AuditLogEntry,
  ClusterEvent,
  DeploymentProgressEvent,
  EventEnvelope,
  LiveLogEntry
} from "@kube-suite/shared";

interface LiveFeed {
  logs: LiveLogEntry[];
  audit: AuditLogEntry[];
  events: ClusterEvent[];
  workflow: DeploymentProgressEvent[];
}

const INITIAL_STATE: LiveFeed = {
  logs: [],
  audit: [],
  events: [],
  workflow: []
};

export function useLiveFeed() {
  const [feed, setFeed] = useState<LiveFeed>(INITIAL_STATE);

  useEffect(() => {
    const socket: Socket = io(process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:5010", {
      path: process.env.NEXT_PUBLIC_SOCKET_PATH ?? "/ws",
      transports: ["websocket"],
      withCredentials: true
    });

    // Register with active cluster id if available
    try {
      const clusterId = typeof window !== "undefined" ? window.localStorage.getItem("clusterId") ?? undefined : undefined;
      socket.emit("register", { userId: "nebula-user", clusters: clusterId ? [clusterId] : [] } as any);
    } catch {
      socket.emit("register", { userId: "nebula-user", clusters: [] } as any);
    }

    socket.on("logs", (event: EventEnvelope<LiveLogEntry>) => {
      setFeed(prev => ({
        ...prev,
        logs: [event.payload, ...prev.logs].slice(0, 30)
      }));
    });

    socket.on("audit", (event: EventEnvelope<AuditLogEntry | ClusterEvent>) => {
      if (event.type === "cluster-event") {
        setFeed(prev => ({
          ...prev,
          events: [event.payload as ClusterEvent, ...prev.events].slice(0, 20)
        }));
        return;
      }

      setFeed(prev => ({
        ...prev,
        audit: [event.payload as AuditLogEntry, ...prev.audit].slice(0, 20)
      }));
    });

    socket.on("workflow", (event: EventEnvelope<DeploymentProgressEvent>) => {
      setFeed(prev => ({
        ...prev,
        workflow: [event.payload, ...prev.workflow].slice(0, 20)
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return feed;
}

export function useWorkflowProgress(executionId?: string) {
  const feed = useLiveFeed();
  return executionId
    ? feed.workflow.filter(item => item.id === executionId)
    : feed.workflow;
}
