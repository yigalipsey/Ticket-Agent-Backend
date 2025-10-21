import express from "express";
import OfferService from "../../../services/offer/index.js";
import { logError } from "../../../utils/logger.js";
import { rateLimit } from "../../../middleware/userAuth.js";
import { createErrorResponse } from "../../../utils/errorCodes.js";

const router = express.Router();

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

export default router;
