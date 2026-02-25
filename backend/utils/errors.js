class AppError extends Error {
    constructor(message, statusCode, code) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

class ValidationError extends AppError {
    constructor(message) {
        super(message, 400, 'VALIDATION_ERROR');
    }
}

class NotFoundError extends AppError {
    constructor(message) {
        super(message, 404, 'NOT_FOUND');
    }
}

class ServiceUnavailableError extends AppError {
    constructor(message) {
        super(message, 503, 'SERVICE_UNAVAILABLE');
    }
}

class RateLimitError extends AppError {
    constructor(message) {
        super(message, 429, 'RATE_LIMIT_EXCEEDED');
    }
}

module.exports = {
    AppError,
    ValidationError,
    NotFoundError,
    ServiceUnavailableError,
    RateLimitError
};
