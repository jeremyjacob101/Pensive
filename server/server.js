import cors from "cors";
import express from "express";
import { fileURLToPath } from "url";
import { PORT } from "./config/constants.js";
import { errorHandler } from "./http/errors.js";
import apiRoutes from "./routes/api.js";

const DEFAULT_ALLOWED_ORIGINS = [
  "https://pensivefinancial.site",
  "https://www.pensivefinancial.site",
];

function normalizeOrigin(origin) {
  const trimmed = origin.trim().replace(/\/+$/, "");

  if (!trimmed || trimmed === "*") {
    return trimmed;
  }

  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

function getAllowedOrigins() {
  const configuredOrigins =
    process.env.CORS_ORIGIN ?? process.env.FRONTEND_ORIGIN;
  const rawOrigins = configuredOrigins
    ? configuredOrigins.split(",")
    : DEFAULT_ALLOWED_ORIGINS;

  return rawOrigins.map(normalizeOrigin).filter(Boolean);
}

export function createApp(dependencies = {}) {
  const app = express();
  const allowedOrigins = getAllowedOrigins();

  app.use(
    cors({
      origin:
        allowedOrigins.includes("*") || allowedOrigins.length === 0
          ? true
          : allowedOrigins,
      allowedHeaders: ["Authorization", "Content-Type"],
      methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    }),
  );
  app.use(express.json({ limit: "1mb" }));

  if (dependencies.userStoreRepository) {
    app.locals.userStoreRepository = dependencies.userStoreRepository;
  }

  if (dependencies.verifyIdToken) {
    app.locals.verifyIdToken = dependencies.verifyIdToken;
  }

  if (dependencies.syncAuthProfile) {
    app.locals.syncAuthProfile = dependencies.syncAuthProfile;
  }

  app.get(["/", "/health"], (_req, res) => {
    res.json({ ok: true });
  });
  app.use("/api", apiRoutes);
  app.use((_req, res) => {
    res.status(404).json({ error: "Not found." });
  });
  app.use(errorHandler);

  return app;
}

export function startServer(port = PORT, dependencies) {
  const app = createApp(dependencies);

  return app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer();
}

export default createApp();
