import Offer from "../../../models/Offer.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";

/**
 * Get offer by ID
 */
export const getOfferById = async (id) => {
  try {
    logWithCheckpoint("info", "Starting to fetch offer by ID", "OFFER_009", {
      id,
    });

    const offer = await Offer.findById(id)
      .populate("fixtureId", "date status round tags")
      .populate("agentId", "name whatsapp isActive")
      .lean();

    if (!offer) {
      logWithCheckpoint("warn", "Offer not found", "OFFER_010", { id });
      return null;
    }

    logWithCheckpoint("info", "Successfully fetched offer", "OFFER_011", {
      id,
    });
    return offer;
  } catch (error) {
    logError(error, { operation: "getOfferById", id });
    throw error;
  }
};
