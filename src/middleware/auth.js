import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { logWithCheckpoint, logError } from "../utils/logger.js";
import { createErrorResponse, ERROR_CODES } from "../utils/errorCodes.js";

// Middleware to verify JWT token
export const authenticateToken = async (req, res, next) => {
  let token = null; // Define token outside try block

  try {
    logWithCheckpoint("info", "Starting token authentication", "AUTH_001");

    const authHeader = req.headers["authorization"];
    token = authHeader && authHeader.split(" ")[1]; // Bearer TOKEN

    logWithCheckpoint("debug", "Token received", "AUTH_001.5", {
      authHeader: authHeader ? `${authHeader.substring(0, 20)}...` : "null",
      token: token || "null",
      tokenLength: token ? token.length : 0,
    });

    if (!token) {
      logWithCheckpoint("warn", "No token provided", "AUTH_002");
      return res.status(401).json(createErrorResponse("AUTH_TOKEN_REQUIRED"));
    }

    logWithCheckpoint("debug", "Attempting to verify token", "AUTH_001.6", {
      tokenStart: token.substring(0, 10),
      tokenEnd: token.substring(token.length - 10),
      secretLength: (process.env.JWT_SECRET || "fallback-secret").length,
    });

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback-secret"
    );

    logWithCheckpoint("debug", "Token decoded successfully", "AUTH_001.7", {
      userId: decoded.userId,
      whatsapp: decoded.whatsapp,
      role: decoded.role,
      tokenVersion: decoded.tokenVersion,
    });

    const user = await User.findById(decoded.userId)
      .populate("agentId", "name whatsapp isActive")
      .lean();

    if (!user) {
      logWithCheckpoint("warn", "User not found", "AUTH_003", {
        userId: decoded.userId,
      });
      return res.status(401).json(createErrorResponse("USER_NOT_FOUND"));
    }

    if (!user.isActive) {
      logWithCheckpoint("warn", "User inactive", "AUTH_004", {
        userId: user._id,
      });
      return res
        .status(401)
        .json(createErrorResponse("AUTH_ACCOUNT_DEACTIVATED"));
    }

    if (user.tokenVersion !== decoded.tokenVersion) {
      logWithCheckpoint("warn", "Token version mismatch", "AUTH_005", {
        userId: user._id,
        userVersion: user.tokenVersion,
        tokenVersion: decoded.tokenVersion,
      });
      return res
        .status(401)
        .json(createErrorResponse("AUTH_TOKEN_VERSION_MISMATCH"));
    }

    req.user = user;
    logWithCheckpoint("info", "Token authentication successful", "AUTH_006", {
      userId: user._id,
    });

    next();
  } catch (error) {
    logError(error, { operation: "authenticateToken" });

    logWithCheckpoint("error", "Token verification failed", "AUTH_ERROR", {
      errorName: error.name,
      errorMessage: error.message,
      tokenProvided: !!token,
      tokenLength: token ? token.length : 0,
    });

    if (error.name === "JsonWebTokenError") {
      return res.status(401).json(createErrorResponse("AUTH_TOKEN_INVALID"));
    }

    if (error.name === "TokenExpiredError") {
      return res.status(401).json(createErrorResponse("AUTH_TOKEN_EXPIRED"));
    }

    res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
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

// Middleware to rate limit requests
export const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    try {
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
