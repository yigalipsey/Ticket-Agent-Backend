import express from "express";
import OfferService from "../services/offer/index.js";
import { logRequest, logError } from "../utils/logger.js";
import {
  authenticateToken,
  requireRole,
  rateLimit,
} from "../middleware/auth.js";
import {
  createErrorResponse,
  createSuccessResponse,
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

// GET /api/offers - Get all offers with pagination and filtering
router.get("/", rateLimit(100), async (req, res) => {
  try {
    const result = await OfferService.query.getAllOffers(req.query);

    res.json({
      success: true,
      data: result.offers,
      pagination: result.pagination,
    });
  } catch (error) {
    logError(error, { route: "GET /api/offers", query: req.query });
    res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
  }
});

// GET /api/offers/fixture/:fixtureId - Get offers by fixture ID (legacy)
router.get("/fixture/:fixtureId", rateLimit(100), async (req, res) => {
  try {
    const { fixtureId } = req.params;

    if (!fixtureId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json(
        createErrorResponse("VALIDATION_INVALID_FORMAT", {
          field: "fixtureId",
          expected: "MongoDB ObjectId",
        })
      );
    }

    const result = await OfferService.query.getOffersByFixture(
      fixtureId,
      req.query
    );

    res.json(
      createSuccessResponse(
        {
          offers: result.offers,
          pagination: result.pagination,
        },
        "OFFERS_FETCHED"
      )
    );
  } catch (error) {
    logError(error, {
      route: "GET /api/offers/fixture/:fixtureId",
      fixtureId: req.params.fixtureId,
      query: req.query,
    });
    res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
  }
});

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

// GET /api/offers/:id - Get offer by ID
router.get("/:id", rateLimit(100), async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json(
        createErrorResponse("VALIDATION_INVALID_FORMAT", {
          field: "id",
          expected: "MongoDB ObjectId",
        })
      );
    }

    const offer = await OfferService.query.getOfferById(id);

    if (!offer) {
      return res.status(404).json(createErrorResponse("OFFER_NOT_FOUND"));
    }

    res.json(createSuccessResponse(offer, "SUCCESS"));
  } catch (error) {
    logError(error, { route: "GET /api/offers/:id", id: req.params.id });
    res.status(500).json({
      success: false,
      error: "Failed to fetch offer",
      message: error.message,
    });
  }
});

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

// PUT /api/offers/:id - Update offer
router.put(
  "/:id",
  authenticateToken,
  requireRole("agent"),
  rateLimit(20),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: "Invalid offer ID format",
        });
      }

      // Validate price if provided
      if (updateData.price !== undefined && updateData.price <= 0) {
        return res.status(400).json({
          success: false,
          error: "Price must be greater than 0",
        });
      }

      const offer = await OfferService.mutate.updateOffer(id, updateData);

      if (!offer) {
        return res.status(404).json({
          success: false,
          error: "Offer not found",
        });
      }

      res.json({
        success: true,
        data: offer,
      });
    } catch (error) {
      logError(error, {
        route: "PUT /api/offers/:id",
        id: req.params.id,
        body: req.body,
      });
      res.status(500).json({
        success: false,
        error: "Failed to update offer",
        message: error.message,
      });
    }
  }
);

// PATCH /api/offers/:id/toggle - Toggle offer availability
router.patch(
  "/:id/toggle",
  authenticateToken,
  requireRole("agent"),
  rateLimit(20),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: "Invalid offer ID format",
        });
      }

      const offer = await OfferService.mutate.toggleOfferAvailability(id);

      if (!offer) {
        return res.status(404).json({
          success: false,
          error: "Offer not found",
        });
      }

      res.json({
        success: true,
        data: offer,
      });
    } catch (error) {
      logError(error, {
        route: "PATCH /api/offers/:id/toggle",
        id: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: "Failed to toggle offer availability",
        message: error.message,
      });
    }
  }
);

// DELETE /api/offers/:id - Delete offer
router.delete(
  "/:id",
  authenticateToken,
  requireRole("agent"),
  rateLimit(10),
  async (req, res) => {
    try {
      const { id } = req.params;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: "Invalid offer ID format",
        });
      }

      const offer = await OfferService.mutate.deleteOffer(id);

      if (!offer) {
        return res.status(404).json({
          success: false,
          error: "Offer not found",
        });
      }

      res.json({
        success: true,
        message: "Offer deleted successfully",
      });
    } catch (error) {
      logError(error, {
        route: "DELETE /api/offers/:id",
        id: req.params.id,
      });
      res.status(500).json({
        success: false,
        error: "Failed to delete offer",
        message: error.message,
      });
    }
  }
);

export default router;
