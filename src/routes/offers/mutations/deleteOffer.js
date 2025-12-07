import express from "express";
import OfferService from "../../../services/offer/index.js";
import Offer from "../../../models/Offer.js";
import { logError, logWithCheckpoint } from "../../../utils/logger.js";
import {
  authenticateAgentToken,
  requireAgent,
  rateLimit,
} from "../../../middleware/agentAuth.js";
import { createErrorResponse } from "../../../utils/errorCodes.js";

const router = express.Router();

// DELETE /api/offers/:id - Delete offer
router.delete(
  "/:id",
  authenticateAgentToken,
  requireAgent,
  rateLimit(10),
  async (req, res) => {
    try {
      const { id } = req.params;
      const agentId = req.agent.id;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json(
          createErrorResponse("VALIDATION_INVALID_FORMAT", {
            field: "id",
            expected: "MongoDB ObjectId",
          })
        );
      }

      // Check ownership
      const existingOffer = await Offer.findById(id);
      if (!existingOffer) {
        return res.status(404).json(createErrorResponse("OFFER_NOT_FOUND"));
      }

      // Verify ownerType is Agent
      if (existingOffer.ownerType !== "Agent") {
        logWithCheckpoint(
          "warn",
          "Offer is not owned by an Agent - deletion denied",
          "OFFER_DELETE_001",
          {
            offerId: id,
            ownerType: existingOffer.ownerType,
            agentId,
          }
        );
        return res.status(403).json(createErrorResponse("FORBIDDEN_ACCESS"));
      }

      // Convert both to strings for comparison to handle ObjectId vs string
      const offerOwnerId = existingOffer.ownerId?.toString();
      const requestAgentId = agentId?.toString();

      logWithCheckpoint(
        "info",
        "Checking offer ownership for deletion",
        "OFFER_DELETE_002",
        {
          offerId: id,
          offerOwnerId,
          requestAgentId,
          ownerType: existingOffer.ownerType,
          match: offerOwnerId === requestAgentId,
        }
      );

      if (!offerOwnerId || !requestAgentId || offerOwnerId !== requestAgentId) {
        logWithCheckpoint(
          "warn",
          "Offer ownership mismatch - deletion denied",
          "OFFER_DELETE_003",
          {
            offerId: id,
            offerOwnerId,
            requestAgentId,
            ownerType: existingOffer.ownerType,
          }
        );
        return res.status(403).json(createErrorResponse("FORBIDDEN_ACCESS"));
      }

      const deletedOffer = await OfferService.mutate.deleteOffer(id);

      if (!deletedOffer) {
        return res.status(404).json(createErrorResponse("OFFER_NOT_FOUND"));
      }

      res.json({
        success: true,
        message: "Offer deleted successfully",
      });
    } catch (error) {
      logError(error, {
        route: "DELETE /api/offers/:id",
        id: req.params.id,
        agentId: req.agent?.id,
      });
      res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
    }
  }
);

export default router;
