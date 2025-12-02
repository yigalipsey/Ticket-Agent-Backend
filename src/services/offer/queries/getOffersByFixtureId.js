import mongoose from "mongoose";
import FootballEvent from "../../../models/FootballEvent.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import AgentOfferService from "../agent/AgentOfferService.js";
import SupplierApiService from "../suppliers/SupplierApiService.js";
import { formatOfferForResponse } from "../utils/offerMapper.js";
import { getExchangeRate } from "../../../utils/exchangeRate.js";
// Cache disabled - always fetch fresh data from DB or supplier APIs

const parseBoolean = (value, defaultValue) => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "true") return true;
    if (normalized === "false") return false;
  }

  return defaultValue;
};

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
      forceRefresh = false,
    } = query;

    const numericPage = Number.isNaN(Number(page)) ? 1 : parseInt(page, 10);
    const numericLimit = Number.isNaN(Number(limit)) ? 20 : parseInt(limit, 10);
    const normalizedIsAvailable = parseBoolean(isAvailable, true);
    const normalizedForceRefresh = parseBoolean(forceRefresh, false);

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
            select: "name city_en city_he country_en country_he capacity",
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

    // שליפה מה-DB (Agents) + קריאה ל-API (Suppliers)
    logWithCheckpoint(
      "info",
      "Fetching agent/supplier offers (live suppliers refreshed)",
      "OFFER_012_DB",
      { fixtureId, forceRefresh: normalizedForceRefresh }
    );

    const [agentOffers, supplierOffers] = await Promise.all([
      AgentOfferService.getOffersByFixture(fixtureId),
      SupplierApiService.getOffersByFixture(fixture, {
        forceRefresh: normalizedForceRefresh,
        fixtureId,
      }),
    ]);

    let allOffers = [...agentOffers, ...supplierOffers];

    logWithCheckpoint(
      "info",
      "Offers fetched (including supplier APIs)",
      "OFFER_012_DB_NO_CACHE",
      {
        fixtureId,
        totalOffers: allOffers.length,
        agentOffers: agentOffers.length,
        supplierOffers: supplierOffers.length,
      }
    );

    // פילטור והחלת pagination על הנתונים
    let offersForSorting = allOffers;

    if (sortBy === "price") {
      offersForSorting = await Promise.all(
        allOffers.map(async (offer) => {
          if (!offer?.currency || offer.currency === "EUR") {
            return {
              ...offer,
              _priceSortValue: Number.isFinite(offer.price)
                ? offer.price
                : Number.MAX_SAFE_INTEGER,
            };
          }

          try {
            const rate = await getExchangeRate(offer.currency, "EUR");
            return {
              ...offer,
              _priceSortValue: Number.isFinite(rate)
                ? offer.price * rate
                : offer.price,
            };
          } catch (error) {
            logError(error, {
              operation: "convertOfferPriceForSorting",
              offerId: offer._id,
              currency: offer.currency,
            });
            return {
              ...offer,
              _priceSortValue: offer.price,
            };
          }
        })
      );
    }

    let filteredOffers = offersForSorting;
    if (typeof normalizedIsAvailable === "boolean") {
      filteredOffers = filteredOffers.filter(
        (offer) => offer.isAvailable === normalizedIsAvailable
      );
    }

    // מיון
    filteredOffers.sort((a, b) => {
      let aValue = a[sortBy];
      let bValue = b[sortBy];

      if (sortBy === "price") {
        aValue = a._priceSortValue ?? a.price;
        bValue = b._priceSortValue ?? b.price;
      }

      if (sortOrder === "asc") {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    const total = filteredOffers.length;
    const skip = (numericPage - 1) * numericLimit;
    const paginatedOffers = filteredOffers.slice(skip, skip + numericLimit);
    const responseOffers = paginatedOffers.map(formatOfferForResponse);

    logWithCheckpoint(
      "info",
      "Successfully fetched offers by fixture",
      "OFFER_013",
      {
        fixtureId,
        count: paginatedOffers.length,
        total,
        fromCache: false,
        hasFixture: !!fixture,
      }
    );

    const selectHebrewName = (entity) => {
      if (!entity) return null;
      return (
        entity.name_he ||
        entity.nameHe ||
        entity.name ||
        entity.name_en ||
        entity.nameEn ||
        null
      );
    };

    const extractLogo = (entity) => {
      if (!entity) return null;
      return entity.logoUrl || entity.logo || entity.imageUrl || null;
    };

    const responseFixture = fixture
      ? {
          _id: fixture._id,
          date: fixture.date,
          homeTeam: fixture.homeTeam
            ? {
                name: selectHebrewName(fixture.homeTeam),
                logoUrl: extractLogo(fixture.homeTeam),
              }
            : null,
          awayTeam: fixture.awayTeam
            ? {
                name: selectHebrewName(fixture.awayTeam),
                logoUrl: extractLogo(fixture.awayTeam),
              }
            : null,
          venue: fixture.venue
            ? {
                name:
                  fixture.venue.name_he ||
                  fixture.venue.name ||
                  fixture.venue.name_en ||
                  null,
                city:
                  fixture.venue.city_he ||
                  fixture.venue.city ||
                  fixture.venue.city_en ||
                  null,
              }
            : null,
          league: fixture.league
            ? {
                name:
                  fixture.league.nameHe ||
                  fixture.league.name_he ||
                  fixture.league.name ||
                  null,
              }
            : null,
        }
      : null;

    return {
      offers: responseOffers,
      fixture: responseFixture,
      pagination: {
        page: numericPage,
        limit: numericLimit,
        total,
        pages: Math.ceil(total / numericLimit),
      },
      fromCache: false,
    };
  } catch (error) {
    logError(error, { operation: "getOffersByFixtureId", fixtureId, query });
    throw error;
  }
};
