/**
 * Custom Database Error class with enhanced context and severity
 */
export class DatabaseError extends Error {
  constructor(message, options = {}) {
    super(message);

    this.name = "DatabaseError";
    this.code = options.code || "DB_ERROR";
    this.severity = options.severity || "error";
    this.operation = options.operation || "unknown";
    this.context = options.context || {};
    this.retryable = options.retryable || false;
    this.timestamp = new Date().toISOString();

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DatabaseError);
    }
  }

  /**
   * Convert error to structured log format
   * @returns {object} Structured error data
   */
  toLogFormat() {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      severity: this.severity,
      operation: this.operation,
      context: this.context,
      retryable: this.retryable,
      timestamp: this.timestamp,
      stack: this.stack,
    };
  }

  /**
   * Check if error is retryable
   * @returns {boolean}
   */
  isRetryable() {
    return this.retryable;
  }

  /**
   * Get error severity level
   * @returns {string}
   */
  getSeverity() {
    return this.severity;
  }

  /**
   * Get operation context
   * @returns {string}
   */
  getOperation() {
    return this.operation;
  }
}

/**
 * Specific error types for different database operations
 */
export class ConnectionError extends DatabaseError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: "DB_CONNECTION_ERROR",
      severity: "critical",
      retryable: true,
    });
    this.name = "ConnectionError";
  }
}

export class QueryError extends DatabaseError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: "DB_QUERY_ERROR",
      severity: "error",
      retryable: false,
    });
    this.name = "QueryError";
  }
}

export class TimeoutError extends DatabaseError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: "DB_TIMEOUT_ERROR",
      severity: "warning",
      retryable: true,
    });
    this.name = "TimeoutError";
  }
}

export class NetworkError extends DatabaseError {
  constructor(message, options = {}) {
    super(message, {
      ...options,
      code: "DB_NETWORK_ERROR",
      severity: "critical",
      retryable: true,
    });
    this.name = "NetworkError";
  }
}
