import FootballEvent from "../../../models/FootballEvent.js";
import Team from "../../../models/Team.js";
import { logWithCheckpoint, logError } from "../../../utils/logger.js";
import {
  validateObjectId,
  validateSlug,
} from "../validators/validateFootballQuery.js";
import {
  buildFootballEventFilter,
  buildSortObject,
  buildPaginationParams,
  buildPopulateOptions,
} from "../utils/buildFootballEventFilter.js";
import { createErrorResponse } from "../../../utils/errorCodes.js";
import fixturesByTeamCacheService from "../cache/FixturesByTeamCacheService.js";

// Get football events by team ID with cache
export const getFootballEventsByTeamId = async (teamId, query = {}) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting to fetch football events by team with cache",
      "FOOTBALL_007",
      { teamId, query }
    );

    let validTeamId;
    try {
      validTeamId = validateObjectId(teamId, "Team ID");
    } catch (error) {
      return createErrorResponse("VALIDATION_INVALID_TEAM_ID", error.message);
    }

    // קורא את hasOffers לפני בדיקת cache (לסינון בעת הצורך)
    const { hasOffers } = query;

    // בדיקת cache
    const cachedData = fixturesByTeamCacheService.get(teamId);

    if (cachedData) {
      logWithCheckpoint(
        "info",
        "Using cached team fixtures",
        "FOOTBALL_007.5",
        {
          teamId,
          cachedFixturesCount: cachedData.footballEvents?.length || 0,
        }
      );

      // סינון משחקים עם הצעות אם נדרש
      let filteredEvents = cachedData.footballEvents || [];
      if (hasOffers === true || hasOffers === "true") {
        filteredEvents = filteredEvents.filter(
          (event) => event.minPrice?.amount && event.minPrice.amount > 0
        );
      }

      return {
        ...cachedData,
        footballEvents: filteredEvents,
        pagination: {
          ...cachedData.pagination,
          total: filteredEvents.length,
          pages: Math.ceil(filteredEvents.length / parseInt(query.limit || 20)),
        },
        fromCache: true,
      };
    }

    // Cache miss - שליפה מה-DB
    logWithCheckpoint(
      "info",
      "Cache miss - fetching from database",
      "FOOTBALL_007.6",
      { teamId }
    );

    const {
      page = 1,
      limit = 20,
      league,
      season,
      venue,
      round,
      sortBy = "date",
      sortOrder = "asc",
      status,
      upcoming, // אופציונלי - אם לא מצוין, מחזיר הכל
      homeOnly = false,
      awayOnly = false,
    } = query;

    // Build filter object based on home/away preferences
    let filter;

    if (homeOnly === "true" || homeOnly === true) {
      // Only home games for this team
      filter = { homeTeam: validTeamId };
    } else if (awayOnly === "true" || awayOnly === true) {
      // Only away games for this team
      filter = { awayTeam: validTeamId };
    } else {
      // All games (home and away)
      filter = {
        $or: [{ homeTeam: validTeamId }, { awayTeam: validTeamId }],
      };
    }

    if (league) {
      filter.league = league;
    }

    if (season) {
      filter.season = season;
    }

    if (venue) {
      filter.venue = venue;
    }

    if (status) {
      filter.status = status;
    }

    // Filter by date (upcoming or past) - רק אם מצוין במפורש
    if (upcoming === "true" || upcoming === true) {
      filter.date = { $gte: new Date() };
      logWithCheckpoint("debug", "Added upcoming filter", "FOOTBALL_007.7", {
        upcoming: true,
      });
    } else if (upcoming === "false" || upcoming === false) {
      filter.date = { $lt: new Date() };
      logWithCheckpoint("debug", "Added past filter", "FOOTBALL_007.8", {
        upcoming: false,
      });
    }
    // אם upcoming לא מצוין - לא מוסיפים פילטר תאריך (כל המשחקים)

    // Build sort object
    const sort = buildSortObject(sortBy, sortOrder);
    const { skip, limit: limitNum } = buildPaginationParams(page, limit);

    const [footballEvents, total] = await Promise.all([
      FootballEvent.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate("league", "nameHe countryHe logoUrl slug")
        .populate("homeTeam", "name_he country_he code slug logoUrl")
        .populate("awayTeam", "name_he country_he code slug logoUrl")
        .populate("venue", "name_he city_he country_he capacity")
        .select("+minPrice") // Include minPrice field in response
        .lean(),
      FootballEvent.countDocuments(filter),
    ]);

    // Convert data to Hebrew names only - maps Hebrew fields to standard names
    const hebrewEvents = footballEvents.map((event) => {
      const mappedEvent = {
        ...event,
        league: event.league
          ? {
              ...event.league,
              name: event.league.nameHe || event.league.name,
              nameHe: event.league.nameHe,
              country: event.league.countryHe || event.league.country,
            }
          : null,
        homeTeam: event.homeTeam
          ? {
              ...event.homeTeam,
              name: event.homeTeam.name_he,
              country: event.homeTeam.country_he,
            }
          : null,
        awayTeam: event.awayTeam
          ? {
              ...event.awayTeam,
              name: event.awayTeam.name_he,
              country: event.awayTeam.country_he,
            }
          : null,
        venue: event.venue
          ? {
              ...event.venue,
              name: event.venue.name_he,
              city: event.venue.city_he,
              country: event.venue.country_he,
            }
          : null,
      };

      return mappedEvent;
    });

    logWithCheckpoint(
      "info",
      "Successfully fetched football events by team",
      "FOOTBALL_008",
      {
        teamId,
        count: hebrewEvents.length,
        total,
      }
    );

    // שמירה ב-cache - נתונים גולמיים ללא סינון hasOffers
    const cacheResult = {
      footballEvents: hebrewEvents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: hebrewEvents.length,
        pages: Math.ceil(hebrewEvents.length / parseInt(limit)),
      },
      fromCache: false,
    };

    fixturesByTeamCacheService.set(teamId, cacheResult);

    logWithCheckpoint(
      "info",
      "Team fixtures data cached successfully",
      "FOOTBALL_008.5",
      {
        teamId,
        fixturesCount: hebrewEvents.length,
      }
    );

    // סינון משחקים עם הצעות - רק לפני החזרת התוצאה (לא ב-cache)
    let filteredEvents = [...hebrewEvents];
    if (hasOffers === true || hasOffers === "true") {
      filteredEvents = filteredEvents.filter(
        (event) => event.minPrice?.amount && event.minPrice.amount > 0
      );
    }

    return {
      footballEvents: filteredEvents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: filteredEvents.length,
        pages: Math.ceil(filteredEvents.length / parseInt(limit)),
      },
      fromCache: false,
    };
  } catch (error) {
    logError(error, { operation: "getFootballEventsByTeamId", teamId, query });
    return createErrorResponse("INTERNAL_SERVER_ERROR", error.message);
  }
};
