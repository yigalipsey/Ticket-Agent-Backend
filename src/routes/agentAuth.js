import express from "express";
import AgentAuthService from "../services/agent/AgentAuthService.js";
import { logRequest, logError } from "../utils/logger.js";
import { rateLimit } from "../middleware/auth.js";
import { createErrorResponse } from "../utils/errorCodes.js";
import { createSuccessResponse } from "../utils/successCodes.js";

const router = express.Router();

// Middleware for request logging
router.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const responseTime = Date.now() - start;
    logRequest(req, res, responseTime);
  });

  next();
});

// POST /api/auth/agent/login - Agent login with email and password
router.post("/login", rateLimit(50), async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json(
        createErrorResponse("VALIDATION_MISSING_FIELDS", {
          required: ["email", "password"],
        })
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json(
        createErrorResponse("VALIDATION_INVALID_FORMAT", {
          field: "email",
          expected: "valid email address",
        })
      );
    }

    const result = await AgentAuthService.login(email, password);

    res.json(
      createSuccessResponse(
        {
          token: result.token,
          agent: result.agent,
        },
        "AGENT_LOGIN_SUCCESS"
      )
    );
  } catch (error) {
    logError(error, { route: "POST /api/auth/agent/login", body: req.body });

    // Handle specific error cases
    if (error.message === "AGENT_NOT_FOUND") {
      return res.status(401).json(
        createErrorResponse("AGENT_INVALID_CREDENTIALS", {
          message: "אימייל או סיסמה לא נכונים",
        })
      );
    }

    if (error.message === "AGENT_ACCOUNT_DEACTIVATED") {
      return res.status(401).json(
        createErrorResponse("AGENT_ACCOUNT_DEACTIVATED", {
          message: "החשבון שלך הושבת. פנה למנהל המערכת",
        })
      );
    }

    if (error.message === "AGENT_INVALID_CREDENTIALS") {
      return res.status(401).json(
        createErrorResponse("AGENT_INVALID_CREDENTIALS", {
          message: "אימייל או סיסמה לא נכונים",
        })
      );
    }

    if (error.message === "AGENT_LOGIN_ERROR") {
      return res.status(500).json(
        createErrorResponse("AGENT_LOGIN_ERROR", {
          message: "שגיאה בהתחברות. נסה שוב מאוחר יותר",
        })
      );
    }

    res.status(500).json(
      createErrorResponse("INTERNAL_SERVER_ERROR", {
        message: "שגיאת שרת. נסה שוב מאוחר יותר",
      })
    );
  }
});

// POST /api/auth/agent/logout - Agent logout
router.post("/logout", rateLimit(100), async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(400).json(createErrorResponse("AUTH_TOKEN_REQUIRED"));
    }

    // Verify token and get agent info
    const agentInfo = await AgentAuthService.verifyToken(token);

    // Increment token version to invalidate all existing tokens
    await AgentAuthService.incrementTokenVersion(agentInfo.agentId);

    res.json(createSuccessResponse(null, "AGENT_LOGOUT_SUCCESS"));
  } catch (error) {
    logError(error, { route: "POST /api/auth/agent/logout" });
    res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
  }
});

// GET /api/auth/agent/me - Get current agent info
router.get("/me", rateLimit(100), async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(401).json(createErrorResponse("AUTH_TOKEN_REQUIRED"));
    }

    // Verify token
    const agentInfo = await AgentAuthService.verifyToken(token);

    // Get full agent details
    const agent = await AgentAuthService.getAgentById(agentInfo.agentId);

    res.json(createSuccessResponse(agent, "AGENT_INFO_SUCCESS"));
  } catch (error) {
    logError(error, { route: "GET /api/auth/agent/me" });

    if (error.message === "AGENT_TOKEN_INVALID") {
      return res.status(401).json(createErrorResponse("AUTH_TOKEN_INVALID"));
    }

    if (error.message === "AGENT_NOT_FOUND") {
      return res.status(404).json(createErrorResponse("AGENT_NOT_FOUND"));
    }

    res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
  }
});

export default router;
