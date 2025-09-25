import dotenv from "dotenv";

dotenv.config();

const frontendOrigins = (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map(origin => origin.trim())
  .filter(Boolean);

const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 5010),
  kubeConfigPath: process.env.KUBECONFIG,
  websocketPath: process.env.WEBSOCKET_PATH ?? "/ws",
  mockMode: process.env.MOCK_MODE === "true",
  frontendOrigins,
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET ?? "dev-secret",
  auditPersistence: process.env.AUDIT_PERSISTENCE ?? "memory",
  openAiApiKey: process.env.OPENAI_API_KEY
};

export default env;
