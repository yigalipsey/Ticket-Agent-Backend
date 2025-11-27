import FootballEvent from "../../../models/FootballEvent.js";
import League from "../../../models/League.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import { validateObjectId } from "../validators/validateFootballQuery.js";
import { buildSortObject } from "../utils/buildFootballEventFilter.js";
import {
  buildDateRangeFromMonth,
  validateMonthFormat,
  validateFilters,
} from "../utils/filterUtils.js";
import fixturesByLeagueCacheService from "../cache/FixturesByLeagueCacheService.js";
import { createErrorResponse } from "../../../utils/errorCodes.js";
import { createSuccessResponse } from "../../../utils/successCodes.js";

/**
 * קבלת משחקי ליגה עם cache ופילטרים
 */
export const getLeagueFixturesWithCache = async (leagueId, query = {}) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting league fixtures query with cache",
      "LEAGUE_FIXTURES_001",
      { leagueId, query }
    );

    const {
      month, // אופציונלי - אם לא נשלח, נקבל את כל המשחקים של הליגה
      months, // אופציונלי - array של חודשים (למשל: ["2025-10", "2025-11"])
      city,
      venueId, // פילטר לפי אצטדיון
      hasOffers,
      upcoming = true,
      sortBy = "date",
      sortOrder = "asc",
    } = query;

    // וולידציה
    let validLeagueId;
    try {
      validLeagueId = validateObjectId(leagueId, "League ID");
    } catch (error) {
      return createErrorResponse("VALIDATION_INVALID_LEAGUE_ID", error.message);
    }

    // שליפת פרטי הליגה (כולל מערך החודשים)
    const league = await League.findById(validLeagueId).select("months").lean();
    const leagueMonths = league?.months || [];

    // month is now optional - if not provided, fetch all fixtures for the league

    if (month && !validateMonthFormat(month)) {
      return createErrorResponse("VALIDATION_INVALID_MONTH_FORMAT");
    }

    // בדיקת cache
    // Create cache key that includes month or months and venueId
    const cacheKey =
      month || (months && months.length > 0 ? months.join(",") : null);
    const cachedData = fixturesByLeagueCacheService.get(leagueId, {
      month: cacheKey,
      venueId,
    });

    let baseData;
    if (cachedData) {
      logWithCheckpoint(
        "info",
        "Using cached league fixtures",
        "LEAGUE_FIXTURES_002",
        {
          leagueId,
          month,
          cachedFixturesCount: cachedData.fixtures?.length || 0,
        }
      );
      baseData = cachedData;
    } else {
      // שליפה מה-DB
      logWithCheckpoint(
        "info",
        "Cache miss - fetching from database",
        "LEAGUE_FIXTURES_003",
        { leagueId, month }
      );

      const filter = {
        league: validLeagueId,
      };

      // Add venue filter if provided
      if (venueId) {
        filter.venue = venueId;
        logWithCheckpoint(
          "debug",
          "Added venue filter",
          "LEAGUE_FIXTURES_003.5",
          {
            venueId,
          }
        );
      }

      // Add date filter only if month or months are provided
      if (month) {
        const dateRange = buildDateRangeFromMonth(month);
        filter.date = {
          $gte: dateRange.startDate,
          $lte: dateRange.endDate,
        };
      } else if (months && months.length > 0) {
        // Build date ranges for multiple months
        const dateRanges = months.map((m) => buildDateRangeFromMonth(m));
        const startDates = dateRanges.map((r) => r.startDate);
        const endDates = dateRanges.map((r) => r.endDate);

        filter.date = {
          $gte: new Date(Math.min(...startDates)),
          $lte: new Date(Math.max(...endDates)),
        };
      }

      const sort = buildSortObject(sortBy, sortOrder);

      // Add filters to DB query for better performance
      // פילטר משחקים עתידיים
      if (upcoming === true || upcoming === "true") {
        const now = new Date();
        if (filter.date) {
          // אם יש כבר פילטר תאריך, נשלב אותו
          filter.date = {
            ...filter.date,
            $gte: filter.date.$gte
              ? new Date(Math.max(filter.date.$gte, now))
              : now,
          };
        } else {
          filter.date = { $gte: now };
        }
      }

      // פילטר משחקים עם הצעות
      if (hasOffers === true || hasOffers === "true") {
        filter["minPrice.amount"] = { $exists: true, $gt: 0 };
      }

      // Build base query - no pagination, return all fixtures
      const baseQuery = FootballEvent.find(filter)
        .populate("league", "name logoUrl slug")
        .populate("homeTeam", "name slug logoUrl")
        .populate("awayTeam", "name slug logoUrl")
        .populate("venue", "name city_en city_he")
        .select("+minPrice") // Include minPrice (hidden field)
        .sort(sort);

      // Fetch all fixtures without pagination
      const fixturesRaw = await baseQuery.lean();

      // Remove unnecessary fields from response
      const fixtures = fixturesRaw.map((fixture) => {
        const {
          status,
          round,
          externalIds,
          createdAt,
          updatedAt,
          __v,
          supplierExternalIds,
          ...rest
        } = fixture;
        return rest;
      });

      // Use data as-is from DB - no normalization needed
      baseData = {
        fixtures: fixtures,
        total: fixtures.length,
        leagueId,
        month: month || (months && months.length > 0 ? months.join(",") : null),
      };

      // שמירה ב-cache
      fixturesByLeagueCacheService.set(leagueId, baseData, {
        month: cacheKey,
        venueId,
      });

      logWithCheckpoint(
        "info",
        "Data fetched from database and cached",
        "LEAGUE_FIXTURES_004",
        {
          leagueId,
          month,
          fixturesCount: fixtures.length,
        }
      );
    }

    // סינון הנתונים (רק פילטרים שלא יכולים להיות ב-DB)
    let filteredFixtures = [...(baseData.fixtures || [])];

    // פילטר עיר - צריך להישאר ב-memory כי צריך לבדוק venue.name
    // (לא ניתן לסנן ב-DB לפני populate)
    if (city) {
      filteredFixtures = filteredFixtures.filter((fixture) =>
        fixture.venue?.name?.toLowerCase().includes(city.toLowerCase())
      );
    }

    // Return all fixtures without pagination
    const result = {
      data: filteredFixtures,
      pagination: {
        page: 1,
        limit: filteredFixtures.length,
        total: filteredFixtures.length,
        pages: 1,
      },
    };

    logWithCheckpoint(
      "info",
      "League fixtures query completed",
      "LEAGUE_FIXTURES_005",
      {
        leagueId,
        month,
        originalCount: baseData.fixtures?.length || 0,
        filteredCount: filteredFixtures.length,
        paginatedCount: result.data.length,
        fromCache: !!cachedData,
      }
    );

    return {
      success: true,
      ...result,
      fromCache: !!cachedData,
      cachedAt: cachedData?.cachedAt || new Date(),
      meta: {
        leagueId,
        month,
        originalCount: baseData.fixtures?.length || 0,
        filteredCount: filteredFixtures.length,
        filtersApplied: {
          city: !!city,
          venueId: !!venueId,
          hasOffers: !!hasOffers,
          upcoming: !!upcoming,
        },
      },
    };
  } catch (error) {
    logError(error, {
      operation: "getLeagueFixturesWithCache",
      leagueId,
      query,
    });

    return createErrorResponse("INTERNAL_SERVER_ERROR", error.message);
  }
};

/**
 * קבלת משחקי ליגה לפי חודש (wrapper function)
 */
export const getLeagueFixturesByMonth = async (
  leagueId,
  month,
  additionalQuery = {}
) => {
  const query = {
    ...additionalQuery,
    month,
  };

  return await getLeagueFixturesWithCache(leagueId, query);
};

/**
 * קבלת משחקי ליגה עם הצעות בלבד
 */
export const getLeagueFixturesWithOffers = async (
  leagueId,
  month,
  additionalQuery = {}
) => {
  const query = {
    ...additionalQuery,
    month,
    hasOffers: true,
  };

  return await getLeagueFixturesWithCache(leagueId, query);
};
