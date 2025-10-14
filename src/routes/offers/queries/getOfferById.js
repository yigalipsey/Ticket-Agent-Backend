import express from "express";
import OfferService from "../../../services/offer/index.js";
import { logError } from "../../../utils/logger.js";
import { rateLimit } from "../../../middleware/auth.js";
import { createErrorResponse } from "../../../utils/errorCodes.js";
import { createSuccessResponse } from "../../../utils/successCodes.js";

const router = express.Router();

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

export default router;
