// Error codes and messages for consistent API responses
export const ERROR_CODES = {
  // Authentication & Authorization
  AUTH_INVALID_CREDENTIALS: {
    code: "AUTH_INVALID_CREDENTIALS",
    message: "Invalid credentials",
    statusCode: 401,
  },
  AUTH_TOKEN_REQUIRED: {
    code: "AUTH_TOKEN_REQUIRED",
    message: "Access token required",
    statusCode: 401,
  },
  AUTH_TOKEN_INVALID: {
    code: "AUTH_TOKEN_INVALID",
    message: "Invalid token",
    statusCode: 401,
  },
  AUTH_TOKEN_EXPIRED: {
    code: "AUTH_TOKEN_EXPIRED",
    message: "Token expired",
    statusCode: 401,
  },
  AUTH_INSUFFICIENT_PERMISSIONS: {
    code: "AUTH_INSUFFICIENT_PERMISSIONS",
    message: "Insufficient permissions",
    statusCode: 403,
  },
  AUTH_AGENT_ID_REQUIRED: {
    code: "AUTH_AGENT_ID_REQUIRED",
    message: "User must be linked to an agent",
    statusCode: 400,
  },
  AUTH_ACCOUNT_DEACTIVATED: {
    code: "AUTH_ACCOUNT_DEACTIVATED",
    message: "Account is deactivated",
    statusCode: 401,
  },
  AUTH_TOKEN_VERSION_MISMATCH: {
    code: "AUTH_TOKEN_VERSION_MISMATCH",
    message: "Invalid token version",
    statusCode: 401,
  },

  // Validation
  VALIDATION_FAILED: {
    code: "VALIDATION_FAILED",
    message: "Validation failed",
    statusCode: 400,
  },
  VALIDATION_MISSING_FIELDS: {
    code: "VALIDATION_MISSING_FIELDS",
    message: "Missing required fields",
    statusCode: 400,
  },
  VALIDATION_INVALID_FORMAT: {
    code: "VALIDATION_INVALID_FORMAT",
    message: "Invalid format",
    statusCode: 400,
  },

  // Resource Management
  RESOURCE_NOT_FOUND: {
    code: "RESOURCE_NOT_FOUND",
    message: "Resource not found",
    statusCode: 404,
  },
  RESOURCE_ALREADY_EXISTS: {
    code: "RESOURCE_ALREADY_EXISTS",
    message: "Resource already exists",
    statusCode: 409,
  },
  RESOURCE_CONFLICT: {
    code: "RESOURCE_CONFLICT",
    message: "Resource conflict",
    statusCode: 409,
  },

  // Rate Limiting
  RATE_LIMIT_EXCEEDED: {
    code: "RATE_LIMIT_EXCEEDED",
    message: "Too many requests, please try again later",
    statusCode: 429,
  },

  // Server Errors
  INTERNAL_SERVER_ERROR: {
    code: "INTERNAL_SERVER_ERROR",
    message: "Internal server error",
    statusCode: 500,
  },
  DATABASE_ERROR: {
    code: "DATABASE_ERROR",
    message: "Database operation failed",
    statusCode: 500,
  },
  EXTERNAL_API_ERROR: {
    code: "EXTERNAL_API_ERROR",
    message: "External API error",
    statusCode: 502,
  },

  // Specific Entity Errors
  USER_NOT_FOUND: {
    code: "USER_NOT_FOUND",
    message: "User not found",
    statusCode: 404,
  },
  USER_ALREADY_EXISTS: {
    code: "USER_ALREADY_EXISTS",
    message: "User already exists",
    statusCode: 409,
  },
  AGENT_NOT_FOUND: {
    code: "AGENT_NOT_FOUND",
    message: "Agent not found",
    statusCode: 404,
  },
  AGENT_ALREADY_EXISTS: {
    code: "AGENT_ALREADY_EXISTS",
    message: "Agent already exists",
    statusCode: 409,
  },
  AGENT_INACTIVE: {
    code: "AGENT_INACTIVE",
    message: "Agent is inactive",
    statusCode: 403,
  },
  OFFER_NOT_FOUND: {
    code: "OFFER_NOT_FOUND",
    message: "Offer not found",
    statusCode: 404,
  },
  FIXTURE_NOT_FOUND: {
    code: "FIXTURE_NOT_FOUND",
    message: "Fixture not found",
    statusCode: 404,
  },
  TEAM_NOT_FOUND: {
    code: "TEAM_NOT_FOUND",
    message: "Team not found",
    statusCode: 404,
  },
  VENUE_NOT_FOUND: {
    code: "VENUE_NOT_FOUND",
    message: "Venue not found",
    statusCode: 404,
  },
  LEAGUE_NOT_FOUND: {
    code: "LEAGUE_NOT_FOUND",
    message: "League not found",
    statusCode: 404,
  },

  // Validation Errors - Specific
  VALIDATION_INVALID_LEAGUE_ID: {
    code: "VALIDATION_INVALID_LEAGUE_ID",
    message: "Invalid league ID format",
    statusCode: 400,
  },
  VALIDATION_INVALID_TEAM_ID: {
    code: "VALIDATION_INVALID_TEAM_ID",
    message: "Invalid team ID format",
    statusCode: 400,
  },
  VALIDATION_INVALID_MONTH_FORMAT: {
    code: "VALIDATION_INVALID_MONTH_FORMAT",
    message: "Invalid month format. Use YYYY-MM (e.g., 2026-01)",
    statusCode: 400,
  },
  VALIDATION_LEAGUE_ID_REQUIRED: {
    code: "VALIDATION_LEAGUE_ID_REQUIRED",
    message: "leagueId parameter is required",
    statusCode: 400,
  },
  VALIDATION_INVALID_PAGINATION: {
    code: "VALIDATION_INVALID_PAGINATION",
    message: "Invalid pagination parameters",
    statusCode: 400,
  },
};

// Helper function to create error response
export const createErrorResponse = (errorCode, details = null) => {
  const error = ERROR_CODES[errorCode];
  if (!error) {
    return {
      success: false,
      error: {
        code: "UNKNOWN_ERROR",
        message: "Unknown error occurred",
        statusCode: 500,
      },
    };
  }

  const response = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
      statusCode: error.statusCode,
    },
  };

  if (details) {
    response.error.details = details;
  }

  return response;
};
