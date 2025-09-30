// Success codes and messages for consistent API responses
export const SUCCESS_CODES = {
  // General Success
  SUCCESS: {
    code: "SUCCESS",
    message: "Operation completed successfully",
    statusCode: 200,
  },
  CREATED: {
    code: "CREATED",
    message: "Resource created successfully",
    statusCode: 201,
  },
  UPDATED: {
    code: "UPDATED",
    message: "Resource updated successfully",
    statusCode: 200,
  },
  DELETED: {
    code: "DELETED",
    message: "Resource deleted successfully",
    statusCode: 200,
  },

  // Authentication Success
  LOGIN_SUCCESS: {
    code: "LOGIN_SUCCESS",
    message: "Login successful",
    statusCode: 200,
  },
  LOGOUT_SUCCESS: {
    code: "LOGOUT_SUCCESS",
    message: "Logout successful",
    statusCode: 200,
  },
  REGISTRATION_SUCCESS: {
    code: "REGISTRATION_SUCCESS",
    message: "Registration successful",
    statusCode: 201,
  },
  TOKEN_REFRESHED: {
    code: "TOKEN_REFRESHED",
    message: "Token refreshed successfully",
    statusCode: 200,
  },

  // Resource Operations
  USER_CREATED: {
    code: "USER_CREATED",
    message: "User created successfully",
    statusCode: 201,
  },
  USER_UPDATED: {
    code: "USER_UPDATED",
    message: "User updated successfully",
    statusCode: 200,
  },
  USER_ACTIVATED: {
    code: "USER_ACTIVATED",
    message: "User activated successfully",
    statusCode: 200,
  },
  USER_DEACTIVATED: {
    code: "USER_DEACTIVATED",
    message: "User deactivated successfully",
    statusCode: 200,
  },

  AGENT_CREATED: {
    code: "AGENT_CREATED",
    message: "Agent created successfully",
    statusCode: 201,
  },
  AGENT_UPDATED: {
    code: "AGENT_UPDATED",
    message: "Agent updated successfully",
    statusCode: 200,
  },
  AGENT_ACTIVATED: {
    code: "AGENT_ACTIVATED",
    message: "Agent activated successfully",
    statusCode: 200,
  },
  AGENT_DEACTIVATED: {
    code: "AGENT_DEACTIVATED",
    message: "Agent deactivated successfully",
    statusCode: 200,
  },

  OFFER_CREATED: {
    code: "OFFER_CREATED",
    message: "Offer created successfully",
    statusCode: 201,
  },
  OFFERS_FETCHED: {
    code: "OFFERS_FETCHED",
    message: "Offers fetched successfully",
    statusCode: 200,
  },
  OFFER_UPDATED: {
    code: "OFFER_UPDATED",
    message: "Offer updated successfully",
    statusCode: 200,
  },
  OFFER_DELETED: {
    code: "OFFER_DELETED",
    message: "Offer deleted successfully",
    statusCode: 200,
  },
  OFFER_TOGGLED: {
    code: "OFFER_TOGGLED",
    message: "Offer availability toggled successfully",
    statusCode: 200,
  },

  FIXTURE_SYNCED: {
    code: "FIXTURE_SYNCED",
    message: "Fixture synced successfully",
    statusCode: 200,
  },
  TEAM_SYNCED: {
    code: "TEAM_SYNCED",
    message: "Team synced successfully",
    statusCode: 200,
  },
  VENUE_SYNCED: {
    code: "VENUE_SYNCED",
    message: "Venue synced successfully",
    statusCode: 200,
  },
  LEAGUE_SYNCED: {
    code: "LEAGUE_SYNCED",
    message: "League synced successfully",
    statusCode: 200,
  },
};

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
  TEAM_FIXTURES_FETCHED: {
    code: "TEAM_FIXTURES_FETCHED",
    message: "Team fixtures fetched successfully",
    statusCode: 200,
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
  LEAGUE_FIXTURES_FETCHED: {
    code: "LEAGUE_FIXTURES_FETCHED",
    message: "League fixtures fetched successfully",
    statusCode: 200,
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
      },
    };
  }

  const response = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
    },
  };

  if (details) {
    response.error.details = details;
  }

  return response;
};

// Helper function to create success response
export const createSuccessResponse = (
  data,
  successCode = "SUCCESS",
  customMessage = null
) => {
  const success = SUCCESS_CODES[successCode];
  if (!success) {
    return {
      success: true,
      data,
      message: customMessage || "Operation completed successfully",
    };
  }

  const response = {
    success: true,
    code: success.code,
    message: customMessage || success.message,
    data,
  };

  return response;
};
