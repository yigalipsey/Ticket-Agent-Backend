import Offer from "../../../models/Offer.js";
import Agent from "../../../models/Agent.js";
import Supplier from "../../../models/Supplier.js";
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
      .populate({
        path: "ownerId",
        select: "name whatsapp isActive imageUrl agentType companyName logoUrl",
      })
      .sort({ price: 1 }) // Sort by price ascending
      .lean();

    // מיפוי ownerId ל-agentId/supplierId לתאימות לאחור עם Frontend
    const mappedOffers = offers.map((offer) => {
      if (offer.ownerType === "Agent" && offer.ownerId) {
        offer.agentId = offer.ownerId;
      } else if (offer.ownerType === "Supplier" && offer.ownerId) {
        offer.supplierId = offer.ownerId;
      }
      return offer;
    });

    // Refresh cache with updated data
    const cacheRefreshed = offersByFixtureCacheService.refresh(fixtureId, {
      offers: mappedOffers,
      pagination: {
        page: 1,
        limit: 20,
        total: mappedOffers.length,
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
        offersCount: mappedOffers.length,
        cacheRefreshed,
      }
    );

    return {
      success: true,
      offersCount: mappedOffers.length,
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
 * Get offers from database (no cache - always fresh data)
 * Cache disabled - always returns fresh data from DB
 */
export const getOffersWithCacheRefresh = async (fixtureId) => {
  try {
    // Always fetch from database - cache disabled
    logWithCheckpoint(
      "info",
      "Fetching offers from database (cache disabled)",
      "OFFER_CACHE_HELPER_005",
      {
        fixtureId,
      }
    );

    // Fetch latest offers from database
    const offers = await Offer.find({ fixtureId })
      .populate({
        path: "ownerId",
        select: "name whatsapp isActive imageUrl agentType companyName logoUrl",
      })
      .sort({ price: 1 }) // Sort by price ascending
      .lean();

    // מיפוי ownerId ל-agentId/supplierId לתאימות לאחור עם Frontend
    const mappedOffers = offers.map((offer) => {
      if (offer.ownerType === "Agent" && offer.ownerId) {
        offer.agentId = offer.ownerId;
      } else if (offer.ownerType === "Supplier" && offer.ownerId) {
        offer.supplierId = offer.ownerId;
      }
      return offer;
    });

    logWithCheckpoint(
      "info",
      "Offers fetched from DB (cache disabled)",
      "OFFER_CACHE_HELPER_006",
      {
        fixtureId,
        offersCount: mappedOffers.length,
      }
    );

    return {
      offers: mappedOffers,
      pagination: {
        page: 1,
        limit: 20,
        total: mappedOffers.length,
        pages: Math.ceil(mappedOffers.length / 20),
      },
      fromCache: false,
    };
  } catch (error) {
    logError(error, { operation: "getOffersWithCacheRefresh", fixtureId });
    throw error;
  }
};
