import express from "express";
import OfferService from "../../../services/offer/index.js";
import { logError } from "../../../utils/logger.js";
import {
  authenticateToken,
  requireRole,
  rateLimit,
} from "../../../middleware/auth.js";

const router = express.Router();

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
