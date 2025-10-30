import express from "express";
import OfferService from "../../../services/offer/index.js";
import { logError } from "../../../utils/logger.js";
import { rateLimit } from "../../../middleware/userAuth.js";
import { createErrorResponse } from "../../../utils/errorCodes.js";
import { createSuccessResponse } from "../../../utils/successCodes.js";

const router = express.Router();

// GET /api/offers/fixture/:fixtureId - Get all offers by fixture ID
router.get("/fixture/:fixtureId", rateLimit(1000), async (req, res) => {
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

    const result = await OfferService.query.getOffersByFixtureId(
      fixtureId,
      req.query
    );

    res.json(
      createSuccessResponse(
        {
          offers: result.offers,
          fixture: result.fixture,
          pagination: result.pagination,
          fromCache: result.fromCache,
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

export default router;
