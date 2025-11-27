import mongoose from "mongoose";
import Offer from "../../../models/Offer.js";
import FootballEvent from "../../../models/FootballEvent.js";
import Agent from "../../../models/Agent.js";
import Supplier from "../../../models/Supplier.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
// Cache disabled - always fetch fresh data from DB

/**
 * Get offers by fixture ID (no cache - always fresh data from DB)
 */
export const getOffersByFixtureId = async (fixtureId, query = {}) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting to fetch offers by fixture (no cache - fresh from DB)",
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
    // בדיקת תקינות ObjectId
    if (!mongoose.Types.ObjectId.isValid(fixtureId)) {
      console.error("❌ [DEBUG] Invalid ObjectId format:", fixtureId);
      throw new Error(`Invalid fixtureId format: ${fixtureId}`);
    }

    let fixture = await FootballEvent.findById(fixtureId).lean();

    console.log("🔍 [DEBUG] Raw fixture before populate:", {
      fixtureId,
      fixtureFound: !!fixture,
      fixtureIdType: typeof fixtureId,
      isValidObjectId: mongoose.Types.ObjectId.isValid(fixtureId),
    });

    if (fixture) {
      // שמירת המשחק המקורי לפני populate (למקרה של שגיאה)
      const originalFixture = { ...fixture };

      try {
        fixture = await FootballEvent.findById(fixtureId)
          .populate("homeTeam", "name slug logo logoUrl")
          .populate("awayTeam", "name slug logo logoUrl")
          .populate({
            path: "venue",
            select:
              "name city_en city_he country_en country_he capacity",
          })
          .populate({
            path: "league",
            select: "name nameHe slug country countryHe",
          })
          .lean();

        console.log("🔍 [DEBUG] Fixture after populate:", {
          fixtureFound: !!fixture,
          hasHomeTeam: !!fixture?.homeTeam,
          hasAwayTeam: !!fixture?.awayTeam,
          hasVenue: !!fixture?.venue,
          hasLeague: !!fixture?.league,
        });

        // אם ה-populate החזיר null (לא אמור לקרות), נשתמש במשחק המקורי
        if (!fixture) {
          console.warn(
            "⚠️ [DEBUG] Populate returned null, using original fixture"
          );
          fixture = originalFixture;
        }

        // Convert venue and league to Hebrew format
        if (fixture && fixture.venue) {
          fixture.venue = {
            _id: fixture.venue._id,
            name: fixture.venue.name,
            city: fixture.venue.city_he || fixture.venue.city_en,
            country: fixture.venue.country_he || fixture.venue.country_en,
            capacity: fixture.venue.capacity,
          };
        }

        if (fixture && fixture.league) {
          fixture.league = {
            _id: fixture.league._id,
            name: fixture.league.nameHe || fixture.league.name,
            slug: fixture.league.slug,
            country: fixture.league.countryHe || fixture.league.country,
          };
        }
      } catch (populateError) {
        console.error("❌ [DEBUG] Error during populate:", populateError);
        logError(populateError, {
          operation: "getOffersByFixtureId - populate",
          fixtureId,
        });
        // אם יש שגיאה ב-populate, נשתמש במשחק המקורי (בלי populate)
        fixture = originalFixture;
      }
    } else {
      console.warn("⚠️ [DEBUG] Fixture not found in DB:", {
        fixtureId,
        fixtureIdType: typeof fixtureId,
        isValidObjectId: mongoose.Types.ObjectId.isValid(fixtureId),
      });
    }

    // שליפה ישירה מה-DB (ללא cache - תמיד נתונים טריים)
    let allOffers;
    let fromCache = false;

    // שליפה מה-DB - תמיד ללא cache
    logWithCheckpoint(
      "info",
      "Fetching offers from database (no cache)",
      "OFFER_012_DB",
      { fixtureId }
    );

    allOffers = await Offer.find({ fixtureId })
      .populate({
        path: "ownerId",
        select: "name whatsapp isActive imageUrl agentType companyName logoUrl",
      })
      .lean();

    // מיפוי ownerId ל-agentId/supplierId לתאימות לאחור עם Frontend
    allOffers = allOffers.map((offer) => {
      if (offer.ownerType === "Agent" && offer.ownerId) {
        offer.agentId = offer.ownerId;
      } else if (offer.ownerType === "Supplier" && offer.ownerId) {
        offer.supplierId = offer.ownerId;
      }
      return offer;
    });

    // לא שומרים ב-cache - תמיד נתונים טריים מה-DB
    logWithCheckpoint(
      "info",
      "Offers fetched from DB (no cache used)",
      "OFFER_012_DB_NO_CACHE",
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
