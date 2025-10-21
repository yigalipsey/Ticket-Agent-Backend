import Team from "../../models/Team.js";
import FootballEvent from "../../models/FootballEvent.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";
import { createErrorResponse } from "../../utils/errorCodes.js";

/**
 * Search for teams by name with their upcoming fixtures
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Object} Search results with teams and their upcoming fixtures
 */
export const searchTeamsWithFixtures = async (query, options = {}) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting team search with fixtures",
      "SEARCH_001",
      { query, options }
    );

    const {
      limit = 10,
      fixturesLimit = 5,
      includePastFixtures = false,
      leagueId = null,
      onlyWithOffers = false,
    } = options;

    // Validate query
    if (!query || query.trim().length < 2) {
      return createErrorResponse(
        "VALIDATION_INVALID_QUERY",
        "Search query must be at least 2 characters"
      );
    }

    const searchQuery = query.trim();

    // Build team search filter
    const teamFilter = {
      $or: [
        { name_he: { $regex: searchQuery, $options: "i" } },
        { name_en: { $regex: searchQuery, $options: "i" } },
        { code: { $regex: searchQuery, $options: "i" } },
      ],
    };

    // Add league filter if specified
    if (leagueId) {
      teamFilter.leagueIds = leagueId;
    }

    logWithCheckpoint("debug", "Searching teams with filter", "SEARCH_002", {
      teamFilter,
    });

    // Find teams matching the search query
    const teams = await Team.find(teamFilter)
      .select("name_he name_en code slug _id")
      .limit(limit)
      .lean();

    logWithCheckpoint("info", "Found teams", "SEARCH_003", {
      teamsCount: teams.length,
    });

    // Collect all fixtures from all teams first
    const allFixtures = [];
    const teamIds = teams.map((team) => team._id);

    if (teamIds.length > 0) {
      // Build fixtures filter for all teams
      const fixturesFilter = {
        $or: [{ homeTeam: { $in: teamIds } }, { awayTeam: { $in: teamIds } }],
        date: includePastFixtures ? { $exists: true } : { $gte: new Date() },
      };

      // Add league filter if specified
      if (leagueId) {
        fixturesFilter.league = leagueId;
      }

      // Add offers filter if specified
      if (onlyWithOffers) {
        fixturesFilter.minPrice = { $exists: true, $ne: null };
      }

      logWithCheckpoint(
        "debug",
        "Fetching all fixtures for teams",
        "SEARCH_004",
        { teamIds: teamIds.length }
      );

      // Get all upcoming fixtures for all teams
      const fixtures = await FootballEvent.find(fixturesFilter)
        .populate("league", "nameHe countryHe logoUrl slug")
        .populate("homeTeam", "name_he country_he code slug logoUrl")
        .populate("awayTeam", "name_he country_he code slug logoUrl")
        .populate("venue", "name_he city_he country_he capacity")
        .select("+minPrice")
        .sort({ date: 1 })
        .limit(fixturesLimit * teams.length) // Get more fixtures to have enough for all teams
        .lean();

      allFixtures.push(...fixtures);
    }

    // Sort all fixtures by date and take only the closest ones
    const sortedFixtures = allFixtures
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, fixturesLimit);

    // For each team, get their upcoming fixtures
    const teamsWithFixtures = await Promise.all(
      teams.map(async (team) => {
        try {
          // Filter fixtures for this specific team
          const teamFixtures = sortedFixtures.filter(
            (fixture) =>
              fixture.homeTeam._id.toString() === team._id.toString() ||
              fixture.awayTeam._id.toString() === team._id.toString()
          );

          // Convert fixtures to Hebrew format - only basic info
          const hebrewFixtures = teamFixtures.map((fixture) => ({
            _id: fixture._id.toString(),
            date: fixture.date,
            slug: fixture.slug,
            homeTeam: {
              name: fixture.homeTeam.name_he,
            },
            awayTeam: {
              name: fixture.awayTeam.name_he,
            },
            venue: {
              name: fixture.venue.name_he,
            },
          }));

          logWithCheckpoint("debug", "Found fixtures for team", "SEARCH_005", {
            teamId: team._id,
            teamName: team.name_he,
            fixturesCount: hebrewFixtures.length,
          });

          // Convert team to Hebrew format
          const hebrewTeam = {
            _id: team._id.toString(),
            name: team.name_he || team.name_en,
            code: team.code,
            slug: team.slug,
          };

          return {
            team: hebrewTeam,
            fixtures: hebrewFixtures,
            fixturesCount: hebrewFixtures.length,
          };
        } catch (error) {
          logError(error, {
            operation: "searchTeamsWithFixtures - team fixtures",
            teamId: team._id,
          });

          // Return team without fixtures if there's an error
          const hebrewTeam = {
            _id: team._id.toString(),
            name: team.name_he || team.name_en,
            code: team.code,
            slug: team.slug,
          };

          return {
            team: hebrewTeam,
            fixtures: [],
            fixturesCount: 0,
            error: "Failed to fetch fixtures",
          };
        }
      })
    );

    logWithCheckpoint(
      "info",
      "Team search completed successfully",
      "SEARCH_006",
      {
        query: searchQuery,
        teamsFound: teamsWithFixtures.length,
        totalFixtures: teamsWithFixtures.reduce(
          (sum, item) => sum + item.fixturesCount,
          0
        ),
      }
    );

    return {
      success: true,
      data: {
        query: searchQuery,
        teams: teamsWithFixtures,
        totalTeams: teamsWithFixtures.length,
        totalFixtures: teamsWithFixtures.reduce(
          (sum, item) => sum + item.fixturesCount,
          0
        ),
        searchOptions: options,
      },
    };
  } catch (error) {
    logError(error, {
      operation: "searchTeamsWithFixtures",
      query,
      options,
    });
    return createErrorResponse("INTERNAL_SERVER_ERROR", error.message);
  }
};

/**
 * Get search suggestions based on popular teams
 * @param {string} query - Search query
 * @param {number} limit - Number of suggestions to return
 * @returns {Object} Search suggestions
 */
export const getSearchSuggestions = async (query, limit = 5) => {
  try {
    logWithCheckpoint("info", "Getting search suggestions", "SEARCH_007", {
      query,
      limit,
    });

    if (!query || query.trim().length < 1) {
      return {
        success: true,
        data: {
          suggestions: [],
        },
      };
    }

    const searchQuery = query.trim();

    // Get popular teams that match the query
    const suggestions = await Team.find({
      isPopular: true,
      $or: [
        { name_he: { $regex: searchQuery, $options: "i" } },
        { name_en: { $regex: searchQuery, $options: "i" } },
        { code: { $regex: searchQuery, $options: "i" } },
      ],
    })
      .select("name_he name_en code slug")
      .limit(limit)
      .lean();

    const formattedSuggestions = suggestions.map((team) => ({
      name: team.name_he || team.name_en,
      code: team.code,
      slug: team.slug,
    }));

    logWithCheckpoint("info", "Search suggestions generated", "SEARCH_008", {
      query: searchQuery,
      suggestionsCount: formattedSuggestions.length,
    });

    return {
      success: true,
      data: {
        suggestions: formattedSuggestions,
      },
    };
  } catch (error) {
    logError(error, {
      operation: "getSearchSuggestions",
      query,
      limit,
    });
    return createErrorResponse("INTERNAL_SERVER_ERROR", error.message);
  }
};
