import http from "http";
import env from "./config/env";
import { createApp } from "./server";
import { createSocketServer } from "./lib/socket";
import { logger } from "./lib/logger";
import { startStreaming, stopStreaming } from "./services/streaming.service";

const app = createApp();
const server = http.createServer(app);
const io = createSocketServer(server);

startStreaming(io);

server.listen(env.port, () => {
  logger.info("backend server listening", { port: env.port, env: env.nodeEnv });
});

process.on("SIGINT", () => {
  logger.info("received SIGINT, shutting down");
  stopStreaming();
  io.close();
  server.close(() => process.exit(0));
});

process.on("SIGTERM", () => {
  logger.info("received SIGTERM, shutting down");
  stopStreaming();
  io.close();
  server.close(() => process.exit(0));
});
