import FootballEvent from "../../models/FootballEvent.js";
import Team from "../../models/Team.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";
import mongoose from "mongoose";

// ANSI color codes for colored console output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const logColor = (color, label, message, data = null) => {
  console.log(
    `${colors.dim}[FIXTURE FINDER]${colors.reset} ${color}${colors.bright}${label}${colors.reset} ${color}${message}${colors.reset}`
  );
  if (data) {
    console.log(
      `${colors.dim}  →${colors.reset}`,
      JSON.stringify(data, null, 2)
    );
  }
};

/**
 * Build slug for a fixture
 * Format: {homeTeam-slug}-vs-{awayTeam-slug}-{YYYY-MM-DD}
 */
const buildFixtureSlug = (homeTeamSlug, awayTeamSlug, date) => {
  const dateStr =
    date instanceof Date ? date.toISOString().split("T")[0] : date;

  return `${homeTeamSlug}-vs-${awayTeamSlug}-${dateStr}`;
};

/**
 * Format date to YYYY-MM-DD
 */
const formatDate = (date) => {
  if (!date) return null;

  if (date instanceof Date) {
    return date.toISOString().split("T")[0];
  }

  if (typeof date === "string") {
    // Try to parse the date string
    const parsed = new Date(date);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
  }

  return null;
};

/**
 * Find fixture between two teams
 * @param {string|ObjectId} team1Id - First team ID
 * @param {string|ObjectId} team2Id - Second team ID
 * @param {string|Date} date - Optional date (YYYY-MM-DD format or Date object)
 * @returns {Object} - Fixture object with slug
 */
export const findFixtureBetweenTeams = async (
  team1Id,
  team2Id,
  date = null
) => {
  try {
    logWithCheckpoint(
      "info",
      "Starting fixture search between teams",
      "FIXTURE_FINDER_001",
      { team1Id, team2Id, date }
    );

    // Validate ObjectIds
    if (!mongoose.Types.ObjectId.isValid(team1Id)) {
      return {
        success: false,
        error: "Invalid team1 ID format",
      };
    }

    if (!mongoose.Types.ObjectId.isValid(team2Id)) {
      return {
        success: false,
        error: "Invalid team2 ID format",
      };
    }

    const team1ObjectId = new mongoose.Types.ObjectId(team1Id);
    const team2ObjectId = new mongoose.Types.ObjectId(team2Id);

    // Build filter for fixture search
    // Check both directions: team1 vs team2 and team2 vs team1
    const filter = {
      $or: [
        { homeTeam: team1ObjectId, awayTeam: team2ObjectId },
        { homeTeam: team2ObjectId, awayTeam: team1ObjectId },
      ],
    };

    // Add date filter if provided
    if (date) {
      const formattedDate = formatDate(date);
      if (formattedDate) {
        // Search for fixtures on the specific date (with ±1 day tolerance for timezone issues)
        const searchDate = new Date(formattedDate);
        const startOfDay = new Date(searchDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(searchDate);
        endOfDay.setHours(23, 59, 59, 999);

        filter.date = {
          $gte: startOfDay,
          $lte: endOfDay,
        };

        logWithCheckpoint(
          "info",
          "Searching for fixture on specific date",
          "FIXTURE_FINDER_002",
          { date: formattedDate, startOfDay, endOfDay }
        );
      }
    } else {
      // If no date provided, search for upcoming fixtures only
      filter.date = { $gte: new Date() };

      logWithCheckpoint(
        "info",
        "Searching for upcoming fixture",
        "FIXTURE_FINDER_003"
      );
    }

    // Find fixtures
    const fixtures = await FootballEvent.find(filter)
      .populate("homeTeam", "name slug")
      .populate("awayTeam", "name slug")
      .populate("league", "name nameHe slug")
      .populate("venue", "name city_he city_en")
      .sort({ date: 1 }) // Sort by date ascending (earliest first)
      .lean();

    if (!fixtures || fixtures.length === 0) {
      logWithCheckpoint(
        "warn",
        "No fixtures found between teams",
        "FIXTURE_FINDER_004",
        { team1Id, team2Id, date }
      );
      return {
        success: false,
        error: "No fixture found between the specified teams",
      };
    }

    // If date was specified, return the first match (should be only one)
    // If no date, return the closest upcoming match
    const fixture = fixtures[0];

    logColor(colors.cyan, "📊 [FOUND]", `Found ${fixtures.length} fixture(s)`, {
      totalFound: fixtures.length,
      selectedFixture: {
        id: fixture._id.toString(),
        date: fixture.date,
        homeTeam: fixture.homeTeam?.name || fixture.homeTeam,
        awayTeam: fixture.awayTeam?.name || fixture.awayTeam,
      },
    });

    // Determine which team is home and which is away
    const isTeam1Home = fixture.homeTeam._id.toString() === team1Id.toString();
    const homeTeam = isTeam1Home ? fixture.homeTeam : fixture.awayTeam;
    const awayTeam = isTeam1Home ? fixture.awayTeam : fixture.homeTeam;

    logColor(colors.magenta, "🏠 [TEAMS]", "Determined home/away teams:", {
      team1Id: team1Id.toString(),
      team1IsHome: isTeam1Home,
      homeTeam: {
        name: homeTeam.name,
        slug: homeTeam.slug,
      },
      awayTeam: {
        name: awayTeam.name,
        slug: awayTeam.slug,
      },
    });

    // Build slug
    const slug = buildFixtureSlug(homeTeam.slug, awayTeam.slug, fixture.date);
    logColor(colors.green, "🔗 [SLUG]", "Generated fixture slug:", {
      slug,
      formula: `${homeTeam.slug}-vs-${awayTeam.slug}-${
        fixture.date.toISOString().split("T")[0]
      }`,
      homeTeamSlug: homeTeam.slug,
      awayTeamSlug: awayTeam.slug,
      date: fixture.date.toISOString().split("T")[0],
    });

    return {
      success: true,
      fixture: {
        _id: fixture._id,
        slug,
        date: fixture.date,
        status: fixture.status,
        homeTeam: {
          _id: homeTeam._id,
          name: homeTeam.name,
          slug: homeTeam.slug,
        },
        awayTeam: {
          _id: awayTeam._id,
          name: awayTeam.name,
          slug: awayTeam.slug,
        },
        league: fixture.league
          ? {
              _id: fixture.league._id,
              name: fixture.league.nameHe || fixture.league.name,
              slug: fixture.league.slug,
            }
          : null,
        venue: fixture.venue
          ? {
              _id: fixture.venue._id,
              name: fixture.venue.name,
              city: fixture.venue.city_he || fixture.venue.city_en,
            }
          : null,
        round: fixture.round,
        minPrice: fixture.minPrice,
      },
    };
  } catch (error) {
    logError(error, {
      operation: "findFixtureBetweenTeams",
      team1Id,
      team2Id,
      date,
    });
    return {
      success: false,
      error: error.message || "Failed to find fixture",
    };
  }
};

/**
 * Find fixture by slug
 * @param {string} slug - Fixture slug
 * @returns {Object} - Fixture object
 */
export const findFixtureBySlug = async (slug) => {
  try {
    logWithCheckpoint("info", "Finding fixture by slug", "FIXTURE_FINDER_006", {
      slug,
    });

    const fixture = await FootballEvent.findOne({ slug })
      .populate("homeTeam", "name slug")
      .populate("awayTeam", "name slug")
      .populate("league", "name nameHe slug")
      .populate("venue", "name city_he city_en")
      .lean();

    if (!fixture) {
      return {
        success: false,
        error: "Fixture not found",
      };
    }

    return {
      success: true,
      fixture: {
        _id: fixture._id,
        slug: fixture.slug,
        date: fixture.date,
        status: fixture.status,
        homeTeam: {
          _id: fixture.homeTeam._id,
          name: fixture.homeTeam.name,
          slug: fixture.homeTeam.slug,
        },
        awayTeam: {
          _id: fixture.awayTeam._id,
          name: fixture.awayTeam.name,
          slug: fixture.awayTeam.slug,
        },
        league: fixture.league
          ? {
              _id: fixture.league._id,
              name: fixture.league.nameHe || fixture.league.name,
              slug: fixture.league.slug,
            }
          : null,
        venue: fixture.venue
          ? {
              _id: fixture.venue._id,
              name: fixture.venue.name,
              city: fixture.venue.city_he || fixture.venue.city_en,
            }
          : null,
        round: fixture.round,
        minPrice: fixture.minPrice,
      },
    };
  } catch (error) {
    logError(error, { operation: "findFixtureBySlug", slug });
    return {
      success: false,
      error: error.message || "Failed to find fixture by slug",
    };
  }
};
