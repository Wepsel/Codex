import "express-async-errors";
import cors, { CorsOptions } from "cors";
import cookieParser from "cookie-parser";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import env from "./config/env";
import routes from "./routes";
import { authenticateUser } from "./middleware/auth";
import { errorHandler, notFoundHandler } from "./middleware/error-handler";

const corsOptions: CorsOptions = {
  origin(origin, callback) {
    if (!origin) {
      return callback(null, env.frontendOrigins[0] ?? false);
    }
    if (env.frontendOrigins.includes(origin)) {
      return callback(null, origin);
    }
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  exposedHeaders: ["x-request-id"]
};

export function createApp() {
  const app = express();
  app.use(helmet());
  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));
  app.use(express.json({ limit: "1mb" }));
  app.use(cookieParser());
  app.use(morgan("tiny"));

  app.use(authenticateUser);
  app.use("/api", routes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
