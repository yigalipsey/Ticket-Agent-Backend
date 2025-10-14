import Offer from "../../../models/Offer.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";

/**
 * Update offer
 */
export const updateOffer = async (id, updateData) => {
  try {
    logWithCheckpoint("info", "Starting to update offer", "OFFER_018", {
      id,
      updateData,
    });

    // Validate price if provided
    if (updateData.price !== undefined && updateData.price <= 0) {
      throw new Error("Price must be greater than 0");
    }

    const offer = await Offer.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    })
      .populate("fixtureId", "date status round tags")
      .populate("agentId", "name whatsapp isActive")
      .lean();

    if (!offer) {
      logWithCheckpoint("warn", "Offer not found for update", "OFFER_019", {
        id,
      });
      return null;
    }

    logWithCheckpoint("info", "Successfully updated offer", "OFFER_020", {
      id,
    });
    return offer;
  } catch (error) {
    logError(error, { operation: "updateOffer", id, updateData });
    throw error;
  }
};
