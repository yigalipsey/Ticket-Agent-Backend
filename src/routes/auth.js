import express from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import UserService from "../services/user/index.js";
import { logRequest, logError } from "../utils/logger.js";
import { rateLimit, authenticateToken } from "../middleware/auth.js";
import {
  createErrorResponse,
  createSuccessResponse,
  ERROR_CODES,
} from "../utils/errorCodes.js";

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

// POST /api/auth/login - User login
router.post("/login", rateLimit(100), async (req, res) => {
  try {
    const { whatsapp, password } = req.body;

    if (!whatsapp || !password) {
      return res.status(400).json(
        createErrorResponse("VALIDATION_MISSING_FIELDS", {
          required: ["whatsapp", "password"],
        })
      );
    }

    // Find user by WhatsApp
    const user = await UserService.query.getUserByWhatsApp(whatsapp);

    if (!user) {
      return res
        .status(401)
        .json(createErrorResponse("AUTH_INVALID_CREDENTIALS"));
    }

    if (!user.isActive) {
      return res
        .status(401)
        .json(createErrorResponse("AUTH_ACCOUNT_DEACTIVATED"));
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.passwordHash);

    if (!isValidPassword) {
      return res
        .status(401)
        .json(createErrorResponse("AUTH_INVALID_CREDENTIALS"));
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        whatsapp: user.whatsapp,
        role: user.role,
        tokenVersion: user.tokenVersion,
      },
      process.env.JWT_SECRET || "fallback-secret",
      { expiresIn: "24h" }
    );

    // Update last login
    await UserService.auth.updateLastLogin(user._id);

    res.json(
      createSuccessResponse(
        {
          token,
          user: {
            _id: user._id,
            whatsapp: user.whatsapp,
            role: user.role,
            agentId: user.agentId,
            isActive: user.isActive,
          },
        },
        "LOGIN_SUCCESS"
      )
    );
  } catch (error) {
    logError(error, { route: "POST /api/auth/login", body: req.body });
    res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
  }
});

// POST /api/auth/register - User registration
router.post("/register", rateLimit(50), async (req, res) => {
  try {
    const { whatsapp, password, agentId, role } = req.body;

    if (!whatsapp || !password || !role) {
      return res.status(400).json(
        createErrorResponse("VALIDATION_MISSING_FIELDS", {
          required: ["whatsapp", "password", "role"],
        })
      );
    }

    // Validate role
    if (!["user", "agent", "admin", "super-admin"].includes(role)) {
      return res.status(400).json(
        createErrorResponse("VALIDATION_INVALID_FORMAT", {
          field: "role",
          validValues: ["user", "agent", "admin", "super-admin"],
        })
      );
    }

    // agentId is required only for agent role
    if (role === "agent" && !agentId) {
      return res.status(400).json(
        createErrorResponse("VALIDATION_MISSING_FIELDS", {
          required: ["agentId"],
          reason: "agentId is required for agent role",
        })
      );
    }

    // Check if user already exists
    const existingUser = await UserService.query.getUserByWhatsApp(whatsapp);

    if (existingUser) {
      return res.status(409).json(createErrorResponse("USER_ALREADY_EXISTS"));
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userData = {
      whatsapp,
      passwordHash,
      role,
      isActive: true,
    };

    // Add agentId only if role is agent
    if (role === "agent") {
      userData.agentId = agentId;
    }

    const user = await UserService.mutate.createUser(userData);

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        whatsapp: user.whatsapp,
        role: user.role,
        tokenVersion: user.tokenVersion,
      },
      process.env.JWT_SECRET || "fallback-secret",
      { expiresIn: "24h" }
    );

    res.status(201).json(
      createSuccessResponse(
        {
          token,
          user: {
            _id: user._id,
            whatsapp: user.whatsapp,
            role: user.role,
            agentId: user.agentId,
            isActive: user.isActive,
          },
        },
        "REGISTRATION_SUCCESS"
      )
    );
  } catch (error) {
    logError(error, { route: "POST /api/auth/register", body: req.body });

    // Handle specific errors
    if (error.code === "AGENT_NOT_FOUND") {
      return res.status(404).json(createErrorResponse("AGENT_NOT_FOUND"));
    }

    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      const value = error.keyValue[field];
      return res.status(409).json(
        createErrorResponse("USER_ALREADY_EXISTS", {
          field,
          value,
        })
      );
    }

    res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
  }
});

// POST /api/auth/logout - User logout (increment token version)
router.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers["authorization"];
    const token = authHeader && authHeader.split(" ")[1];

    if (!token) {
      return res.status(400).json(createErrorResponse("AUTH_TOKEN_REQUIRED"));
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "fallback-secret"
    );

    // Increment token version to invalidate all existing tokens
    await UserService.auth.incrementTokenVersion(decoded.userId);

    res.json(createSuccessResponse(null, "LOGOUT_SUCCESS"));
  } catch (error) {
    logError(error, { route: "POST /api/auth/logout" });
    res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
  }
});

// GET /api/auth/me - Get current user info
router.get("/me", authenticateToken, async (req, res) => {
  try {
    res.json(
      createSuccessResponse(
        {
          _id: req.user._id,
          whatsapp: req.user.whatsapp,
          role: req.user.role,
          agentId: req.user.agentId,
          isActive: req.user.isActive,
          lastLoginAt: req.user.lastLoginAt,
        },
        "SUCCESS"
      )
    );
  } catch (error) {
    logError(error, { route: "GET /api/auth/me" });
    res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
  }
});

export default router;
