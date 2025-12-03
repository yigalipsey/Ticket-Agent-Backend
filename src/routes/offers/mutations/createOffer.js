import express from "express";
import OfferService from "../../../services/offer/index.js";
import { logError } from "../../../utils/logger.js";
import {
  authenticateAgentToken,
  requireAgent,
  rateLimit,
} from "../../../middleware/agentAuth.js";
import { createErrorResponse } from "../../../utils/errorCodes.js";
import { createSuccessResponse } from "../../../utils/successCodes.js";

const router = express.Router();

// POST /api/offers - Create new offer
router.post(
  "/",
  authenticateAgentToken,
  requireAgent,
  rateLimit(100),
  async (req, res) => {
    try {
      const offerData = req.body;
      const { fixtureId } = offerData;

      // Basic validation
      if (!fixtureId || !offerData.price) {
        return res.status(400).json(
          createErrorResponse("VALIDATION_MISSING_FIELDS", {
            required: ["fixtureId", "price"],
          })
        );
      }

      // Validate currency if provided
      if (
        offerData.currency &&
        !["EUR", "USD", "ILS", "GBP"].includes(offerData.currency)
      ) {
        return res.status(400).json(
          createErrorResponse("VALIDATION_INVALID_FORMAT", {
            field: "currency",
            expected: "EUR, USD, ILS, or GBP",
          })
        );
      }

      // Validate ticketType if provided
      if (
        offerData.ticketType &&
        !["standard", "vip"].includes(offerData.ticketType)
      ) {
        return res.status(400).json(
          createErrorResponse("VALIDATION_INVALID_FORMAT", {
            field: "ticketType",
            expected: "standard or vip",
          })
        );
      }

      // Validate ObjectId format for fixtureId
      if (!fixtureId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json(
          createErrorResponse("VALIDATION_INVALID_FORMAT", {
            field: "fixtureId",
            expected: "MongoDB ObjectId",
          })
        );
      }

      // Get agentId from session
      const agentId = req.agent.id;
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

      // Validate URL for sales page if provided
      let normalizedUrl;
      if (typeof offerData.url === "string") {
        const trimmedUrl = offerData.url.trim();
        if (trimmedUrl.length > 0) {
          try {
            const parsedUrl = new URL(trimmedUrl);
            if (!["http:", "https:"].includes(parsedUrl.protocol)) {
              return res.status(400).json(
                createErrorResponse("VALIDATION_INVALID_FORMAT", {
                  field: "url",
                  reason: "URL must start with http or https",
                })
              );
            }
            normalizedUrl = parsedUrl.toString();
          } catch {
            return res.status(400).json(
              createErrorResponse("VALIDATION_INVALID_FORMAT", {
                field: "url",
                reason: "Invalid sales page URL",
              })
            );
          }
        }
      }

      // Add agentId, ownerType, and fixtureId to offerData
      // Default ticketType to "standard" if not provided
      const offerDataWithAgent = {
        ...offerData,
        fixtureId,
        agentId, // Keep for backward compatibility
        ownerType: "Agent", // Set ownerType based on authentication
        ticketType: offerData.ticketType || "standard", // Default to standard
        url: normalizedUrl,
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

      // Handle duplicate key error (agent already has an offer for this fixture)
      if (error.code === 11000) {
        return res.status(409).json(
          createErrorResponse("OFFER_ALREADY_EXISTS", {
            message:
              "You already have an offer for this fixture. Use update instead.",
          })
        );
      }

      res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
    }
  }
);

export default router;
