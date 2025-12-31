import FootballEvent from "../../../models/FootballEvent.js";
import { getLowestOffer } from "./offerComparison.js";
import fixturesByTeamCacheService from "../../footballFixtures/cache/FixturesByTeamCacheService.js";
import fixturesByLeagueCacheService from "../../footballFixtures/cache/FixturesByLeagueCacheService.js";
import { getFootballEventsByTeamId } from "../../footballFixtures/queries/byTeam.js";
import { getLeagueFixturesWithCache } from "../../footballFixtures/queries/byLeague.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";

/**
 * Centralized service for updating fixture minPrice
 * This service finds the lowest offer for a fixture and updates the fixture's minPrice accordingly
 * It also refreshes relevant caches if minPrice changed
 *
 * @param {string} fixtureId - The fixture ID to update minPrice for
 * @param {Object} options - Optional configuration
 * @param {boolean} options.refreshCache - Whether to refresh fixture caches (default: true)
 * @returns {Promise<Object>} - { updated: boolean, newMinPrice: Object|null, previousMinPrice: Object|null }
 */
export const updateFixtureMinPrice = async (fixtureId, options = {}) => {
  const { refreshCache = true } = options;

  try {
    logWithCheckpoint(
      "info",
      "Starting to update fixture minPrice",
      "MIN_PRICE_UPDATE_001",
      {
        fixtureId,
        refreshCache,
      }
    );

    // 1. Fetch the fixture to get current minPrice
    const fixture = await FootballEvent.findById(fixtureId).lean();

    if (!fixture) {
      logWithCheckpoint(
        "warn",
        "Fixture not found for minPrice update",
        "MIN_PRICE_UPDATE_002",
        {
          fixtureId,
        }
      );
      return {
        updated: false,
        newMinPrice: null,
        previousMinPrice: null,
        error: "Fixture not found",
      };
    }

    const previousMinPrice = fixture.minPrice
      ? {
          amount: fixture.minPrice.amount,
          currency: fixture.minPrice.currency,
        }
      : null;

    // 2. Find the lowest offer for this fixture
    const lowestOfferResult = await getLowestOffer(fixtureId);

    let minPriceUpdated = false;
    let newMinPrice = null;

    if (lowestOfferResult && lowestOfferResult.offer) {
      // יש הצעה הכי זולה חדשה
      const newMinPriceAmount = lowestOfferResult.offer.price;
      const newMinPriceCurrency = lowestOfferResult.offer.currency;

      // בדיקה אם minPrice הנוכחי שונה מהחדש
      const currentMinPrice = fixture.minPrice?.amount;
      const currentMinCurrency = fixture.minPrice?.currency;

      if (
        currentMinPrice !== newMinPriceAmount ||
        currentMinCurrency !== newMinPriceCurrency
      ) {
        // עדכון minPrice - שימוש ב-$set עם מבנה מלא כדי לטפל במקרה ש-minPrice הוא null
        await FootballEvent.findByIdAndUpdate(
          fixtureId,
          {
            $set: {
              minPrice: {
                amount: newMinPriceAmount,
                currency: newMinPriceCurrency,
                updatedAt: new Date(),
              },
            },
          },
          { new: true }
        );
        minPriceUpdated = true;
        newMinPrice = {
          amount: newMinPriceAmount,
          currency: newMinPriceCurrency,
        };

        logWithCheckpoint(
          "info",
          "Fixture minPrice updated",
          "MIN_PRICE_UPDATE_003",
          {
            fixtureId,
            previousMinPrice,
            newMinPrice,
          }
        );
      } else {
        logWithCheckpoint(
          "info",
          "Fixture minPrice unchanged",
          "MIN_PRICE_UPDATE_004",
          {
            fixtureId,
            currentMinPrice: {
              amount: currentMinPrice,
              currency: currentMinCurrency,
            },
            lowestOfferPrice: {
              amount: newMinPriceAmount,
              currency: newMinPriceCurrency,
            },
          }
        );
      }
    } else {
      // אין עוד הצעות - ניקוי minPrice אם הוא קיים
      if (fixture.minPrice) {
        await FootballEvent.findByIdAndUpdate(
          fixtureId,
          {
            $unset: { minPrice: "" },
          },
          { new: true }
        );
        minPriceUpdated = true;
        newMinPrice = null;

        logWithCheckpoint(
          "info",
          "Fixture minPrice cleared (no offers)",
          "MIN_PRICE_UPDATE_005",
          {
            fixtureId,
            previousMinPrice,
          }
        );
      } else {
        logWithCheckpoint(
          "info",
          "Fixture minPrice already cleared",
          "MIN_PRICE_UPDATE_006",
          {
            fixtureId,
          }
        );
      }
    }

    // 3. אם minPrice התעדכן ו-refreshCache הוא true - רענון caches של fixtures
    let teamsCacheRefreshed = 0;
    let leagueCacheRefreshed = 0;

    if (minPriceUpdated && refreshCache) {
      // Refresh cache of fixtures by team (homeTeam and awayTeam)
      if (fixture.homeTeam) {
        const homeTeamId = fixture.homeTeam._id
          ? fixture.homeTeam._id.toString()
          : fixture.homeTeam.toString();

        fixturesByTeamCacheService.delete(homeTeamId);

        const refreshedData = await getFootballEventsByTeamId(homeTeamId, {
          limit: "1000",
        });

        if (refreshedData && refreshedData.success !== false) {
          teamsCacheRefreshed++;
        }
      }

      if (fixture.awayTeam) {
        const awayTeamId = fixture.awayTeam._id
          ? fixture.awayTeam._id.toString()
          : fixture.awayTeam.toString();

        fixturesByTeamCacheService.delete(awayTeamId);

        const refreshedData = await getFootballEventsByTeamId(awayTeamId, {
          limit: "1000",
        });

        if (refreshedData && refreshedData.success !== false) {
          teamsCacheRefreshed++;
        }
      }

      // Refresh cache of fixtures by league
      if (fixture.league) {
        const leagueId = fixture.league._id
          ? fixture.league._id.toString()
          : fixture.league.toString();

        fixturesByLeagueCacheService.deleteLeague(leagueId);

        const refreshedData = await getLeagueFixturesWithCache(leagueId, {
          limit: "1000",
        });

        if (refreshedData && refreshedData.success !== false) {
          leagueCacheRefreshed = 1;
        }
      }

      logWithCheckpoint(
        "info",
        "Fixture caches refreshed after minPrice update",
        "MIN_PRICE_UPDATE_007",
        {
          fixtureId,
          teamsCacheRefreshed,
          leagueCacheRefreshed,
        }
      );
    }

    return {
      updated: minPriceUpdated,
      newMinPrice,
      previousMinPrice,
      teamsCacheRefreshed,
      leagueCacheRefreshed,
    };
  } catch (error) {
    logError(error, {
      operation: "updateFixtureMinPrice",
      fixtureId,
    });
    throw error;
  }
};








