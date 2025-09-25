import type { Server as HttpServer } from "http";
import { Server } from "socket.io";
import env from "../config/env";
import { logger } from "./logger";
import type { LiveStreamClientInfo } from "../types";
import type {
  AuditLogEntry,
  ClusterEvent,
  DeploymentProgressEvent,
  EventEnvelope,
  LiveLogEntry
} from "@kube-suite/shared";

export interface SocketChannels {
  audit: EventEnvelope<AuditLogEntry | ClusterEvent>;
  logs: EventEnvelope<LiveLogEntry>;
  workflow: EventEnvelope<DeploymentProgressEvent>;
}

const activeClients = new Map<string, LiveStreamClientInfo>();
let socketRef: Server<SocketChannels> | null = null;

export function createSocketServer(httpServer: HttpServer): Server<SocketChannels> {
  const io = new Server(httpServer, {
    path: env.websocketPath,
    cors: {
      origin: "*"
    }
  });

  io.on("connection", socket => {
    logger.info("socket client connected", { id: socket.id });

    socket.on("register", (payload: LiveStreamClientInfo) => {
      activeClients.set(socket.id, payload);
      logger.debug("socket client registered", { id: socket.id, payload });
    });

    socket.on("disconnect", reason => {
      logger.info("socket client disconnected", { id: socket.id, reason });
      activeClients.delete(socket.id);
    });
  });

  socketRef = io as Server<SocketChannels>;
  return io as Server<SocketChannels>;
}

export function broadcastEvent<TChannel extends keyof SocketChannels>(
  io: Server<SocketChannels>,
  channel: TChannel,
  event: SocketChannels[TChannel]
): void {
  io.emit(channel, event);
}

export function getSocketRef(): Server<SocketChannels> | null {
  return socketRef;
}
