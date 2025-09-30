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

// Get football events by team ID
export const getFootballEventsByTeam = async (teamId, query = {}) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting to fetch football events by team",
      "FOOTBALL_007",
      { teamId, query }
    );

    const validTeamId = validateObjectId(teamId, "Team ID");

    const {
      page = 1,
      limit = 20,
      league,
      season,
      venue,
      sortBy = "date",
      sortOrder = "asc",
      status,
      upcoming = true, // Default to upcoming matches
      locale = "he",
    } = query;

    // Build filter object
    const filter = {
      $or: [{ homeTeam: validTeamId }, { awayTeam: validTeamId }],
    };

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
      "Successfully fetched football events by team",
      "FOOTBALL_008",
      {
        teamId,
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
    logError(error, { operation: "getFootballEventsByTeam", teamId, query });
    throw error;
  }
};

// Get football events by team with localization
export const getFootballEventsByTeamLocalized = async (teamId, query = {}) => {
  try {
    const locale = query.locale || "en";

    const {
      page = 1,
      limit = 20,
      league,
      season,
      venue,
      sortBy = "date",
      sortOrder = "asc",
      status,
      upcoming = true,
    } = query;

    // Build filter object
    const filter = {
      $or: [{ homeTeam: teamId }, { awayTeam: teamId }],
    };

    if (league) filter.league = league;
    if (season) filter.season = season;
    if (venue) filter.venue = venue;
    if (status) filter.status = status;

    // Filter by date (upcoming or past)
    if (upcoming === "true" || upcoming === true) {
      filter.date = { $gte: new Date() };
    } else if (upcoming === "false" || upcoming === false) {
      filter.date = { $lt: new Date() };
    }

    const sort = buildSortObject(sortBy, sortOrder);
    const { skip, limit: limitNum } = buildPaginationParams(page, limit);

    const [footballEvents, total] = await Promise.all([
      FootballEvent.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate("league", "name country logoUrl")
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
        homeTeam: {
          _id: fixture.homeTeam._id,
          code: fixture.homeTeam.code,
          slug: fixture.homeTeam.slug,
          logoUrl: fixture.homeTeam.logoUrl,
          name:
            locale === "he"
              ? fixture.homeTeam.name_he || fixture.homeTeam.name_en
              : fixture.homeTeam.name_en,
        },
        awayTeam: {
          _id: fixture.awayTeam._id,
          code: fixture.awayTeam.code,
          slug: fixture.awayTeam.slug,
          logoUrl: fixture.awayTeam.logoUrl,
          name:
            locale === "he"
              ? fixture.awayTeam.name_he || fixture.awayTeam.name_en
              : fixture.awayTeam.name_en,
        },
        venue: {
          _id: fixture.venue._id,
          name:
            locale === "he"
              ? fixture.venue.name_he || fixture.venue.name_en
              : fixture.venue.name_en,
        },
      };
    });

    return {
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
      operation: "getFootballEventsByTeamLocalized",
      teamId,
      query,
    });
    throw error;
  }
};

// Get football events by team slug
export const getFootballEventsByTeamSlug = async (teamSlug, query = {}) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting to fetch football events by team slug",
      "FOOTBALL_016",
      { teamSlug, query }
    );

    const validTeamSlug = validateSlug(teamSlug, "Team slug");
    const locale = query.locale || "en";

    // First, find the team by slug
    const team = await Team.findOne({ slug: validTeamSlug }).lean();

    if (!team) {
      logWithCheckpoint("warn", "Team not found by slug", "FOOTBALL_017", {
        teamSlug,
      });
      return null;
    }

    // Get fixtures for this team with localization
    const result = await getFootballEventsByTeamLocalized(team._id, {
      ...query,
      locale,
    });

    logWithCheckpoint(
      "info",
      "Successfully fetched football events by team slug",
      "FOOTBALL_018",
      { teamSlug, count: result.footballEvents.length }
    );

    // Localize team data
    const localizedTeam = {
      _id: team._id,
      name: locale === "he" ? team.name_he || team.name_en : team.name_en,
      country:
        locale === "he" ? team.country_he || team.country_en : team.country_en,
      code: team.code,
      slug: team.slug,
      logoUrl: team.logoUrl,
      venue: team.venueId,
    };

    return {
      team: localizedTeam,
      ...result,
    };
  } catch (error) {
    logError(error, {
      operation: "getFootballEventsByTeamSlug",
      teamSlug,
      query,
    });
    throw error;
  }
};
