import Offer from "../../../models/Offer.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";

/**
 * Delete offer
 */
export const deleteOffer = async (id) => {
  try {
    logWithCheckpoint("info", "Starting to delete offer", "OFFER_023", {
      id,
    });

    const offer = await Offer.findByIdAndDelete(id);

    if (!offer) {
      logWithCheckpoint("warn", "Offer not found for deletion", "OFFER_024", {
        id,
      });
      return null;
    }

    logWithCheckpoint("info", "Successfully deleted offer", "OFFER_025", {
      id,
    });
    return offer;
  } catch (error) {
    logError(error, { operation: "deleteOffer", id });
    throw error;
  }
};
