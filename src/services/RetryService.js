import errorHandler from "./ErrorHandlerService.js";

/**
 * Smart Retry Service with exponential backoff and jitter
 */
class RetryService {
  constructor() {
    this.defaultOptions = {
      maxRetries: 3,
      baseDelay: 1000, // 1 second
      maxDelay: 30000, // 30 seconds
      backoffMultiplier: 2,
      jitter: true,
      retryableErrors: [
        "MongoNetworkError",
        "MongoTimeoutError",
        "ECONNREFUSED",
        "ETIMEDOUT",
        "ENOTFOUND",
      ],
    };
  }

  /**
   * Execute function with retry logic
   * @param {Function} fn - Function to execute
   * @param {object} options - Retry options
   * @param {object} context - Context for error handling
   * @returns {Promise<any>} Function result
   */
  async executeWithRetry(fn, options = {}, context = {}) {
    const config = { ...this.defaultOptions, ...options };
    let lastError;

    for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
      try {
        const result = await fn();

        // Log success on retry
        if (attempt > 0) {
          errorHandler.logSuccess(
            `Operation succeeded after ${attempt} retries`,
            `RETRY_SUCCESS_${Date.now()}`,
            { attempt, operation: context.operation }
          );
        }

        return result;
      } catch (error) {
        lastError = error;

        // Check if error is retryable
        if (!this.isRetryableError(error, config.retryableErrors)) {
          throw errorHandler.handleError(error, context, {
            operation: context.operation || "retry_operation",
            severity: "error",
            retryable: false,
          });
        }

        // Check if we've exhausted retries
        if (attempt === config.maxRetries) {
          throw errorHandler.handleError(error, context, {
            operation: context.operation || "retry_operation",
            severity: "critical",
            retryable: false,
            shouldAlert: true,
          });
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, config);

        errorHandler.logWarning(
          `Operation failed, retrying in ${delay}ms (attempt ${attempt + 1}/${
            config.maxRetries + 1
          })`,
          `RETRY_ATTEMPT_${Date.now()}`,
          {
            attempt: attempt + 1,
            maxRetries: config.maxRetries + 1,
            delay,
            error: error.message,
            operation: context.operation,
          }
        );

        // Wait before retry
        await this.sleep(delay);
      }
    }

    throw lastError;
  }

  /**
   * Check if error is retryable
   * @param {Error} error - Error to check
   * @param {Array} retryableErrors - List of retryable error types
   * @returns {boolean}
   */
  isRetryableError(
    error,
    retryableErrors = this.defaultOptions.retryableErrors
  ) {
    // Check error name
    if (retryableErrors.includes(error.name)) {
      return true;
    }

    // Check error code
    if (error.code && retryableErrors.includes(error.code)) {
      return true;
    }

    // Check error message for common retryable patterns
    const retryablePatterns = [
      "ECONNREFUSED",
      "ETIMEDOUT",
      "ENOTFOUND",
      "network",
      "timeout",
      "connection",
    ];

    return retryablePatterns.some((pattern) =>
      error.message.toLowerCase().includes(pattern.toLowerCase())
    );
  }

  /**
   * Calculate delay with exponential backoff and jitter
   * @param {number} attempt - Current attempt number
   * @param {object} config - Retry configuration
   * @returns {number} Delay in milliseconds
   */
  calculateDelay(attempt, config) {
    // Exponential backoff: baseDelay * (backoffMultiplier ^ attempt)
    let delay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);

    // Cap at maxDelay
    delay = Math.min(delay, config.maxDelay);

    // Add jitter to prevent thundering herd
    if (config.jitter) {
      // Add random jitter: ±25% of the delay
      const jitterRange = delay * 0.25;
      delay += (Math.random() * 2 - 1) * jitterRange;
    }

    return Math.max(0, Math.floor(delay));
  }

  /**
   * Sleep for specified milliseconds
   * @param {number} ms - Milliseconds to sleep
   * @returns {Promise<void>}
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Create retry wrapper for database operations
   * @param {Function} dbOperation - Database operation function
   * @param {object} options - Retry options
   * @returns {Function} Wrapped function with retry logic
   */
  wrapDatabaseOperation(dbOperation, options = {}) {
    return async (...args) => {
      return this.executeWithRetry(
        () => dbOperation(...args),
        {
          ...options,
          retryableErrors: [
            ...this.defaultOptions.retryableErrors,
            "MongoNetworkError",
            "MongoTimeoutError",
            "MongoServerSelectionError",
          ],
        },
        {
          operation: dbOperation.name || "database_operation",
          category: "database",
        }
      );
    };
  }

  /**
   * Create retry wrapper for network operations
   * @param {Function} networkOperation - Network operation function
   * @param {object} options - Retry options
   * @returns {Function} Wrapped function with retry logic
   */
  wrapNetworkOperation(networkOperation, options = {}) {
    return async (...args) => {
      return this.executeWithRetry(
        () => networkOperation(...args),
        {
          ...options,
          retryableErrors: [
            ...this.defaultOptions.retryableErrors,
            "ECONNREFUSED",
            "ETIMEDOUT",
            "ENOTFOUND",
            "ECONNRESET",
          ],
        },
        {
          operation: networkOperation.name || "network_operation",
          category: "network",
        }
      );
    };
  }
}

// Create singleton instance
const retryService = new RetryService();

export default retryService;
