import express from "express";
import OfferService from "../../../services/offer/index.js";
import { logError } from "../../../utils/logger.js";
import {
  authenticateToken,
  requireRole,
  rateLimit,
} from "../../../middleware/userAuth.js";
import { createErrorResponse } from "../../../utils/errorCodes.js";

const router = express.Router();

// GET /api/offers/agent/:agentId - Get offers by agent
router.get(
  "/agent/:agentId",
  authenticateToken,
  requireRole("agent"),
  rateLimit(50),
  async (req, res) => {
    try {
      const { agentId } = req.params;

      if (!agentId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json(
          createErrorResponse("VALIDATION_INVALID_FORMAT", {
            field: "agentId",
            expected: "MongoDB ObjectId",
          })
        );
      }

      const result = await OfferService.query.getOffersByAgent(
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
        route: "GET /api/offers/agent/:agentId",
        agentId: req.params.agentId,
        query: req.query,
      });
      res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
    }
  }
);

export default router;
