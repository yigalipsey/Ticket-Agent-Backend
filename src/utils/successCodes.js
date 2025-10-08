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
  LEAGUE_FIXTURES_FETCHED: {
    code: "LEAGUE_FIXTURES_FETCHED",
    message: "League fixtures fetched successfully",
    statusCode: 200,
  },
  TEAM_FIXTURES_FETCHED: {
    code: "TEAM_FIXTURES_FETCHED",
    message: "Team fixtures fetched successfully",
    statusCode: 200,
  },
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
