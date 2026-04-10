import cors from "cors";
import express from "express";
import { fileURLToPath } from "url";
import { PORT } from "./config/constants.js";
import { errorHandler } from "./http/errors.js";
import apiRoutes from "./routes/api.js";
import { getUserStoreRepository } from "./storage/userStore.js";

export function createApp(dependencies = {}) {
  const app = express();

  app.locals.userStoreRepository =
    dependencies.userStoreRepository ?? getUserStoreRepository();

  if (dependencies.verifyIdToken) {
    app.locals.verifyIdToken = dependencies.verifyIdToken;
  }

  if (dependencies.syncAuthProfile) {
    app.locals.syncAuthProfile = dependencies.syncAuthProfile;
  }

  app.use(cors());
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.use("/api", apiRoutes);
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
