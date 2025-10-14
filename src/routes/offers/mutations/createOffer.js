import express from "express";
import OfferService from "../../../services/offer/index.js";
import { logError } from "../../../utils/logger.js";
import {
  authenticateToken,
  requireRole,
  rateLimit,
} from "../../../middleware/auth.js";
import { createErrorResponse } from "../../../utils/errorCodes.js";
import { createSuccessResponse } from "../../../utils/successCodes.js";

const router = express.Router();

// POST /api/offers - Create new offer
router.post(
  "/",
  authenticateToken,
  requireRole("agent"),
  rateLimit(10),
  async (req, res) => {
    try {
      const offerData = req.body;

      // Basic validation
      if (!offerData.fixtureId || !offerData.price) {
        return res.status(400).json(
          createErrorResponse("VALIDATION_MISSING_FIELDS", {
            required: ["fixtureId", "price"],
          })
        );
      }

      // Validate ObjectId format for fixtureId
      if (!offerData.fixtureId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json(
          createErrorResponse("VALIDATION_INVALID_FORMAT", {
            field: "fixtureId",
            expected: "MongoDB ObjectId",
          })
        );
      }

      // Get agentId from authenticated user
      const agentId = req.user.agentId;
      if (!agentId) {
        return res.status(400).json(
          createErrorResponse("AUTH_AGENT_ID_REQUIRED", {
            message: "User must be linked to an agent to create offers",
          })
        );
      }

      // Validate price
      if (offerData.price <= 0) {
        return res.status(400).json(
          createErrorResponse("VALIDATION_INVALID_FORMAT", {
            field: "price",
            reason: "Price must be greater than 0",
          })
        );
      }

      // Add agentId to offerData
      const offerDataWithAgent = {
        ...offerData,
        agentId,
      };

      const offer = await OfferService.mutate.createOffer(offerDataWithAgent);

      res.status(201).json(createSuccessResponse(offer, "OFFER_CREATED"));
    } catch (error) {
      logError(error, { route: "POST /api/offers", body: req.body });

      // Handle specific errors
      if (error.code === "AGENT_NOT_FOUND") {
        return res.status(404).json(createErrorResponse("AGENT_NOT_FOUND"));
      }

      if (error.code === "FIXTURE_NOT_FOUND") {
        return res.status(404).json(createErrorResponse("FIXTURE_NOT_FOUND"));
      }

      if (error.code === "AGENT_INACTIVE") {
        return res.status(403).json(createErrorResponse("AGENT_INACTIVE"));
      }

      res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
    }
  }
);

export default router;
