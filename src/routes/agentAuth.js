import express from "express";
import AgentAuthService from "../services/agent/AgentAuthService.js";
import { logRequest, logError } from "../utils/logger.js";
import { rateLimit } from "../middleware/userAuth.js";
import { createErrorResponse } from "../utils/errorCodes.js";
import { createSuccessResponse } from "../utils/successCodes.js";
import { getAgentSessionConfig } from "../config/session.js";

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
    const { cookieName, cookieOptions } = getAgentSessionConfig();

    // Set secure cookie with token
    res.cookie(cookieName, result.token, cookieOptions);
    console.log("✅ Cookie set:", {
      name: cookieName,
      options: cookieOptions,
      valueLen: result.token?.length || 0,
    });

    res.json(
      createSuccessResponse(
        {
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
    const { cookieName, cookieOptions } = getAgentSessionConfig();
    const token = req.cookies[cookieName];

    if (token) {
      // Verify token and get agent info
      const agentInfo = await AgentAuthService.verifyToken(token);
      // Increment token version to invalidate all existing tokens
      await AgentAuthService.incrementTokenVersion(agentInfo.agentId);
    }

    // Clear the cookie
    res.clearCookie(cookieName, cookieOptions);

    res.json(createSuccessResponse(null, "AGENT_LOGOUT_SUCCESS"));
  } catch (error) {
    logError(error, { route: "POST /api/auth/agent/logout" });
    res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
  }
});

// GET /api/auth/agent/me - Get current agent info
router.get("/me", rateLimit(100), async (req, res) => {
  try {
    const { cookieName } = getAgentSessionConfig();
    const token = req.cookies[cookieName];

    if (!token) {
      // Colored + info diagnostics for missing token
      const RED = "\x1b[31m";
      const YELLOW = "\x1b[33m";
      const CYAN = "\x1b[36m";
      const RESET = "\x1b[0m";
      console.error(
        `${RED}%s${RESET}`,
        `AUTH_401 AGENT | ${req.method} ${req.originalUrl} | reason=missing_token`
      );
      console.error(
        `${YELLOW}%s${RESET}`,
        `headers=${JSON.stringify({
          origin: req.headers.origin,
          referer: req.headers.referer,
          host: req.headers.host,
          xfp: req.headers["x-forwarded-proto"],
          xfh: req.headers["x-forwarded-host"],
        })}`
      );
      console.error(
        `${CYAN}%s${RESET}`,
        `cookies=${JSON.stringify({
          cookieNames: Object.keys(req.cookies || {}),
        })}`
      );
      return res.status(401).json(createErrorResponse("AUTH_TOKEN_REQUIRED"));
    }

    // Verify token
    const agentInfo = await AgentAuthService.verifyToken(token);

    // Get full agent details
    const agent = await AgentAuthService.getAgentById(agentInfo.agentId);

    if (!agent) {
      return res.status(404).json(createErrorResponse("AGENT_NOT_FOUND"));
    }

    res.json(createSuccessResponse(agent, "AGENT_INFO_SUCCESS"));
  } catch (error) {
    logError(error, { route: "GET /api/auth/agent/me" });
    // Colored diagnostics for token issues
    const RED = "\x1b[31m";
    const YELLOW = "\x1b[33m";
    const CYAN = "\x1b[36m";
    const RESET = "\x1b[0m";
    console.error(
      `${RED}%s${RESET}`,
      `AUTH_401 AGENT | ${req.method} ${req.originalUrl} | reason=token_verification_failed | msg=${error.message}`
    );
    console.error(
      `${YELLOW}%s${RESET}`,
      `headers=${JSON.stringify({
        origin: req.headers.origin,
        referer: req.headers.referer,
        host: req.headers.host,
        xfp: req.headers["x-forwarded-proto"],
        xfh: req.headers["x-forwarded-host"],
      })}`
    );
    console.error(
      `${CYAN}%s${RESET}`,
      `cookies=${JSON.stringify({
        cookieNames: Object.keys(req.cookies || {}),
      })}`
    );

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
