import Offer from "../../../models/Offer.js";
import FootballEvent from "../../../models/FootballEvent.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import { refreshOffersCache } from "../utils/cacheHelpers.js";
import { getLowestOffer } from "../utils/offerComparison.js";
import fixturesByTeamCacheService from "../../footballFixtures/cache/FixturesByTeamCacheService.js";
import fixturesByLeagueCacheService from "../../footballFixtures/cache/FixturesByLeagueCacheService.js";
import { getFootballEventsByTeamId } from "../../footballFixtures/queries/byTeam.js";
import { getLeagueFixturesWithCache } from "../../footballFixtures/queries/byLeague.js";

/**
 * Delete offer
 */
export const deleteOffer = async (id) => {
  try {
    logWithCheckpoint("info", "Starting to delete offer", "OFFER_023", {
      id,
    });

    // שליפת ההצעה לפני מחיקה כדי לקבל את fixtureId
    const offer = await Offer.findById(id);

    if (!offer) {
      logWithCheckpoint("warn", "Offer not found for deletion", "OFFER_024", {
        id,
      });
      return null;
    }

    const fixtureId = offer.fixtureId;

    // שליפת פרטי המשחק לפני מחיקה
    const fixture = await FootballEvent.findById(fixtureId);

    if (!fixture) {
      logWithCheckpoint(
        "warn",
        "Fixture not found for offer deletion",
        "OFFER_026",
        {
          id,
          fixtureId,
        }
      );
      // מוחקים את ההצעה בכל מקרה
      await Offer.findByIdAndDelete(id);
      return offer;
    }

    // חילוץ IDs בתחילת הפונקציה כדי לא לקרוא שוב ושוב
    const homeTeamId = fixture.homeTeam?._id
      ? fixture.homeTeam._id.toString()
      : fixture.homeTeam?.toString();
    const awayTeamId = fixture.awayTeam?._id
      ? fixture.awayTeam._id.toString()
      : fixture.awayTeam?.toString();
    const leagueId = fixture.league?._id
      ? fixture.league._id.toString()
      : fixture.league?.toString();

    // מחיקת ההצעה
    await Offer.findByIdAndDelete(id);

    // 1. Refresh cache of offers for this fixture
    const cacheRefreshResult = await refreshOffersCache(fixtureId);

    // 2. מציאת ההצעה הכי זולה החדשה (לאחר המחיקה)
    const lowestOfferResult = await getLowestOffer(fixtureId);

    // 3. בדיקה אם צריך לעדכן את minPrice
    let minPriceUpdated = false;

    if (lowestOfferResult && lowestOfferResult.offer) {
      // יש הצעה הכי זולה חדשה
      const newMinPrice = lowestOfferResult.offer.price;
      const newMinCurrency = lowestOfferResult.offer.currency;

      // בדיקה אם minPrice הנוכחי שונה מהחדש
      const currentMinPrice = fixture.minPrice?.amount;
      const currentMinCurrency = fixture.minPrice?.currency;

      if (
        currentMinPrice !== newMinPrice ||
        currentMinCurrency !== newMinCurrency
      ) {
        // עדכון minPrice
        await FootballEvent.findByIdAndUpdate(
          fixtureId,
          {
            "minPrice.amount": newMinPrice,
            "minPrice.currency": newMinCurrency,
            "minPrice.updatedAt": new Date(),
          },
          { new: true }
        );
        minPriceUpdated = true;
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
      }
    }

    // 4. אם minPrice התעדכן - רענון caches של fixtures
    let teamsCacheRefreshed = 0;
    let leagueCacheRefreshed = 0;

    if (minPriceUpdated) {
      // Refresh cache of fixtures by team (homeTeam and awayTeam)
      if (homeTeamId) {
        fixturesByTeamCacheService.delete(homeTeamId);
        const refreshedData = await getFootballEventsByTeamId(homeTeamId, {
          limit: "1000",
        });
        if (refreshedData && refreshedData.success !== false) {
          teamsCacheRefreshed++;
        }
      }

      if (awayTeamId) {
        fixturesByTeamCacheService.delete(awayTeamId);
        const refreshedData = await getFootballEventsByTeamId(awayTeamId, {
          limit: "1000",
        });
        if (refreshedData && refreshedData.success !== false) {
          teamsCacheRefreshed++;
        }
      }

      // Refresh cache of fixtures by league
      if (leagueId) {
        fixturesByLeagueCacheService.deleteLeague(leagueId);

        // שליפה מחדש מה-DB
        const refreshedData = await getLeagueFixturesWithCache(leagueId, {
          limit: "1000",
        });

        if (refreshedData && refreshedData.success !== false) {
          leagueCacheRefreshed = 1;
        }
      }
    }

    logWithCheckpoint("info", "Successfully deleted offer", "OFFER_025", {
      id,
      fixtureId,
      cacheRefreshed: cacheRefreshResult.success,
      minPriceUpdated,
      teamsCacheRefreshed,
      leagueCacheRefreshed,
      newLowestOffer: lowestOfferResult
        ? {
            price: lowestOfferResult.offer.price,
            currency: lowestOfferResult.offer.currency,
          }
        : null,
    });

    return offer;
  } catch (error) {
    logError(error, { operation: "deleteOffer", id });
    throw error;
  }
};
