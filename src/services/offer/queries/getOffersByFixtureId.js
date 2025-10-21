import Offer from "../../../models/Offer.js";
import FootballEvent from "../../../models/FootballEvent.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import offersByFixtureCacheService from "../cache/OffersByFixtureCacheService.js";

/**
 * Get offers by fixture ID with cache support
 */
export const getOffersByFixtureId = async (fixtureId, query = {}) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting to fetch offers by fixture with cache",
      "OFFER_012",
      {
        fixtureId,
        query,
      }
    );

    const {
      page = 1,
      limit = 20,
      isAvailable = true,
      sortBy = "price",
      sortOrder = "asc",
    } = query;

    // שליפת פרטי המשחק תמיד (query קל ומהיר)
    let fixture = await FootballEvent.findById(fixtureId).lean();

    console.log("🔍 [DEBUG] Raw fixture before populate:", fixture);

    if (fixture) {
      fixture = await FootballEvent.findById(fixtureId)
        .populate("homeTeam", "name slug logo logoUrl")
        .populate("awayTeam", "name slug logo logoUrl")
        .populate("venue", "name city country capacity")
        .populate("league", "name slug country")
        .lean();

      console.log("🔍 [DEBUG] Fixture after populate:", fixture);
    }

    // שליפה ישירה מה-DB (ללא cache זמנית)
    let allOffers;
    let fromCache = false;

    // שליפה מה-DB
    logWithCheckpoint(
      "info",
      "Cache miss - fetching offers from database",
      "OFFER_012_DB",
      { fixtureId }
    );

    allOffers = await Offer.find({ fixtureId })
      .populate("agentId", "name whatsapp isActive")
      .lean();

    // שמירה ב-cache
    offersByFixtureCacheService.set(fixtureId, { allOffers });

    logWithCheckpoint(
      "info",
      "Offers fetched from DB and cached",
      "OFFER_012_DB_CACHED",
      {
        fixtureId,
        offersCount: allOffers.length,
      }
    );

    // פילטור והחלת pagination על הנתונים
    let filteredOffers = allOffers.filter(
      (offer) => offer.isAvailable === isAvailable
    );

    // מיון
    filteredOffers.sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    const total = filteredOffers.length;
    const skip = (page - 1) * limit;
    const paginatedOffers = filteredOffers.slice(skip, skip + parseInt(limit));

    logWithCheckpoint(
      "info",
      "Successfully fetched offers by fixture",
      "OFFER_013",
      {
        fixtureId,
        count: paginatedOffers.length,
        total,
        fromCache,
        hasFixture: !!fixture,
      }
    );

    return {
      offers: paginatedOffers,
      fixture: fixture || null,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
      fromCache,
    };
  } catch (error) {
    logError(error, { operation: "getOffersByFixtureId", fixtureId, query });
    throw error;
  }
};
