import express from "express";
import OfferService from "../../../services/offer/index.js";
import { logError } from "../../../utils/logger.js";
import {
  authenticateToken,
  requireRole,
  rateLimit,
} from "../../../middleware/userAuth.js";
import { validateObjectIdParam } from "../../../middleware/validateObjectId.js";

const router = express.Router();

// PUT /api/offers/:id - Update offer
router.put(
  "/:id",
  validateObjectIdParam("id"),
  authenticateToken,
  requireRole("agent"),
  rateLimit(20),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

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

export default router;
