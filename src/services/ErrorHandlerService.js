import { logError, logWithCheckpoint } from "../utils/logger.js";
import { DatabaseError } from "../utils/DatabaseError.js";

/**
 * Enhanced Error Handler Service with severity levels, categories, and monitoring
 */
class ErrorHandlerService {
  constructor() {
    this.severityLevels = {
      debug: 0,
      info: 1,
      warning: 2,
      error: 3,
      critical: 4,
      fatal: 5,
    };

    this.errorCategories = {
      DATABASE: "database",
      NETWORK: "network",
      VALIDATION: "validation",
      AUTHENTICATION: "authentication",
      AUTHORIZATION: "authorization",
      BUSINESS_LOGIC: "business_logic",
      EXTERNAL_API: "external_api",
      SYSTEM: "system",
    };
  }

  /**
   * Handle error with enhanced context and severity
   * @param {Error|DatabaseError} error - The error to handle
   * @param {object} context - Additional context
   * @param {object} options - Handler options
   */
  handleError(error, context = {}, options = {}) {
    const {
      operation = "unknown",
      category = this.errorCategories.SYSTEM,
      severity = "error",
      checkpoint = null,
      retryable = false,
      shouldLog = true,
      shouldAlert = false,
    } = options;

    // Enhance error with context
    const enhancedError = this.enhanceError(error, {
      operation,
      category,
      severity,
      retryable,
      ...context,
    });

    // Log the error
    if (shouldLog) {
      this.logError(enhancedError, checkpoint);
    }

    // Send to external monitoring if critical
    if (shouldAlert || this.isCriticalSeverity(severity)) {
      this.sendToMonitoring(enhancedError);
    }

    return enhancedError;
  }

  /**
   * Enhance error with additional context
   * @param {Error} error - Original error
   * @param {object} context - Additional context
   * @returns {DatabaseError} Enhanced error
   */
  enhanceError(error, context = {}) {
    if (error instanceof DatabaseError) {
      // Merge context with existing error
      return new DatabaseError(error.message, {
        ...error,
        ...context,
      });
    }

    // Create new DatabaseError from regular Error
    return new DatabaseError(error.message, {
      code: error.code || "UNKNOWN_ERROR",
      severity: context.severity || "error",
      operation: context.operation || "unknown",
      context: {
        originalError: error.name,
        stack: error.stack,
        ...context,
      },
      retryable: context.retryable || false,
    });
  }

  /**
   * Log error with appropriate level and format
   * @param {DatabaseError} error - Error to log
   * @param {string} checkpoint - Optional checkpoint
   */
  logError(error, checkpoint = null) {
    const logData = {
      ...error.toLogFormat(),
      checkpoint: checkpoint || `ERROR_${Date.now()}`,
    };

    // Use appropriate log level based on severity
    switch (error.getSeverity()) {
      case "debug":
        console.debug("🐛", logData);
        break;
      case "info":
        console.info("ℹ️", logData);
        break;
      case "warning":
        console.warn("⚠️", logData);
        break;
      case "error":
        logError(error, logData);
        break;
      case "critical":
        console.error("🚨 CRITICAL:", logData);
        logError(error, logData);
        break;
      case "fatal":
        console.error("💀 FATAL:", logData);
        logError(error, logData);
        break;
      default:
        logError(error, logData);
    }
  }

  /**
   * Send error to external monitoring service
   * @param {DatabaseError} error - Error to send
   */
  sendToMonitoring(error) {
    // TODO: Integrate with external monitoring (Sentry, Logtail, Datadog)
    // Example for Sentry:
    // captureException(error, {
    //   tags: {
    //     operation: error.getOperation(),
    //     category: error.category,
    //     severity: error.getSeverity(),
    //   },
    //   extra: error.context,
    // });

    // For now, just log to console with special format
    console.error("📊 MONITORING ALERT:", {
      timestamp: new Date().toISOString(),
      error: error.toLogFormat(),
      alertLevel: "HIGH",
    });
  }

  /**
   * Check if severity level is critical
   * @param {string} severity - Severity level
   * @returns {boolean}
   */
  isCriticalSeverity(severity) {
    return this.severityLevels[severity] >= this.severityLevels.critical;
  }

  /**
   * Handle database-specific errors
   * @param {Error} error - Database error
   * @param {object} context - Additional context
   * @returns {DatabaseError}
   */
  handleDatabaseError(error, context = {}) {
    let severity = "error";
    let retryable = false;
    let code = "DB_ERROR";

    // Categorize MongoDB errors
    if (error.name === "MongoNetworkError") {
      severity = "critical";
      retryable = true;
      code = "DB_NETWORK_ERROR";
    } else if (error.name === "MongoTimeoutError") {
      severity = "warning";
      retryable = true;
      code = "DB_TIMEOUT_ERROR";
    } else if (error.name === "MongoServerError") {
      severity = "error";
      retryable = false;
      code = "DB_SERVER_ERROR";
    } else if (error.name === "MongoParseError") {
      severity = "error";
      retryable = false;
      code = "DB_PARSE_ERROR";
    }

    return this.handleError(error, context, {
      operation: context.operation || "database_operation",
      category: this.errorCategories.DATABASE,
      severity,
      retryable,
      shouldAlert: severity === "critical",
    });
  }

  /**
   * Create success checkpoint
   * @param {string} message - Success message
   * @param {string} checkpoint - Checkpoint ID
   * @param {object} data - Additional data
   */
  logSuccess(message, checkpoint, data = {}) {
    logWithCheckpoint("info", message, checkpoint, data);
  }

  /**
   * Create warning checkpoint
   * @param {string} message - Warning message
   * @param {string} checkpoint - Checkpoint ID
   * @param {object} data - Additional data
   */
  logWarning(message, checkpoint, data = {}) {
    logWithCheckpoint("warn", message, checkpoint, data);
  }
}

// Create singleton instance
const errorHandler = new ErrorHandlerService();

export default errorHandler;
