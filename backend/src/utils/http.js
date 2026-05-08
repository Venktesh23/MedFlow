export function sendSuccess(res, data = null, status = 200) {
  return res.status(status).json({
    success: true,
    data,
    error: null,
  });
}

export function sendError(res, status, error) {
  const normalizedError =
    typeof error === "string"
      ? { code: "REQUEST_ERROR", message: error }
      : {
          code: error?.code || "REQUEST_ERROR",
          message: error?.message || "Request failed.",
          details: error?.details,
        };

  return res.status(status).json({
    success: false,
    data: null,
    error: normalizedError,
  });
}

export function asyncHandler(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}
