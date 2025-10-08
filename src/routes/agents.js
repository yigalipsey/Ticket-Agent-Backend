import express from "express";
import AgentService from "../services/agent/index.js";
import { logRequest, logError } from "../utils/logger.js";
import {
  authenticateToken,
  requireRole,
  rateLimit,
} from "../middleware/auth.js";
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

// GET /api/agents - Get all agents with pagination and filtering
router.get(
  "/",
  authenticateToken,
  requireRole("super-admin"),
  rateLimit(50),
  async (req, res) => {
    try {
      const result = await AgentService.query.getAllAgents(req.query);

      res.json({
        success: true,
        data: result.agents,
        pagination: result.pagination,
      });
    } catch (error) {
      logError(error, { route: "GET /api/agents", query: req.query });
      res.status(500).json({
        success: false,
        error: "Failed to fetch agents",
        message: error.message,
      });
    }
  }
);

// GET /api/agents/active - Get active agents only
router.get(
  "/active",
  authenticateToken,
  requireRole("super-admin"),
  rateLimit(50),
  async (req, res) => {
    try {
      const agents = await AgentService.query.getActiveAgents();

      res.json({
        success: true,
        data: agents,
      });
    } catch (error) {
      logError(error, { route: "GET /api/agents/active" });
      res.status(500).json({
        success: false,
        error: "Failed to fetch active agents",
        message: error.message,
      });
    }
  }
);

// GET /api/agents/:id - Get agent by ID
router.get(
  "/:id",
  authenticateToken,
  requireRole("super-admin"),
  rateLimit(50),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: "Invalid agent ID format",
        });
      }

      const agent = await AgentService.query.getAgentById(id);

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: "Agent not found",
        });
      }

      res.json({
        success: true,
        data: agent,
      });
    } catch (error) {
      logError(error, { route: "GET /api/agents/:id", id: req.params.id });
      res.status(500).json({
        success: false,
        error: "Failed to fetch agent",
        message: error.message,
      });
    }
  }
);

// GET /api/agents/whatsapp/:whatsapp - Get agent by WhatsApp number
router.get(
  "/whatsapp/:whatsapp",
  authenticateToken,
  requireRole("super-admin"),
  rateLimit(50),
  async (req, res) => {
    try {
      const { whatsapp } = req.params;

      const agent = await AgentService.query.getAgentByWhatsApp(whatsapp);

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: "Agent not found",
        });
      }

      res.json({
        success: true,
        data: agent,
      });
    } catch (error) {
      logError(error, {
        route: "GET /api/agents/whatsapp/:whatsapp",
        whatsapp: req.params.whatsapp,
      });
      res.status(500).json({
        success: false,
        error: "Failed to fetch agent",
        message: error.message,
      });
    }
  }
);

// POST /api/agents - Create new agent
router.post(
  "/",
  authenticateToken,
  requireRole("super-admin"),
  rateLimit(10),
  async (req, res) => {
    try {
      const agentData = req.body;

      // Basic validation
      if (!agentData.whatsapp) {
        return res.status(400).json(
          createErrorResponse("VALIDATION_MISSING_FIELDS", {
            required: ["whatsapp"],
          })
        );
      }

      const agent = await AgentService.mutate.createAgent(agentData);

      res.status(201).json(createSuccessResponse(agent, "AGENT_CREATED"));
    } catch (error) {
      logError(error, { route: "POST /api/agents", body: req.body });

      // Handle duplicate key error
      if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        const value = error.keyValue[field];
        return res.status(409).json(
          createErrorResponse("AGENT_ALREADY_EXISTS", {
            field,
            value,
          })
        );
      }

      res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
    }
  }
);

// PUT /api/agents/:id - Update agent
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
          error: "Invalid agent ID format",
        });
      }

      const agent = await AgentService.mutate.updateAgent(id, updateData);

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: "Agent not found",
        });
      }

      res.json({
        success: true,
        data: agent,
      });
    } catch (error) {
      logError(error, {
        route: "PUT /api/agents/:id",
        id: req.params.id,
        body: req.body,
      });
      res.status(500).json({
        success: false,
        error: "Failed to update agent",
        message: error.message,
      });
    }
  }
);

// PATCH /api/agents/:id/deactivate - Deactivate agent
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
          error: "Invalid agent ID format",
        });
      }

      const agent = await AgentService.mutate.deactivateAgent(id);

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: "Agent not found",
        });
      }

      res.json({
        success: true,
        data: agent,
      });
    } catch (error) {
      logError(error, {
        route: "PATCH /api/agents/:id/deactivate",
        id: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: "Failed to deactivate agent",
        message: error.message,
      });
    }
  }
);

// PATCH /api/agents/:id/activate - Activate agent
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
          error: "Invalid agent ID format",
        });
      }

      const agent = await AgentService.mutate.activateAgent(id);

      if (!agent) {
        return res.status(404).json({
          success: false,
          error: "Agent not found",
        });
      }

      res.json({
        success: true,
        data: agent,
      });
    } catch (error) {
      logError(error, {
        route: "PATCH /api/agents/:id/activate",
        id: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: "Failed to activate agent",
        message: error.message,
      });
    }
  }
);

export default router;
