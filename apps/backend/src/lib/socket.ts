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

type ClientToServerEvents = {
  register: (payload: LiveStreamClientInfo) => void;
};

type ServerToClientEvents = {
  audit: (event: EventEnvelope<AuditLogEntry | ClusterEvent>) => void;
  logs: (event: EventEnvelope<LiveLogEntry>) => void;
  workflow: (event: EventEnvelope<DeploymentProgressEvent>) => void;
};

type InterServerEvents = Record<string, never>;
type SocketData = Record<string, never>;

type KubeSuiteSocketServer = Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>;

export type SocketChannels = ServerToClientEvents;
export type SocketServer = KubeSuiteSocketServer;

const activeClients = new Map<string, LiveStreamClientInfo>();
let socketRef: KubeSuiteSocketServer | null = null;

export function createSocketServer(httpServer: HttpServer): KubeSuiteSocketServer {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, InterServerEvents, SocketData>(httpServer, {
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

  socketRef = io;
  return io;
}

export function broadcastEvent<TChannel extends keyof ServerToClientEvents>(
  io: KubeSuiteSocketServer,
  channel: TChannel,
  ...args: Parameters<ServerToClientEvents[TChannel]>
): void {
  io.emit(channel, ...args);
}

export function getSocketRef(): KubeSuiteSocketServer | null {
  return socketRef;
}
