import Offer from "../../../models/Offer.js";
import offersByFixtureCacheService from "../cache/OffersByFixtureCacheService.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";

/**
 * Refresh offers cache for a specific fixture
 * This ensures the cache is immediately updated with the latest offers
 */
export const refreshOffersCache = async (fixtureId) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting to refresh offers cache",
      "OFFER_CACHE_HELPER_001",
      {
        fixtureId,
      }
    );

    // Fetch latest offers from database
    const offers = await Offer.find({ fixtureId })
      .populate("agentId", "name whatsapp isActive")
      .sort({ price: 1 }); // Sort by price ascending

    // Refresh cache with updated data
    const cacheRefreshed = offersByFixtureCacheService.refresh(fixtureId, {
      offers,
      pagination: {
        page: 1,
        limit: 20,
        total: offers.length,
        pages: 1,
      },
      fromCache: false,
    });

    logWithCheckpoint(
      "info",
      "Successfully refreshed offers cache",
      "OFFER_CACHE_HELPER_002",
      {
        fixtureId,
        offersCount: offers.length,
        cacheRefreshed,
      }
    );

    return {
      success: true,
      offersCount: offers.length,
      cacheRefreshed,
    };
  } catch (error) {
    logError(error, { operation: "refreshOffersCache", fixtureId });
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Clear offers cache for a specific fixture
 * Use this when you want to force a fresh fetch on next request
 */
export const clearOffersCache = (fixtureId) => {
  try {
    logWithCheckpoint(
      "info",
      "Clearing offers cache",
      "OFFER_CACHE_HELPER_003",
      {
        fixtureId,
      }
    );

    const deleted = offersByFixtureCacheService.delete(fixtureId);

    logWithCheckpoint(
      "info",
      "Successfully cleared offers cache",
      "OFFER_CACHE_HELPER_004",
      {
        fixtureId,
        deleted,
      }
    );

    return {
      success: true,
      deleted,
    };
  } catch (error) {
    logError(error, { operation: "clearOffersCache", fixtureId });
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Get offers from cache or database with automatic refresh
 * This is a smart getter that ensures fresh data
 */
export const getOffersWithCacheRefresh = async (fixtureId) => {
  try {
    // First try to get from cache
    const cachedData = offersByFixtureCacheService.get(fixtureId);

    if (cachedData) {
      logWithCheckpoint(
        "info",
        "Offers retrieved from cache",
        "OFFER_CACHE_HELPER_005",
        {
          fixtureId,
          offersCount: cachedData.offers?.length || 0,
        }
      );
      return cachedData;
    }

    // Cache miss - refresh from database
    logWithCheckpoint(
      "info",
      "Cache miss - refreshing from database",
      "OFFER_CACHE_HELPER_006",
      {
        fixtureId,
      }
    );

    const refreshResult = await refreshOffersCache(fixtureId);

    if (refreshResult.success) {
      // Return the freshly cached data
      return offersByFixtureCacheService.get(fixtureId);
    }

    throw new Error("Failed to refresh cache");
  } catch (error) {
    logError(error, { operation: "getOffersWithCacheRefresh", fixtureId });
    throw error;
  }
};
