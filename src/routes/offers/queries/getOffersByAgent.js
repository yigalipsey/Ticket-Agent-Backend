import express from "express";
import AgentOfferService from "../../../services/offer/agent/AgentOfferService.js";
import { logError } from "../../../utils/logger.js";
import {
  authenticateAgentToken,
  requireAgent,
  rateLimit,
} from "../../../middleware/agentAuth.js";
import { createErrorResponse } from "../../../utils/errorCodes.js";

const router = express.Router();

// GET /api/offers/agent - Get offers of the authenticated agent
router.get(
  "/agent",
  authenticateAgentToken,
  requireAgent,
  rateLimit(50),
  async (req, res) => {
    try {
      const agentId = req.agent.id;

      const result = await AgentOfferService.getOffersByAgent(
        agentId,
        req.query
      );

      res.json({
        success: true,
        data: result.offers,
        pagination: result.pagination,
      });
    } catch (error) {
      logError(error, {
        route: "GET /api/offers/agent",
        agentId: req.agent?.id,
        query: req.query,
      });
      res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
    }
  }
);

export default router;
