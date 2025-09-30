import express from "express";
import UserService from "../services/user/index.js";
import { logRequest, logError } from "../utils/logger.js";
import {
  authenticateToken,
  requireRole,
  requireExactRole,
  rateLimit,
} from "../middleware/auth.js";

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

// GET /api/users - Get all users with pagination and filtering
router.get(
  "/",
  authenticateToken,
  requireRole("super-admin"),
  rateLimit(50),
  async (req, res) => {
    try {
      const result = await UserService.query.getAllUsers(req.query);

      res.json({
        success: true,
        data: result.users,
        pagination: result.pagination,
      });
    } catch (error) {
      logError(error, { route: "GET /api/users", query: req.query });
      res.status(500).json({
        success: false,
        error: "Failed to fetch users",
        message: error.message,
      });
    }
  }
);

// GET /api/users/active - Get active users only
router.get(
  "/active",
  authenticateToken,
  requireRole("super-admin"),
  rateLimit(50),
  async (req, res) => {
    try {
      const users = await UserService.query.getActiveUsers();

      res.json({
        success: true,
        data: users,
      });
    } catch (error) {
      logError(error, { route: "GET /api/users/active" });
      res.status(500).json({
        success: false,
        error: "Failed to fetch active users",
        message: error.message,
      });
    }
  }
);

// GET /api/users/:id - Get user by ID
router.get(
  "/:id",
  authenticateToken,
  requireRole("user"),
  rateLimit(50),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: "Invalid user ID format",
        });
      }

      const user = await UserService.query.getUserById(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      logError(error, { route: "GET /api/users/:id", id: req.params.id });
      res.status(500).json({
        success: false,
        error: "Failed to fetch user",
        message: error.message,
      });
    }
  }
);

// GET /api/users/whatsapp/:whatsapp - Get user by WhatsApp number
router.get(
  "/whatsapp/:whatsapp",
  authenticateToken,
  requireRole("super-admin"),
  rateLimit(50),
  async (req, res) => {
    try {
      const { whatsapp } = req.params;

      const user = await UserService.query.getUserByWhatsApp(whatsapp);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      logError(error, {
        route: "GET /api/users/whatsapp/:whatsapp",
        whatsapp: req.params.whatsapp,
      });
      res.status(500).json({
        success: false,
        error: "Failed to fetch user",
        message: error.message,
      });
    }
  }
);

// POST /api/users - Create new user
router.post(
  "/",
  authenticateToken,
  requireRole("super-admin"),
  rateLimit(10),
  async (req, res) => {
    try {
      const userData = req.body;

      // Basic validation
      if (!userData.whatsapp) {
        return res.status(400).json({
          success: false,
          error: "WhatsApp number is required",
        });
      }

      // agentId is required only for agent role
      if (userData.role === "agent" && !userData.agentId) {
        return res.status(400).json({
          success: false,
          error: "Agent ID is required for agent role",
        });
      }

      const user = await UserService.mutate.createUser(userData);

      res.status(201).json({
        success: true,
        data: user,
      });
    } catch (error) {
      logError(error, { route: "POST /api/users", body: req.body });
      res.status(500).json({
        success: false,
        error: "Failed to create user",
        message: error.message,
      });
    }
  }
);

// PUT /api/users/:id - Update user
router.put(
  "/:id",
  authenticateToken,
  requireRole("super-admin"),
  rateLimit(20),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: "Invalid user ID format",
        });
      }

      const user = await UserService.mutate.updateUser(id, updateData);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      logError(error, {
        route: "PUT /api/users/:id",
        id: req.params.id,
        body: req.body,
      });
      res.status(500).json({
        success: false,
        error: "Failed to update user",
        message: error.message,
      });
    }
  }
);

// PATCH /api/users/:id/deactivate - Deactivate user
router.patch(
  "/:id/deactivate",
  authenticateToken,
  requireRole("super-admin"),
  rateLimit(20),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: "Invalid user ID format",
        });
      }

      const user = await UserService.mutate.deactivateUser(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      logError(error, {
        route: "PATCH /api/users/:id/deactivate",
        id: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: "Failed to deactivate user",
        message: error.message,
      });
    }
  }
);

// PATCH /api/users/:id/activate - Activate user
router.patch(
  "/:id/activate",
  authenticateToken,
  requireRole("super-admin"),
  rateLimit(20),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: "Invalid user ID format",
        });
      }

      const user = await UserService.mutate.activateUser(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      logError(error, {
        route: "PATCH /api/users/:id/activate",
        id: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: "Failed to activate user",
        message: error.message,
      });
    }
  }
);

// PATCH /api/users/:id/login - Update last login
router.patch(
  "/:id/login",
  authenticateToken,
  requireRole("user"),
  rateLimit(20),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: "Invalid user ID format",
        });
      }

      const user = await UserService.auth.updateLastLogin(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      logError(error, {
        route: "PATCH /api/users/:id/login",
        id: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: "Failed to update login",
        message: error.message,
      });
    }
  }
);

// PATCH /api/users/:id/logout-all - Increment token version (logout all devices)
router.patch(
  "/:id/logout-all",
  authenticateToken,
  requireRole("user"),
  rateLimit(20),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: "Invalid user ID format",
        });
      }

      const user = await UserService.auth.incrementTokenVersion(id);

      if (!user) {
        return res.status(404).json({
          success: false,
          error: "User not found",
        });
      }

      res.json({
        success: true,
        data: user,
      });
    } catch (error) {
      logError(error, {
        route: "PATCH /api/users/:id/logout-all",
        id: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: "Failed to logout all devices",
        message: error.message,
      });
    }
  }
);

export default router;
