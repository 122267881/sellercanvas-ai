class ApiError extends Error {
  constructor(message = "API error", options = {}) {
    const {
      statusCode = 500,
      code = "API_ERROR",
      details,
      expose = statusCode < 500,
      cause
    } = options;

    super(message, cause ? { cause } : undefined);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.expose = expose;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.expose ? this.message : "Internal server error",
        details: this.details
      }
    };
  }
}

class BadRequestError extends ApiError {
  constructor(message = "Bad request", options = {}) {
    super(message, { statusCode: 400, code: "BAD_REQUEST", ...options });
  }
}

class UnauthorizedError extends ApiError {
  constructor(message = "Unauthorized", options = {}) {
    super(message, { statusCode: 401, code: "UNAUTHORIZED", ...options });
  }
}

class ForbiddenError extends ApiError {
  constructor(message = "Forbidden", options = {}) {
    super(message, { statusCode: 403, code: "FORBIDDEN", ...options });
  }
}

class ConflictError extends ApiError {
  constructor(message = "Conflict", options = {}) {
    super(message, { statusCode: 409, code: "CONFLICT", ...options });
  }
}

class PaymentRequiredError extends ApiError {
  constructor(message = "Payment required", options = {}) {
    super(message, { statusCode: 402, code: "PAYMENT_REQUIRED", ...options });
  }
}

class InternalError extends ApiError {
  constructor(message = "Internal server error", options = {}) {
    super(message, { statusCode: 500, code: "INTERNAL_ERROR", expose: false, ...options });
  }
}

module.exports = {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  PaymentRequiredError,
  InternalError
};
