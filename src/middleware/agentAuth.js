import { logWithCheckpoint, logError } from "../utils/logger.js";
import { createErrorResponse } from "../utils/errorCodes.js";

import jwt from "jsonwebtoken";
import AgentAuthService from "../services/agent/AgentAuthService.js";
import { getAgentSessionConfig, sessionConfig } from "../config/session.js";

// Middleware to verify agent JWT token from cookie
export const authenticateAgentToken = async (req, res, next) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting agent JWT authentication",
      "JWT_AUTH_001"
    );

    // Get token from cookie
    const { cookieName, jwtSecret } = getAgentSessionConfig();
    const token = req.cookies[cookieName];

    if (!token) {
      logWithCheckpoint(
        "warn",
        "No agent token found in cookie",
        "JWT_AUTH_002"
      );
      if (process.env.NODE_ENV === "production") {
        const diagnostics = {
          route: req.originalUrl,
          actor: "agent",
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
          expectedCookieName: cookieName,
          expectedCookieOptions: sessionConfig.cookieOptions,
          frontendUrlEnv: process.env.FRONTEND_URL,
        };
        console.error(
          "\x1b[31m%s\x1b[0m",
          `AUTH_401 | ${JSON.stringify(diagnostics)}`
        );
      }
      return res.status(401).json(createErrorResponse("AUTH_TOKEN_REQUIRED"));
    }

    // Verify token
    const decoded = jwt.verify(token, jwtSecret);

    // Get full agent details
    const agent = await AgentAuthService.getAgentById(decoded.agentId);

    if (!agent) {
      logWithCheckpoint("warn", "Agent not found", "JWT_AUTH_003", {
        agentId: decoded.agentId,
      });
      return res.status(401).json(createErrorResponse("AGENT_NOT_FOUND"));
    }

    if (!agent.isActive) {
      logWithCheckpoint(
        "warn",
        "Agent account is deactivated",
        "JWT_AUTH_004",
        {
          agentId: agent._id,
        }
      );
      return res
        .status(401)
        .json(createErrorResponse("AGENT_ACCOUNT_DEACTIVATED"));
    }

    // Attach agent info to request
    req.agent = {
      id: agent._id,
      email: agent.email,
      name: agent.name,
      agentType: agent.agentType,
      isActive: agent.isActive,
    };

    logWithCheckpoint(
      "info",
      "Agent JWT authentication successful",
      "JWT_AUTH_006",
      {
        agentId: agent._id,
        email: agent.email,
        agentType: agent.agentType,
      }
    );

    next();
  } catch (err) {
    logError(err, { operation: "authenticateAgentSession" });

    logWithCheckpoint(
      "error",
      "Agent JWT verification failed",
      "JWT_AUTH_ERROR",
      {
        errorName: err.name,
        errorMessage: err.message,
      }
    );

    if (process.env.NODE_ENV === "production") {
      const { cookieName } = getAgentSessionConfig();
      const diagnostics = {
        route: req.originalUrl,
        actor: "agent",
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
        expectedCookieName: cookieName,
        expectedCookieOptions: sessionConfig.cookieOptions,
        frontendUrlEnv: process.env.FRONTEND_URL,
      };
      console.error(
        "\x1b[31m%s\x1b[0m",
        `AUTH_401 | ${JSON.stringify(diagnostics)}`
      );
    }

    return res.status(401).json(createErrorResponse("AUTH_TOKEN_INVALID"));
  }
};

// Role hierarchy: super-admin > admin > agent > user
const roleHierarchy = {
  "super-admin": 4,
  admin: 3,
  agent: 2,
  user: 1,
};

// Check if user has required role or higher
export const requireRole = (requiredRole) => {
  return (req, res, next) => {
    try {
      // For agents, if they're authenticated, they have agent role
      if (req.agent && req.agent.id) {
        const userRole = "agent";
        const userRoleLevel = roleHierarchy[userRole] || 0;
        const requiredRoleLevel = roleHierarchy[requiredRole] || 0;

        if (userRoleLevel < requiredRoleLevel) {
          return res.status(403).json(
            createErrorResponse("INSUFFICIENT_PERMISSIONS", {
              required: requiredRole,
              current: userRole,
            })
          );
        }
      } else {
        return res.status(403).json(
          createErrorResponse("INSUFFICIENT_PERMISSIONS", {
            required: requiredRole,
            current: "none",
          })
        );
      }

      next();
    } catch (error) {
      logError(error, { operation: "requireRole" });
      return res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
    }
  };
};

// Check if agent has required role or higher
export const requireAgent = (req, res, next) => {
  return requireRole("agent")(req, res, next);
};

// Check if agent is admin or higher
export const requireAgentAdmin = requireRole("admin");

// Check if agent is super-admin
export const requireAgentSuperAdmin = requireRole("super-admin");

// Legacy aliases for backward compatibility
export const authenticateAgentSession = authenticateAgentToken;

// Rate limiting middleware
export const rateLimit = (maxRequests = 100, windowMs = 15 * 60 * 1000) => {
  const requests = new Map();

  return (req, res, next) => {
    const clientId = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    for (const [key, timestamp] of requests.entries()) {
      if (timestamp < windowStart) {
        requests.delete(key);
      }
    }

    // Check current request count
    const clientRequests = Array.from(requests.entries())
      .filter(([key]) => key.startsWith(clientId))
      .filter(([, timestamp]) => timestamp > windowStart);

    if (clientRequests.length >= maxRequests) {
      return res.status(429).json(
        createErrorResponse("RATE_LIMIT_EXCEEDED", {
          limit: maxRequests,
          window: windowMs,
        })
      );
    }

    // Add current request
    requests.set(`${clientId}-${now}`, now);

    next();
  };
};
