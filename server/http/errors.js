class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = "HttpError";
    this.status = status;
  }
}

function inferStatus(error) {
  if (error?.status) {
    return error.status;
  }

  if (!(error instanceof Error)) {
    return 500;
  }

  if (/not found/i.test(error.message)) {
    return 404;
  }

  if (/already exists/i.test(error.message)) {
    return 409;
  }

  return 400;
}

function errorHandler(error, _req, res, _next) {
  const status = inferStatus(error);
  const message =
    error instanceof Error && error.message
      ? error.message
      : "Internal server error.";

  res.status(status >= 400 && status < 600 ? status : 500).json({ error: message });
}

function asyncHandler(handler) {
  return function wrappedHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = {
  HttpError,
  asyncHandler,
  errorHandler,
};
