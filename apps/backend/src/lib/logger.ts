export type LogLevel = "debug" | "info" | "warn" | "error";

const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const currentLevel = (process.env.LOG_LEVEL as LogLevel) ?? "info";

// Simple structured logger. Production deployment should swap with pino/winston.
export function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (levelPriority[level] < levelPriority[currentLevel]) {
    return;
  }
  const payload = {
    level,
    message,
    ...meta,
    timestamp: new Date().toISOString()
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}

export const logger = {
  debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
  info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
  warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
  error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta)
};
