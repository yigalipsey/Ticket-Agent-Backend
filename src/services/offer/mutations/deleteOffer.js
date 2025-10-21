import Offer from "../../../models/Offer.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import { refreshOffersCache } from "../utils/cacheHelpers.js";

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

    // Refresh cache with updated offers
    const cacheRefreshResult = await refreshOffersCache(offer.fixtureId);

    logWithCheckpoint("info", "Successfully deleted offer", "OFFER_025", {
      id,
      fixtureId: offer.fixtureId,
      cacheRefreshed: cacheRefreshResult.success,
      offersCount: cacheRefreshResult.offersCount,
    });
    return offer;
  } catch (error) {
    logError(error, { operation: "deleteOffer", id });
    throw error;
  }
};
