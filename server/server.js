const cors = require("cors");
const express = require("express");
const { PORT } = require("./config/constants");
const { errorHandler } = require("./http/errors");
const apiRoutes = require("./routes/api");
const { getUserStoreRepository } = require("./storage/userStore");

function createApp(dependencies = {}) {
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

function startServer(port = PORT, dependencies) {
  const app = createApp(dependencies);

  return app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = {
  createApp,
  startServer,
};
