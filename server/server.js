import { createServer } from "http";
import { fileURLToPath } from "url";
import { PORT } from "./config/constants.js";
import apiRoutes from "./routes/api.js";
import { getUserStoreRepository } from "./storage/userStore.js";

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader(
    "Access-Control-Allow-Headers",
    "Authorization, Content-Type",
  );
  response.setHeader(
    "Access-Control-Allow-Methods",
    "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS",
  );
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

export function createApp(dependencies = {}) {
  const app = {
    locals: {},
    async handle(request, response) {
      setCorsHeaders(response);

      if (request.method === "OPTIONS") {
        response.statusCode = 204;
        response.end();
        return;
      }

      const requestUrl = new URL(request.url ?? "/", "http://127.0.0.1");
      const isApiRequest =
        requestUrl.pathname === "/api" ||
        requestUrl.pathname.startsWith("/api/");

      if (requestUrl.pathname === "/health") {
        sendJson(response, 200, { ok: true });
        return;
      }

      if (isApiRequest) {
        await apiRoutes.handle(request, response, app, { basePath: "/api" });
        return;
      }

      sendJson(response, 404, { error: "Not found." });
    },
    listen(port, callback) {
      const server = createServer((request, response) => {
        Promise.resolve(app.handle(request, response)).catch((error) => {
          console.error(error);

          if (!response.headersSent) {
            setCorsHeaders(response);
            sendJson(response, 500, { error: "Internal server error." });
          } else if (!response.writableEnded) {
            response.end();
          }
        });
      });

      return server.listen(port, callback);
    },
  };
  app.locals.userStoreRepository =
    dependencies.userStoreRepository ?? getUserStoreRepository();

  if (dependencies.verifyIdToken) {
    app.locals.verifyIdToken = dependencies.verifyIdToken;
  }

  if (dependencies.syncAuthProfile) {
    app.locals.syncAuthProfile = dependencies.syncAuthProfile;
  }

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
