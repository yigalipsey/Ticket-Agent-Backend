import FootballEvent from "../../../models/FootballEvent.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import { validateObjectId } from "../validators/validateFootballQuery.js";
import {
  buildSortObject,
  buildPaginationParams,
} from "../utils/buildFootballEventFilter.js";
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
      page = 1,
      limit = 20,
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

    // month is now optional - if not provided, fetch all fixtures for the league

    if (month && !validateMonthFormat(month)) {
      return createErrorResponse("VALIDATION_INVALID_MONTH_FORMAT");
    }

    const validation = validateFilters({ page, limit });
    if (!validation.isValid) {
      return createErrorResponse(
        "VALIDATION_INVALID_PAGINATION",
        validation.errors.join(", ")
      );
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

      // If month or months are specified, fetch all fixtures without pagination
      // Otherwise, use pagination
      const [fixtures, total] = await Promise.all([
        month || (months && months.length > 0)
          ? FootballEvent.find(filter)
              .populate(
                "league",
                "name name_he country country_he logoUrl slug"
              )
              .populate(
                "homeTeam",
                "name name_he name_en country country_he country_en code slug logoUrl"
              )
              .populate(
                "awayTeam",
                "name name_he name_en country country_he country_en code slug logoUrl"
              )
              .populate(
                "venue",
                "name name_he name_en city city_he city_en country country_he country_en capacity"
              )
              .select("+minPrice")
              .sort(sort)
              .lean()
          : (() => {
              const { skip, limit: limitNum } = buildPaginationParams(
                page,
                limit
              );
              return FootballEvent.find(filter)
                .populate(
                  "league",
                  "name name_he country country_he logoUrl slug"
                )
                .populate(
                  "homeTeam",
                  "name name_he name_en country country_he country_en code slug logoUrl"
                )
                .populate(
                  "awayTeam",
                  "name name_he name_en country country_he country_en code slug logoUrl"
                )
                .populate(
                  "venue",
                  "name name_he name_en city city_he city_en country country_he country_en capacity"
                )
                .select("+minPrice")
                .sort(sort)
                .skip(skip)
                .limit(limitNum)
                .lean();
            })(),
        FootballEvent.countDocuments(filter),
      ]);

      // נרמול נתונים - מיפוי name_he ל-name
      const normalizedFixtures = fixtures.map((fixture) => ({
        ...fixture,
        venue: fixture.venue
          ? {
              ...fixture.venue,
              name: fixture.venue.name_he || fixture.venue.name_en,
              nameHe: fixture.venue.name_he,
              city: fixture.venue.city_he || fixture.venue.city_en,
              country: fixture.venue.country_he || fixture.venue.country_en,
            }
          : null,
      }));

      baseData = {
        fixtures: normalizedFixtures,
        total,
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

    // סינון הנתונים
    let filteredFixtures = [...(baseData.fixtures || [])];

    // פילטר עיר
    if (city) {
      filteredFixtures = filteredFixtures.filter(
        (fixture) =>
          fixture.venue?.city_he?.toLowerCase().includes(city.toLowerCase()) ||
          fixture.venue?.city?.toLowerCase().includes(city.toLowerCase())
      );
    }

    // פילטר משחקים עם הצעות
    if (hasOffers === true || hasOffers === "true") {
      filteredFixtures = filteredFixtures.filter(
        (fixture) => fixture.minPrice?.amount && fixture.minPrice.amount > 0
      );
    }

    // פילטר משחקים עתידיים
    if (upcoming === true || upcoming === "true") {
      const now = new Date();
      filteredFixtures = filteredFixtures.filter(
        (fixture) => new Date(fixture.date) >= now
      );
    }

    // Apply pagination only if month or months are not specified
    const result =
      month || (months && months.length > 0)
        ? {
            data: filteredFixtures, // Return all fixtures when month(s) are specified
            pagination: {
              page: 1,
              limit: filteredFixtures.length,
              total: filteredFixtures.length,
              pages: 1,
            },
          }
        : (() => {
            // Apply pagination when month is not specified
            const startIndex = (page - 1) * limit;
            const endIndex = startIndex + limit;
            const paginatedFixtures = filteredFixtures.slice(
              startIndex,
              endIndex
            );

            return {
              data: paginatedFixtures,
              pagination: {
                page,
                limit,
                total: filteredFixtures.length,
                pages: Math.ceil(filteredFixtures.length / limit),
              },
            };
          })();

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
