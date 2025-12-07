import Offer from "../../../models/Offer.js";
import FootballEvent from "../../../models/FootballEvent.js";
import Agent from "../../../models/Agent.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import { refreshOffersCache } from "../utils/cacheHelpers.js";
import { updateFixtureMinPrice } from "../utils/fixtureMinPriceService.js";

/**
 * Update existing offer
 */
export const updateOffer = async (id, updateData) => {
  try {
    logWithCheckpoint("info", "Starting to update offer", "OFFER_UPDATE_001", {
      id,
      updateFields: Object.keys(updateData),
    });

    // שליפת ההצעה הקיימת
    const existingOffer = await Offer.findById(id);

    if (!existingOffer) {
      logWithCheckpoint(
        "warn",
        "Offer not found for update",
        "OFFER_UPDATE_002",
        {
          id,
        }
      );
      return null;
    }

    const fixtureId = existingOffer.fixtureId;

    // שליפת פרטי המשחק
    const fixture = await FootballEvent.findById(fixtureId);

    if (!fixture) {
      logWithCheckpoint(
        "warn",
        "Fixture not found for offer update",
        "OFFER_UPDATE_003",
        {
          id,
          fixtureId,
        }
      );
      // ממשיכים עם העדכון בכל מקרה
    }

    // ולידציה של שדות
    if (updateData.price !== undefined && updateData.price <= 0) {
      throw new Error("Price must be greater than 0");
    }

    if (updateData.ownerId !== undefined || updateData.agentId !== undefined) {
      throw new Error(
        "Cannot change ownerId or agentId. Delete and create a new offer instead."
      );
    }

    // ולידציה של agent אם ownerType הוא Agent
    if (
      updateData.ownerType === "Agent" ||
      existingOffer.ownerType === "Agent"
    ) {
      const ownerId = updateData.ownerId || existingOffer.ownerId;
      const agent = await Agent.findById(ownerId);
      if (agent && !agent.isActive) {
        throw new Error("Agent is not active");
      }
    }

    // שמירת המחיר הישן והמטבע הישן לפני העדכון
    const oldPrice = existingOffer.price;
    const oldCurrency = existingOffer.currency;

    // עדכון ההצעה
    const updatedOffer = await Offer.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    // 1. Refresh cache of offers for this fixture
    const cacheRefreshResult = await refreshOffersCache(fixtureId);

    // 2. עדכון minPrice של המשחק באמצעות השירות המרכזי
    const minPriceUpdateResult = await updateFixtureMinPrice(fixtureId, {
      refreshCache: true,
    });

    // 3. לוג בהתאם לתוצאה
    if (minPriceUpdateResult.updated) {
      logWithCheckpoint(
        "info",
        "Offer updated successfully with cache invalidation",
        "OFFER_UPDATE_004",
        {
          id,
          fixtureId,
          cacheRefreshed: cacheRefreshResult.success,
          minPriceUpdated: true,
          teamsCacheRefreshed: minPriceUpdateResult.teamsCacheRefreshed || 0,
          leagueCacheRefreshed: minPriceUpdateResult.leagueCacheRefreshed || 0,
          oldPrice,
          newPrice: updatedOffer.price,
          oldCurrency,
          newCurrency: updatedOffer.currency,
          previousMinPrice: minPriceUpdateResult.previousMinPrice,
          newMinPrice: minPriceUpdateResult.newMinPrice,
        }
      );
    } else {
      logWithCheckpoint(
        "info",
        "Offer updated successfully",
        "OFFER_UPDATE_005",
        {
          id,
          fixtureId,
          cacheRefreshed: cacheRefreshResult.success,
          minPriceUpdated: false,
        }
      );
    }

    return updatedOffer;
  } catch (error) {
    logError(error, { operation: "updateOffer", id, updateData });
    throw error;
  }
};

/**
 * Update offer price (and optionally currency) using the standard update workflow
 */
export const updateOfferPrice = async (id, { price, currency } = {}) => {
  if (price === undefined && currency === undefined) {
    throw new Error("updateOfferPrice requires price or currency");
  }

  const updatePayload = {};
  if (price !== undefined) {
    updatePayload.price = price;
  }
  if (currency) {
    updatePayload.currency = currency;
  }

  return updateOffer(id, updatePayload);
};
