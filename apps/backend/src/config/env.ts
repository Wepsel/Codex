import fs from "fs";
import path from "path";
import dotenv from "dotenv";

function resolvePath(candidate: string): string {
  return path.resolve(candidate);
}

function fileExists(candidate: string | undefined): candidate is string {
  return Boolean(candidate && fs.existsSync(candidate));
}

let loadedEnvFile: string | undefined;

const defaultResult = dotenv.config();
if (!defaultResult.error && defaultResult.parsed) {
  const defaultPath = resolvePath(path.join(process.cwd(), ".env"));
  if (fs.existsSync(defaultPath)) {
    loadedEnvFile = defaultPath;
  }
}

const shouldLoadFallbackEnv = (!process.env.DATABASE_URL || process.env.DATABASE_URL.trim().length === 0) && (process.env.NODE_ENV ?? "development") !== "test";

if (shouldLoadFallbackEnv) {
  const candidates = [
    process.env.ENV_FILE,
    path.join(process.cwd(), "../config/.env"),
    path.join(process.cwd(), "../../config/.env"),
    path.join(process.cwd(), "../.env"),
    path.join(process.cwd(), "../../.env"),
    path.join(__dirname, "../../../config/.env"),
    path.join(__dirname, "../../../../config/.env")
  ]
    .filter((value): value is string => Boolean(value))
    .map(candidate => resolvePath(candidate));

  for (const candidate of candidates) {
    if (loadedEnvFile && candidate === loadedEnvFile) {
      continue;
    }
    if (!fileExists(candidate)) {
      continue;
    }
    const result = dotenv.config({ path: candidate, override: false });
    if (!result.error) {
      loadedEnvFile = candidate;
      break;
    }
  }
}

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
  databaseUrl: process.env.DATABASE_URL,
  frontendOrigins,
  accessTokenSecret: process.env.ACCESS_TOKEN_SECRET ?? "dev-secret",
  auditPersistence: process.env.AUDIT_PERSISTENCE ?? "memory",
  openAiApiKey: process.env.OPENAI_API_KEY,
  loadedEnvFile
};

export default env;
