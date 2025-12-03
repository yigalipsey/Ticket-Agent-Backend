import Offer from "../../../models/Offer.js";
import FootballEvent from "../../../models/FootballEvent.js";
import Agent from "../../../models/Agent.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import { refreshOffersCache } from "../utils/cacheHelpers.js";
import offersByFixtureCacheService from "../cache/OffersByFixtureCacheService.js";
import fixturesByTeamCacheService from "../../footballFixtures/cache/FixturesByTeamCacheService.js";
import fixturesByLeagueCacheService from "../../footballFixtures/cache/FixturesByLeagueCacheService.js";
import { getFootballEventsByTeamId } from "../../footballFixtures/queries/byTeam.js";
import { getLeagueFixturesWithCache } from "../../footballFixtures/queries/byLeague.js";
import { isLowestOffer } from "../utils/offerComparison.js";

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

    // Delete any existing offers by this owner for this fixture
    // Unique constraint: { fixtureId, ownerId } - only one offer per owner per fixture
    await Offer.deleteMany({
      fixtureId,
      ownerId: finalOwnerId,
      ownerType: finalOwnerType,
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

    // 2. בדיקה אם ההצעה החדשה היא הכי נמוכה
    const newOfferCurrency = currency || "EUR";
    const comparisonResult = await isLowestOffer(
      {
        price,
        currency: newOfferCurrency,
      },
      fixtureId
    );

    // 3. רק אם ההצעה היא הכי נמוכה - עדכון minPrice ואיפוס cache
    if (comparisonResult.isLowest) {
      // עדכון minPrice של המשחק - שימוש ב-$set עם מבנה מלא כדי לטפל במקרה ש-minPrice הוא null
      await FootballEvent.findByIdAndUpdate(
        fixtureId,
        {
          $set: {
            minPrice: {
              amount: price,
              currency: newOfferCurrency,
              updatedAt: new Date(),
            },
          },
        },
        { new: true }
      );

      // 4. Refresh cache of fixtures by team (homeTeam and awayTeam)
      // כי minPrice של המשחק יכול להשתנות - שליפה מחדש מה-DB ועדכון cache
      let teamsCacheRefreshed = 0;
      if (fixture.homeTeam) {
        // תמיכה גם ב-ObjectId reference וגם ב-populated object
        const homeTeamId = fixture.homeTeam._id
          ? fixture.homeTeam._id.toString()
          : fixture.homeTeam.toString();

        // מחיקת cache כדי לכפות שליפה מחדש מה-DB
        fixturesByTeamCacheService.delete(homeTeamId);

        // שליפה מחדש מה-DB - getFootballEventsByTeamId ישלוף וישמור ב-cache מחדש
        const refreshedData = await getFootballEventsByTeamId(homeTeamId, {
          limit: "1000",
        });

        if (refreshedData && refreshedData.success !== false) {
          teamsCacheRefreshed++;
        }
      }
      if (fixture.awayTeam) {
        // תמיכה גם ב-ObjectId reference וגם ב-populated object
        const awayTeamId = fixture.awayTeam._id
          ? fixture.awayTeam._id.toString()
          : fixture.awayTeam.toString();

        // מחיקת cache כדי לכפות שליפה מחדש מה-DB
        fixturesByTeamCacheService.delete(awayTeamId);

        // שליפה מחדש מה-DB - getFootballEventsByTeamId ישלוף וישמור ב-cache מחדש
        const refreshedData = await getFootballEventsByTeamId(awayTeamId, {
          limit: "1000",
        });

        if (refreshedData && refreshedData.success !== false) {
          teamsCacheRefreshed++;
        }
      }

      // 5. Refresh cache of fixtures by league
      let leagueCacheRefreshed = 0;
      if (fixture.league) {
        // תמיכה גם ב-ObjectId reference וגם ב-populated object
        const leagueId = fixture.league._id
          ? fixture.league._id.toString()
          : fixture.league.toString();

        // מחיקת cache כדי לכפות שליפה מחדש מה-DB
        fixturesByLeagueCacheService.deleteLeague(leagueId);

        // שליפה מחדש מה-DB - getLeagueFixturesWithCache ישלוף וישמור ב-cache מחדש
        const refreshedData = await getLeagueFixturesWithCache(leagueId, {
          limit: "1000",
        });

        if (refreshedData && refreshedData.success !== false) {
          leagueCacheRefreshed = 1;
        }
      }
    }

    // לוג ירוק אחד - האם הקש התרענן והאם זו ההצעה הכי זולה
    logWithCheckpoint("info", "Offer created successfully", "OFFER_CREATED", {
      cacheRefreshed: cacheRefreshResult.success,
      isLowestOffer: comparisonResult.isLowest,
      teamsCacheRefreshed: comparisonResult.isLowest ? teamsCacheRefreshed : 0,
      leagueCacheRefreshed: comparisonResult.isLowest
        ? leagueCacheRefreshed
        : 0,
    });

    return savedOffer;
  } catch (error) {
    logError(error, { operation: "createOffer", offerData });
    throw error;
  }
};
