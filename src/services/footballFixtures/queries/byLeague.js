import FootballEvent from "../../../models/FootballEvent.js";
import League from "../../../models/League.js";
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
import leagueCacheService from "../cache/LeagueCacheService.js";

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
      throw new Error(`Invalid leagueId format: ${error.message}`);
    }

    // month is now optional - if not provided, fetch all fixtures for the league

    if (month && !validateMonthFormat(month)) {
      throw new Error("Invalid month format. Use YYYY-MM");
    }

    const validation = validateFilters({ page, limit });
    if (!validation.isValid) {
      throw new Error(validation.errors.join(", "));
    }

    // בדיקת cache
    // Create cache key that includes month or months
    const cacheKey =
      month || (months && months.length > 0 ? months.join(",") : null);
    const cachedData = leagueCacheService.get(leagueId, cacheKey);

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

      baseData = {
        fixtures,
        total,
        leagueId,
        month: month || (months && months.length > 0 ? months.join(",") : null),
      };

      // שמירה ב-cache
      leagueCacheService.set(leagueId, cacheKey, baseData);

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
    throw error;
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

// שמירה על הפונקציה הישנה לתאימות לאחור
export const getFootballEventsByLeagueId = async (leagueId, query = {}) => {
  // אם יש month parameter, השתמש ב-cache
  if (query.month) {
    return await getLeagueFixturesWithCache(leagueId, query);
  }

  // אחרת, השתמש בלוגיקה הישנה
  try {
    logWithCheckpoint(
      "info",
      "Starting to fetch football events by league (legacy)",
      "FOOTBALL_019",
      { leagueId, query }
    );

    const validLeagueId = validateObjectId(leagueId, "League ID");

    const {
      page = 1,
      limit = 20,
      season,
      teamId,
      venue,
      sortBy = "date",
      sortOrder = "asc",
      status,
      round,
      upcoming = undefined,
    } = query;

    // Build filter object
    const filter = {
      league: validLeagueId,
    };

    // Check if league exists in database first
    const leagueExists = await League.findById(validLeagueId).lean();

    if (season) {
      filter.season = season;
    }

    if (teamId) {
      filter.$or = [{ homeTeam: teamId }, { awayTeam: teamId }];
    }

    if (venue) {
      filter.venue = venue;
    }

    if (status) {
      filter.status = status;
    }

    if (round) {
      filter.round = round;
    }

    // Filter by date (upcoming or past)
    if (upcoming === "true" || upcoming === true) {
      filter.date = { $gte: new Date() };
    } else if (upcoming === "false" || upcoming === false) {
      filter.date = { $lt: new Date() };
    }

    // Build sort object
    const sort = buildSortObject(sortBy, sortOrder);
    const { skip, limit: limitNum } = buildPaginationParams(page, limit);

    const [footballEvents, total] = await Promise.all([
      FootballEvent.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate("league", "name name_he country country_he logoUrl slug")
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
        .lean(),
      FootballEvent.countDocuments(filter),
    ]);

    logWithCheckpoint(
      "info",
      "Successfully fetched football events by league (legacy)",
      "FOOTBALL_020",
      {
        leagueId,
        count: footballEvents.length,
        total,
      }
    );

    return {
      fixtures: footballEvents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  } catch (error) {
    logError(error, {
      operation: "getFootballEventsByLeagueId",
      leagueId,
      query,
    });
    throw error;
  }
};
