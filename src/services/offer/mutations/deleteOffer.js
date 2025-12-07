import Offer from "../../../models/Offer.js";
import FootballEvent from "../../../models/FootballEvent.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import { refreshOffersCache } from "../utils/cacheHelpers.js";
import { updateFixtureMinPrice } from "../utils/fixtureMinPriceService.js";

/**
 * Delete offer
 */
export const deleteOffer = async (id) => {
  try {
    logWithCheckpoint("info", "Starting to delete offer", "OFFER_023", {
      id,
    });

    // שליפת ההצעה לפני מחיקה כדי לקבל את fixtureId
    const offer = await Offer.findById(id);

    if (!offer) {
      logWithCheckpoint("warn", "Offer not found for deletion", "OFFER_024", {
        id,
      });
      return null;
    }

    const fixtureId = offer.fixtureId;

    // שליפת פרטי המשחק לפני מחיקה
    const fixture = await FootballEvent.findById(fixtureId);

    if (!fixture) {
      logWithCheckpoint(
        "warn",
        "Fixture not found for offer deletion",
        "OFFER_026",
        {
          id,
          fixtureId,
        }
      );
      // מוחקים את ההצעה בכל מקרה
      await Offer.findByIdAndDelete(id);
      return offer;
    }

    // מחיקת ההצעה
    await Offer.findByIdAndDelete(id);

    // 1. Refresh cache of offers for this fixture
    const cacheRefreshResult = await refreshOffersCache(fixtureId);

    // 2. עדכון minPrice של המשחק באמצעות השירות המרכזי
    const minPriceUpdateResult = await updateFixtureMinPrice(fixtureId, {
      refreshCache: true,
    });

    logWithCheckpoint("info", "Successfully deleted offer", "OFFER_025", {
      id,
      fixtureId,
      cacheRefreshed: cacheRefreshResult.success,
      minPriceUpdated: minPriceUpdateResult.updated,
      teamsCacheRefreshed: minPriceUpdateResult.teamsCacheRefreshed || 0,
      leagueCacheRefreshed: minPriceUpdateResult.leagueCacheRefreshed || 0,
      previousMinPrice: minPriceUpdateResult.previousMinPrice,
      newMinPrice: minPriceUpdateResult.newMinPrice,
    });

    return offer;
  } catch (error) {
    logError(error, { operation: "deleteOffer", id });
    throw error;
  }
};
