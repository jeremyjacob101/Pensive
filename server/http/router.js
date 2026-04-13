import { HttpError, errorHandler } from "./errors.js";

const BODYLESS_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function compilePath(pathname) {
  const paramNames = [];
  const segments = pathname.split("/").filter(Boolean);
  const pattern =
    segments.length === 0
      ? "/"
      : `/${segments
          .map((segment) => {
            if (segment.startsWith(":")) {
              paramNames.push(segment.slice(1));
              return "([^/]+)";
            }

            return escapeRegExp(segment);
          })
          .join("/")}`;

  return {
    paramNames,
    regex: new RegExp(`^${pattern}$`),
  };
}

function buildQuery(searchParams) {
  const query = {};

  for (const [key, value] of searchParams.entries()) {
    if (!(key in query)) {
      query[key] = value;
      continue;
    }

    query[key] = Array.isArray(query[key])
      ? [...query[key], value]
      : [query[key], value];
  }

  return query;
}

async function readRequestBody(nodeRequest) {
  if (BODYLESS_METHODS.has(nodeRequest.method ?? "GET")) {
    return {};
  }

  const contentType = String(nodeRequest.headers["content-type"] ?? "");
  const chunks = [];

  for await (const chunk of nodeRequest) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (chunks.length === 0) {
    return {};
  }

  const rawBody = Buffer.concat(chunks).toString("utf8");

  if (!contentType.includes("application/json")) {
    return {};
  }

  try {
    return JSON.parse(rawBody);
  } catch (error) {
    throw new HttpError(400, "Invalid JSON body.");
  }
}

function createResponse(nodeResponse) {
  let statusCode = 200;

  return {
    get headersSent() {
      return nodeResponse.headersSent;
    },
    status(nextStatusCode) {
      statusCode = nextStatusCode;
      return this;
    },
    setHeader(name, value) {
      nodeResponse.setHeader(name, value);
      return this;
    },
    json(payload) {
      if (nodeResponse.writableEnded) {
        return this;
      }

      nodeResponse.statusCode = statusCode;

      if (!nodeResponse.getHeader("Content-Type")) {
        nodeResponse.setHeader(
          "Content-Type",
          "application/json; charset=utf-8",
        );
      }

      nodeResponse.end(JSON.stringify(payload));
      return this;
    },
    end(payload = "") {
      if (nodeResponse.writableEnded) {
        return this;
      }

      nodeResponse.statusCode = statusCode;
      nodeResponse.end(payload);
      return this;
    },
  };
}

async function runHandlers(handlers, request, response) {
  for (const handler of handlers) {
    if (response.headersSent) {
      return;
    }

    let nextCalled = false;
    let nextError = null;
    const next = (error) => {
      nextCalled = true;
      nextError = error ?? null;
    };

    await handler(request, response, next);

    if (nextError) {
      throw nextError;
    }

    if (!nextCalled) {
      return;
    }
  }
}

export function createRouter() {
  const middlewares = [];
  const routes = [];

  function addRoute(method, pathname, handler) {
    const { regex, paramNames } = compilePath(pathname);
    routes.push({
      handler,
      method,
      paramNames,
      pathname,
      regex,
    });
  }

  return {
    use(handler) {
      middlewares.push(handler);
      return this;
    },
    get(pathname, handler) {
      addRoute("GET", pathname, handler);
      return this;
    },
    post(pathname, handler) {
      addRoute("POST", pathname, handler);
      return this;
    },
    put(pathname, handler) {
      addRoute("PUT", pathname, handler);
      return this;
    },
    delete(pathname, handler) {
      addRoute("DELETE", pathname, handler);
      return this;
    },
    async handle(nodeRequest, nodeResponse, app, options = {}) {
      const basePath = options.basePath ?? "";
      const requestUrl = new URL(nodeRequest.url ?? "/", "http://127.0.0.1");
      const pathname = basePath
        ? requestUrl.pathname.startsWith(basePath)
          ? requestUrl.pathname.slice(basePath.length) || "/"
          : requestUrl.pathname
        : requestUrl.pathname;
      const route = routes.find(
        (candidate) =>
          candidate.method === (nodeRequest.method ?? "GET") &&
          candidate.regex.test(pathname),
      );
      const response = createResponse(nodeResponse);

      if (!route) {
        response.status(404).json({ error: "Not found." });
        return;
      }

      const match = pathname.match(route.regex);
      const params = Object.fromEntries(
        route.paramNames.map((name, index) => [
          name,
          decodeURIComponent(match?.[index + 1] ?? ""),
        ]),
      );

      const request = {
        app,
        body: await readRequestBody(nodeRequest),
        headers: nodeRequest.headers,
        method: nodeRequest.method ?? "GET",
        params,
        path: pathname,
        query: buildQuery(requestUrl.searchParams),
        raw: nodeRequest,
        url: nodeRequest.url ?? pathname,
      };

      try {
        await runHandlers([...middlewares, route.handler], request, response);

        if (!response.headersSent) {
          response.status(204).end();
        }
      } catch (error) {
        errorHandler(error, request, response);
      }
    },
  };
}
