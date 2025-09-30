import FootballEvent from "../../../models/FootballEvent.js";
import League from "../../../models/League.js";
import Team from "../../../models/Team.js";
import Venue from "../../../models/Venue.js";
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

// Get football events by league ID
export const getFootballEventsByLeague = async (leagueId, query = {}) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting to fetch football events by league",
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
      upcoming = undefined, // Don't filter by date by default
      locale = "he",
    } = query;

    // Build filter object
    const filter = {
      league: validLeagueId,
    };

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
        .populate(
          "league",
          "name name_en name_he country country_en country_he logoUrl slug"
        )
        .populate(
          "homeTeam",
          "name name_en name_he country country_en country_he code slug logoUrl"
        )
        .populate(
          "awayTeam",
          "name name_en name_he country country_en country_he code slug logoUrl"
        )
        .populate(
          "venue",
          "name name_en name_he city city_en city_he country country_en country_he capacity"
        )
        .lean(),
      FootballEvent.countDocuments(filter),
    ]);

    // Localize the data
    const localizedEvents = footballEvents.map((event) => ({
      ...event,
      league: event.league
        ? {
            ...event.league,
            name:
              locale === "en"
                ? event.league.name_en || event.league.name
                : event.league.name_he || event.league.name,
            country:
              locale === "en"
                ? event.league.country_en || event.league.country
                : event.league.country_he || event.league.country,
          }
        : null,
      homeTeam: event.homeTeam
        ? {
            ...event.homeTeam,
            name:
              locale === "en"
                ? event.homeTeam.name_en || event.homeTeam.name
                : event.homeTeam.name_he || event.homeTeam.name,
            country:
              locale === "en"
                ? event.homeTeam.country_en || event.homeTeam.country
                : event.homeTeam.country_he || event.homeTeam.country,
          }
        : null,
      awayTeam: event.awayTeam
        ? {
            ...event.awayTeam,
            name:
              locale === "en"
                ? event.awayTeam.name_en || event.awayTeam.name
                : event.awayTeam.name_he || event.awayTeam.name,
            country:
              locale === "en"
                ? event.awayTeam.country_en || event.awayTeam.country
                : event.awayTeam.country_he || event.awayTeam.country,
          }
        : null,
      venue: event.venue
        ? {
            ...event.venue,
            name:
              locale === "en"
                ? event.venue.name_en || event.venue.name
                : event.venue.name_he || event.venue.name,
            city:
              locale === "en"
                ? event.venue.city_en || event.venue.city
                : event.venue.city_he || event.venue.city,
            country:
              locale === "en"
                ? event.venue.country_en || event.venue.country
                : event.venue.country_he || event.venue.country,
          }
        : null,
    }));

    logWithCheckpoint(
      "info",
      "Successfully fetched football events by league",
      "FOOTBALL_020",
      {
        leagueId,
        count: localizedEvents.length,
        total,
      }
    );

    return {
      footballEvents: localizedEvents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  } catch (error) {
    logError(error, {
      operation: "getFootballEventsByLeague",
      leagueId,
      query,
    });
    throw error;
  }
};

// Get football events by league slug
export const getFootballEventsByLeagueSlug = async (leagueSlug, query = {}) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting to fetch football events by league slug",
      "FOOTBALL_009",
      { leagueSlug, query }
    );

    const validLeagueSlug = validateSlug(leagueSlug, "League slug");

    // First, find the league by slug
    const league = await League.findOne({ slug: validLeagueSlug }).lean();

    if (!league) {
      logWithCheckpoint("warn", "League not found by slug", "FOOTBALL_010", {
        leagueSlug,
      });
      return null;
    }

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
      upcoming = undefined, // Don't filter by date by default
    } = query;

    // Build filter object
    const filter = {
      league: league._id,
    };

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
        .populate("league", "name country logoUrl slug")
        .populate("homeTeam", "name code slug logoUrl")
        .populate("awayTeam", "name code slug logoUrl")
        .populate("venue", "name city capacity")
        .lean(),
      FootballEvent.countDocuments(filter),
    ]);

    logWithCheckpoint(
      "info",
      "Successfully fetched football events by league slug",
      "FOOTBALL_011",
      {
        leagueSlug,
        count: footballEvents.length,
        total,
      }
    );

    return {
      league: {
        _id: league._id,
        name: league.name,
        slug: league.slug,
        country: league.country,
        logoUrl: league.logoUrl,
      },
      footballEvents,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  } catch (error) {
    logError(error, {
      operation: "getFootballEventsByLeagueSlug",
      leagueSlug,
      query,
    });
    throw error;
  }
};

// Get football events by league slug with localization
export const getFootballEventsByLeagueSlugLocalized = async (
  leagueSlug,
  query = {}
) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting to fetch football events by league slug with localization",
      "FOOTBALL_021",
      { leagueSlug, query }
    );

    const validLeagueSlug = validateSlug(leagueSlug, "League slug");
    const locale = query.locale || "he";

    // First, find the league by slug
    const league = await League.findOne({ slug: validLeagueSlug }).lean();

    if (!league) {
      logWithCheckpoint("warn", "League not found by slug", "FOOTBALL_022", {
        leagueSlug,
      });
      return null;
    }

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
      upcoming = true,
    } = query;

    // Build filter object
    const filter = {
      league: league._id,
    };

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
        .populate("league", "name country logoUrl slug")
        .populate("homeTeam", "name_en name_he code slug logoUrl")
        .populate("awayTeam", "name_en name_he code slug logoUrl")
        .populate("venue", "name_en name_he")
        .lean(),
      FootballEvent.countDocuments(filter),
    ]);

    // Localize team names and venue names in fixtures
    const localizedFixtures = footballEvents.map((fixture) => {
      return {
        ...fixture,
        homeTeam: Team.localizeTeam(fixture.homeTeam, locale),
        awayTeam: Team.localizeTeam(fixture.awayTeam, locale),
        venue: Venue.localizeVenue(fixture.venue, locale),
      };
    });

    logWithCheckpoint(
      "info",
      "Successfully fetched football events by league slug with localization",
      "FOOTBALL_023",
      {
        leagueSlug,
        locale,
        count: localizedFixtures.length,
        total,
      }
    );

    return {
      league: {
        _id: league._id,
        name: league.name,
        slug: league.slug,
        country: league.country,
        logoUrl: league.logoUrl,
      },
      footballEvents: localizedFixtures,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    };
  } catch (error) {
    logError(error, {
      operation: "getFootballEventsByLeagueSlugLocalized",
      leagueSlug,
      query,
    });
    throw error;
  }
};
