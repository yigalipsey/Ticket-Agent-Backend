import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { logWithCheckpoint, logError } from "../utils/logger.js";
import { createErrorResponse, ERROR_CODES } from "../utils/errorCodes.js";
import { getUserSessionConfig, sessionConfig } from "../config/session.js";

// Middleware to verify JWT token for users
export const authenticateUserToken = async (req, res, next) => {
  try {
    logWithCheckpoint("info", "Starting token authentication", "AUTH_001");

    // Try to get token from user cookie first, then agent cookie
    const { cookieName: userCookieName } = getUserSessionConfig();
    let token = req.cookies[userCookieName];

    // If no user token, try agent token
    if (!token) {
      token = req.cookies.agent_auth_token;
    }

    if (!token) {
      logWithCheckpoint("warn", "No token provided", "AUTH_002");
      if (process.env.NODE_ENV === "production") {
        const diagnostics = {
          route: req.originalUrl,
          reason: "missing_token",
          nodeEnv: process.env.NODE_ENV,
          origin: req.headers.origin,
          referer: req.headers.referer,
          host: req.headers.host,
          hostname: req.hostname,
          protocol: req.protocol,
          xfp: req.headers["x-forwarded-proto"],
          xfh: req.headers["x-forwarded-host"],
          cookieNames: Object.keys(req.cookies || {}),
          hasUserCookie: !!req.cookies?.[userCookieName],
          hasAgentCookie: !!req.cookies?.agent_auth_token,
          userCookieLen: req.cookies?.[userCookieName]?.length || 0,
          agentCookieLen: req.cookies?.agent_auth_token?.length || 0,
          expectedCookieName: userCookieName,
          expectedCookieOptions: sessionConfig.cookieOptions,
          frontendUrlEnv: process.env.FRONTEND_URL,
        };
        console.error(
          "\x1b[31m%s\x1b[0m",
          `AUTH_401 | ${JSON.stringify(diagnostics)}`
        );
      }
      return res.status(401).json({ message: "Missing authentication token" });
    }

    logWithCheckpoint("debug", "Token received from cookie", "AUTH_001.5", {
      tokenLength: token.length,
      tokenStart: token.substring(0, 10),
    });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;

    logWithCheckpoint("info", "Token authentication successful", "AUTH_006", {
      userId: decoded.userId,
      role: decoded.role,
    });

    next();
  } catch (err) {
    logError(err, { operation: "authenticateToken" });

    logWithCheckpoint("error", "Token verification failed", "AUTH_ERROR", {
      errorName: err.name,
      errorMessage: err.message,
    });

    if (process.env.NODE_ENV === "production") {
      const { cookieName: userCookieName } = getUserSessionConfig();
      const diagnostics = {
        route: req.originalUrl,
        reason: "token_verification_failed",
        errorName: err.name,
        errorMessage: err.message,
        nodeEnv: process.env.NODE_ENV,
        origin: req.headers.origin,
        referer: req.headers.referer,
        host: req.headers.host,
        hostname: req.hostname,
        protocol: req.protocol,
        xfp: req.headers["x-forwarded-proto"],
        xfh: req.headers["x-forwarded-host"],
        cookieNames: Object.keys(req.cookies || {}),
        hasUserCookie: !!req.cookies?.[userCookieName],
        hasAgentCookie: !!req.cookies?.agent_auth_token,
        userCookieLen: req.cookies?.[userCookieName]?.length || 0,
        agentCookieLen: req.cookies?.agent_auth_token?.length || 0,
        expectedCookieName: userCookieName,
        expectedCookieOptions: sessionConfig.cookieOptions,
        frontendUrlEnv: process.env.FRONTEND_URL,
      };
      console.error(
        "\x1b[31m%s\x1b[0m",
        `AUTH_401 | ${JSON.stringify(diagnostics)}`
      );
    }

    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

// Role hierarchy: super-admin > admin > agent > user
const roleHierarchy = {
  "super-admin": 4,
  admin: 3,
  agent: 2,
  user: 1,
};

// Middleware to check if user has specific role or higher
export const requireRole = (roles) => {
  return (req, res, next) => {
    try {
      logWithCheckpoint("info", "Checking user role", "AUTH_007", {
        requiredRoles: roles,
        userRole: req.user?.role,
      });

      if (!req.user) {
        return res.status(401).json(createErrorResponse("AUTH_TOKEN_REQUIRED"));
      }

      const userRoles = Array.isArray(roles) ? roles : [roles];
      const userRoleLevel = roleHierarchy[req.user.role] || 0;

      // Check if user has any of the required roles or higher
      const hasPermission = userRoles.some((role) => {
        const requiredLevel = roleHierarchy[role] || 0;
        return userRoleLevel >= requiredLevel;
      });

      if (!hasPermission) {
        logWithCheckpoint("warn", "Insufficient permissions", "AUTH_008", {
          userRole: req.user.role,
          userRoleLevel,
          requiredRoles: userRoles,
        });
        return res.status(403).json(
          createErrorResponse("AUTH_INSUFFICIENT_PERMISSIONS", {
            currentRole: req.user.role,
            currentLevel: userRoleLevel,
            requiredRoles: userRoles,
            requiredLevels: userRoles.map((role) => roleHierarchy[role] || 0),
          })
        );
      }

      logWithCheckpoint("info", "Role check passed", "AUTH_009", {
        userRole: req.user.role,
        userRoleLevel,
      });
      next();
    } catch (error) {
      logError(error, { operation: "requireRole" });
      res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
    }
  };
};

// Middleware to check if user has exact role (no hierarchy)
export const requireExactRole = (roles) => {
  return (req, res, next) => {
    try {
      logWithCheckpoint("info", "Checking exact user role", "AUTH_010", {
        requiredRoles: roles,
        userRole: req.user?.role,
      });

      if (!req.user) {
        return res.status(401).json(createErrorResponse("AUTH_TOKEN_REQUIRED"));
      }

      const userRoles = Array.isArray(roles) ? roles : [roles];

      if (!userRoles.includes(req.user.role)) {
        logWithCheckpoint("warn", "Insufficient permissions", "AUTH_011", {
          userRole: req.user.role,
          requiredRoles: userRoles,
        });
        return res.status(403).json(
          createErrorResponse("AUTH_INSUFFICIENT_PERMISSIONS", {
            currentRole: req.user.role,
            requiredRoles: userRoles,
            note: "Exact role match required (no hierarchy)",
          })
        );
      }

      logWithCheckpoint("info", "Exact role check passed", "AUTH_012", {
        userRole: req.user.role,
      });
      next();
    } catch (error) {
      logError(error, { operation: "requireExactRole" });
      res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
    }
  };
};

// Middleware to validate request body
export const validateRequest = (schema) => {
  return (req, res, next) => {
    try {
      logWithCheckpoint("info", "Validating request body", "AUTH_010");

      const { error } = schema.validate(req.body);

      if (error) {
        logWithCheckpoint("warn", "Validation failed", "AUTH_011", {
          error: error.details[0].message,
        });
        return res.status(400).json({
          success: false,
          error: "Validation failed",
          details: error.details[0].message,
        });
      }

      logWithCheckpoint("info", "Request validation passed", "AUTH_012");
      next();
    } catch (error) {
      logError(error, { operation: "validateRequest" });
      res.status(500).json({
        success: false,
        error: "Request validation failed",
      });
    }
  };
};

// Alias for authenticateUserToken
export const auth = authenticateUserToken;
export const authenticateToken = authenticateUserToken; // Legacy alias

// Middleware to rate limit requests
export const rateLimit = (maxRequests = 200, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    try {
      // Skip rate limiting in development mode
      if (
        process.env.NODE_ENV === "development" ||
        process.env.NODE_ENV !== "production"
      ) {
        return next();
      }

      const clientId = req.ip || req.connection.remoteAddress;
      const now = Date.now();
      const windowStart = now - windowMs;

      // Clean old entries
      for (const [key, timestamp] of requests.entries()) {
        if (timestamp < windowStart) {
          requests.delete(key);
        }
      }

      // Check current requests
      const clientRequests = Array.from(requests.entries()).filter(
        ([key, timestamp]) =>
          key.startsWith(clientId) && timestamp > windowStart
      );

      if (clientRequests.length >= maxRequests) {
        logWithCheckpoint("warn", "Rate limit exceeded", "AUTH_013", {
          clientId,
          requests: clientRequests.length,
          maxRequests,
        });
        return res.status(429).json(
          createErrorResponse("RATE_LIMIT_EXCEEDED", {
            retryAfter: Math.ceil(windowMs / 1000),
            maxRequests,
            windowMs,
          })
        );
      }

      // Add current request
      requests.set(`${clientId}-${now}`, now);

      logWithCheckpoint("debug", "Rate limit check passed", "AUTH_014", {
        clientId,
      });
      next();
    } catch (error) {
      logError(error, { operation: "rateLimit" });
      next(); // Continue on error to avoid blocking
    }
  };
};
