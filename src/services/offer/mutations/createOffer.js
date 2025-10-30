import Offer from "../../../models/Offer.js";
import FootballEvent from "../../../models/FootballEvent.js";
import Agent from "../../../models/Agent.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import { refreshOffersCache } from "../utils/cacheHelpers.js";
import offersByFixtureCacheService from "../cache/OffersByFixtureCacheService.js";
import fixturesByTeamCacheService from "../../footballFixtures/cache/FixturesByTeamCacheService.js";
import fixturesByLeagueCacheService from "../../footballFixtures/cache/FixturesByLeagueCacheService.js";
import { getFootballEventsByTeamId } from "../../footballFixtures/queries/byTeam.js";
import { isLowestOffer } from "../utils/offerComparison.js";

/**
 * Create new offer
 */
export const createOffer = async (offerData) => {
  try {
    const {
      fixtureId,
      agentId,
      price,
      currency,
      description,
      source,
      metadata,
    } = offerData;

    // Validate required fields
    if (!fixtureId || !agentId || !price) {
      throw new Error(
        "Missing required fields: fixtureId, agentId, and price are required"
      );
    }

    // Validate fixture exists
    const fixture = await FootballEvent.findById(fixtureId);
    if (!fixture) {
      const error = new Error("Fixture not found");
      error.code = "FIXTURE_NOT_FOUND";
      error.statusCode = 404;
      throw error;
    }

    // Validate agent exists and is active
    const agent = await Agent.findById(agentId);
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

    // Validate price
    if (price <= 0) {
      throw new Error("Price must be greater than 0");
    }

    // Delete any existing offers by this agent for this fixture
    await Offer.deleteMany({ fixtureId, agentId });

    // Create new offer
    const newOffer = new Offer({
      fixtureId,
      agentId,
      price,
      currency: currency || "EUR",
      description,
      source: source || "direct",
      metadata,
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
      // עדכון minPrice של המשחק
      await FootballEvent.findByIdAndUpdate(
        fixtureId,
        {
          "minPrice.amount": price,
          "minPrice.currency": newOfferCurrency,
          "minPrice.updatedAt": new Date(),
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

      // 5. Invalidate cache of fixtures by league
      let leagueCacheInvalidated = 0;
      if (fixture.league) {
        // תמיכה גם ב-ObjectId reference וגם ב-populated object
        const leagueId = fixture.league._id
          ? fixture.league._id.toString()
          : fixture.league.toString();
        leagueCacheInvalidated =
          fixturesByLeagueCacheService.deleteLeague(leagueId);
      }
    }

    // לוג ירוק אחד - האם הקש התרענן והאם זו ההצעה הכי זולה
    logWithCheckpoint("info", "Offer created successfully", "OFFER_CREATED", {
      cacheRefreshed: cacheRefreshResult.success,
      isLowestOffer: comparisonResult.isLowest,
    });

    return savedOffer;
  } catch (error) {
    logError(error, { operation: "createOffer", offerData });
    throw error;
  }
};
