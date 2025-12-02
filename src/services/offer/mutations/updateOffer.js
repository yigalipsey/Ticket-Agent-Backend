import Offer from "../../../models/Offer.js";
import FootballEvent from "../../../models/FootballEvent.js";
import Agent from "../../../models/Agent.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import { refreshOffersCache } from "../utils/cacheHelpers.js";
import fixturesByTeamCacheService from "../../footballFixtures/cache/FixturesByTeamCacheService.js";
import fixturesByLeagueCacheService from "../../footballFixtures/cache/FixturesByLeagueCacheService.js";
import { getFootballEventsByTeamId } from "../../footballFixtures/queries/byTeam.js";
import { getLeagueFixturesWithCache } from "../../footballFixtures/queries/byLeague.js";
import { getLowestOffer } from "../utils/offerComparison.js";

const refreshTeamFixturesCache = async (team) => {
  if (!team) {
    return false;
  }

  const teamId = team._id ? team._id.toString() : team.toString();
  fixturesByTeamCacheService.delete(teamId);

  const refreshedData = await getFootballEventsByTeamId(teamId, {
    limit: "1000",
  });

  return refreshedData && refreshedData.success !== false;
};

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

    // 2. מציאת ההצעה הכי זולה החדשה (לאחר העדכון)
    const lowestOfferResult = await getLowestOffer(fixtureId);

    // 3. בדיקה אם צריך לעדכן את minPrice
    let minPriceUpdated = false;

    if (lowestOfferResult && lowestOfferResult.offer) {
      // יש הצעה הכי זולה חדשה
      const newMinPrice = lowestOfferResult.offer.price;
      const newMinCurrency = lowestOfferResult.offer.currency;

      // בדיקה אם minPrice הנוכחי שונה מהחדש
      const currentMinPrice = fixture?.minPrice?.amount;
      const currentMinCurrency = fixture?.minPrice?.currency;

      if (
        currentMinPrice !== newMinPrice ||
        currentMinCurrency !== newMinCurrency
      ) {
        // עדכון minPrice - שימוש ב-$set עם מבנה מלא כדי לטפל במקרה ש-minPrice הוא null
        await FootballEvent.findByIdAndUpdate(
          fixtureId,
          {
            $set: {
              minPrice: {
                amount: newMinPrice,
                currency: newMinCurrency,
                updatedAt: new Date(),
              },
            },
          },
          { new: true }
        );
        minPriceUpdated = true;
      }
    } else {
      // אין עוד הצעות - ניקוי minPrice אם הוא קיים
      if (fixture?.minPrice) {
        await FootballEvent.findByIdAndUpdate(
          fixtureId,
          {
            $unset: { minPrice: "" },
          },
          { new: true }
        );
        minPriceUpdated = true;
      }
    }

    // 4. אם minPrice התעדכן או שהמחיר/מטבע של ההצעה השתנו - רענון caches של fixtures
    if (minPriceUpdated) {
      // Refresh cache of fixtures by team (homeTeam and awayTeam)
      let teamsCacheRefreshed = 0;
      if (await refreshTeamFixturesCache(fixture?.homeTeam)) {
        teamsCacheRefreshed++;
      }

      if (await refreshTeamFixturesCache(fixture?.awayTeam)) {
        teamsCacheRefreshed++;
      }

      // Refresh cache of fixtures by league
      let leagueCacheRefreshed = 0;
      if (fixture?.league) {
        const leagueId = fixture.league._id
          ? fixture.league._id.toString()
          : fixture.league.toString();

        // מחיקת cache כדי לכפות שליפה מחדש מה-DB
        fixturesByLeagueCacheService.deleteLeague(leagueId);

        // שליפה מחדש מה-DB
        const refreshedData = await getLeagueFixturesWithCache(leagueId, {
          limit: "1000",
        });

        if (refreshedData && refreshedData.success !== false) {
          leagueCacheRefreshed = 1;
        }
      }

      logWithCheckpoint(
        "info",
        "Offer updated successfully with cache invalidation",
        "OFFER_UPDATE_004",
        {
          id,
          fixtureId,
          cacheRefreshed: cacheRefreshResult.success,
          minPriceUpdated,
          teamsCacheRefreshed,
          leagueCacheRefreshed,
          oldPrice,
          newPrice: updatedOffer.price,
          oldCurrency,
          newCurrency: updatedOffer.currency,
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
