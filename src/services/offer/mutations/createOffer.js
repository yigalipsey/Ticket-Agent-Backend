import Offer from "../../../models/Offer.js";
import FootballEvent from "../../../models/FootballEvent.js";
import Agent from "../../../models/Agent.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import { refreshOffersCache } from "../utils/cacheHelpers.js";
import { updateFixtureMinPrice } from "../utils/fixtureMinPriceService.js";

/**
 * Create new offer
 */
export const createOffer = async (offerData) => {
  try {
    const {
      fixtureId,
      agentId,
      ownerType,
      ownerId,
      price,
      currency,
      ticketType = "standard",
      notes,
      source,
      metadata,
      url,
    } = offerData;

    const sanitizedUrl =
      typeof url === "string" && url.trim().length > 0 ? url.trim() : undefined;

    // Determine ownerType and ownerId
    // Support both old format (agentId) and new format (ownerType + ownerId)
    const finalOwnerType = ownerType || (agentId ? "Agent" : null);
    const finalOwnerId = ownerId || agentId;

    // Validate required fields
    if (!fixtureId || !finalOwnerId || !price) {
      throw new Error(
        "Missing required fields: fixtureId, ownerId (or agentId), and price are required"
      );
    }

    if (!finalOwnerType) {
      throw new Error("ownerType is required (must be 'Agent' or 'Supplier')");
    }

    // Validate fixture exists
    const fixture = await FootballEvent.findById(fixtureId);
    if (!fixture) {
      const error = new Error("Fixture not found");
      error.code = "FIXTURE_NOT_FOUND";
      error.statusCode = 404;
      throw error;
    }

    // Validate owner exists and is active
    if (finalOwnerType === "Agent") {
      const agent = await Agent.findById(finalOwnerId);
      if (!agent) {
        const error = new Error("Agent not found");
        error.code = "AGENT_NOT_FOUND";
        error.statusCode = 404;
        throw error;
      }
      if (!agent.isActive) {
        const error = new Error("Agent is not active");
        error.code = "AGENT_INACTIVE";
        error.statusCode = 403;
        throw error;
      }
    }
    // TODO: Add Supplier validation if needed

    // Validate price
    if (price <= 0) {
      throw new Error("Price must be greater than 0");
    }

    // Validate ticketType
    if (!["standard", "vip"].includes(ticketType)) {
      throw new Error("ticketType must be 'standard' or 'vip'");
    }

    // Delete any existing offers by this owner for this fixture with the same ticketType
    // Unique constraint: { fixtureId, ownerId, ticketType } - allows both standard and vip
    await Offer.deleteMany({
      fixtureId,
      ownerId: finalOwnerId,
      ownerType: finalOwnerType,
      ticketType,
    });

    // Create new offer
    const newOffer = new Offer({
      fixtureId,
      ownerType: finalOwnerType,
      ownerId: finalOwnerId,
      price,
      currency: currency || "EUR",
      ticketType,
      notes,
      source: source || "p1",
      metadata,
      url: sanitizedUrl,
      isAvailable: true,
    });

    const savedOffer = await newOffer.save();

    // 1. Refresh cache of offers for this fixture
    const cacheRefreshResult = await refreshOffersCache(fixtureId);

    // 2. עדכון minPrice של המשחק באמצעות השירות המרכזי
    const minPriceUpdateResult = await updateFixtureMinPrice(fixtureId, {
      refreshCache: true,
    });

    // לוג ירוק אחד - האם הקש התרענן והאם minPrice התעדכן
    logWithCheckpoint("info", "Offer created successfully", "OFFER_CREATED", {
      cacheRefreshed: cacheRefreshResult.success,
      minPriceUpdated: minPriceUpdateResult.updated,
      teamsCacheRefreshed: minPriceUpdateResult.teamsCacheRefreshed || 0,
      leagueCacheRefreshed: minPriceUpdateResult.leagueCacheRefreshed || 0,
    });

    return savedOffer;
  } catch (error) {
    logError(error, { operation: "createOffer", offerData });
    throw error;
  }
};
