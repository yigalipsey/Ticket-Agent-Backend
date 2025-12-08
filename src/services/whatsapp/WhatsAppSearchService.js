import { matchTeamsFromQuery } from "./TeamMatcherService.js";
import { findFixtureBetweenTeams } from "./FixtureFinderService.js";
import { getOffersByFixtureId } from "../offer/queries/getOffersByFixtureId.js";
import { logWithCheckpoint, logError } from "../../utils/logger.js";
import { createErrorResponse } from "../../utils/errorCodes.js";

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
  white: "\x1b[37m",
};

const logColor = (color, label, message, data = null) => {
  const timestamp = new Date().toISOString();
  console.log(
    `${colors.dim}[${timestamp}]${colors.reset} ${color}${colors.bright}${label}${colors.reset} ${color}${message}${colors.reset}`
  );
  if (data) {
    console.log(
      `${colors.dim}  Data:${colors.reset}`,
      JSON.stringify(data, null, 2)
    );
  }
};

/**
 * WhatsApp Search Service
 * Handles natural language game search and returns all offers
 */
class WhatsAppSearchService {
  /**
   * Search for a game by natural language query and return all offers
   * @param {string} query - Natural language query (e.g., "סיטי נגד יונייטד")
   * @param {string|Date} date - Optional date (YYYY-MM-DD format or Date object)
   * @returns {Object} - Result object with success flag and data/error
   */
  async searchGame(query, date = null) {
    try {
      console.log("\n" + "=".repeat(80));
      logColor(
        colors.cyan,
        "🔍 [WHATSAPP SEARCH]",
        `Starting search for: "${query}"`,
        {
          query,
          date: date || "לא צוין (יחפש את הקרוב ביותר)",
        }
      );

      // Step 1: Validate query
      logColor(colors.blue, "📋 [STEP 1]", "Validating query...");
      const validationResult = this.validateQuery(query);
      if (!validationResult.valid) {
        logColor(
          colors.red,
          "❌ [VALIDATION FAILED]",
          validationResult.error.message
        );
        return {
          success: false,
          error: validationResult.error,
          statusCode: 400,
        };
      }
      logColor(colors.green, "✅ [VALIDATION]", "Query is valid");

      // Step 2: Match teams from query
      logColor(
        colors.blue,
        "🔎 [STEP 2]",
        `Matching teams from query: "${query}"`
      );
      const teamMatchResult = await matchTeamsFromQuery(query);
      if (!teamMatchResult.success) {
        logColor(colors.red, "❌ [TEAM MATCH FAILED]", teamMatchResult.error, {
          suggestions: teamMatchResult.suggestions,
        });
        return {
          success: false,
          error: teamMatchResult.error,
          suggestions: teamMatchResult.suggestions,
          statusCode: 400,
        };
      }

      const { team1, team2 } = teamMatchResult;
      logColor(
        colors.green,
        "✅ [TEAMS FOUND]",
        "Teams matched successfully:",
        {
          team1: {
            name: team1.name,
            id: team1._id.toString(),
            slug: team1.slug,
          },
          team2: {
            name: team2.name,
            id: team2._id.toString(),
            slug: team2.slug,
          },
        }
      );

      // Step 3: Find fixture between teams
      logColor(
        colors.blue,
        "🏟️  [STEP 3]",
        `Finding fixture between ${team1.name} and ${team2.name}`,
        { date: date || "לא צוין (יחפש את הקרוב ביותר)" }
      );
      const fixtureResult = await findFixtureBetweenTeams(
        team1._id,
        team2._id,
        date
      );

      if (!fixtureResult.success) {
        logColor(colors.red, "❌ [FIXTURE NOT FOUND]", fixtureResult.error, {
          team1: team1.name,
          team2: team2.name,
          date,
        });
        return {
          success: false,
          error: fixtureResult.error,
          statusCode: 404,
        };
      }

      const { fixture } = fixtureResult;
      logColor(
        colors.green,
        "✅ [FIXTURE FOUND]",
        "Fixture found successfully:",
        {
          fixtureId: fixture._id.toString(),
          slug: fixture.slug,
          date: fixture.date,
          homeTeam: fixture.homeTeam?.name || fixture.homeTeam,
          awayTeam: fixture.awayTeam?.name || fixture.awayTeam,
          league:
            fixture.league?.nameHe || fixture.league?.name || fixture.league,
          venue: fixture.venue?.name || fixture.venue,
        }
      );

      // Step 4: Get all offers for the fixture
      logColor(
        colors.blue,
        "💰 [STEP 4]",
        `Fetching offers for fixture: ${fixture.slug}`,
        {
          fixtureId: fixture._id.toString(),
          options: {
            page: 1,
            limit: 1000,
            isAvailable: true,
            sortBy: "price",
            sortOrder: "asc",
          },
        }
      );

      let offers = [];
      try {
        // Call getOffersByFixtureId with forceRefresh=true to get live prices from suppliers
        const offersResult = await getOffersByFixtureId(
          fixture._id.toString(),
          {
            page: 1,
            limit: 1000, // Get all offers
            isAvailable: true,
            sortBy: "price",
            sortOrder: "asc",
            forceRefresh: true, // Force refresh to get live prices from suppliers
          }
        );

        // getOffersByFixtureId returns { offers, fixture, pagination } directly (no success field)
        console.log("\n" + colors.cyan + "=".repeat(80) + colors.reset);
        console.log(
          colors.cyan +
            colors.bright +
            "📦 [OFFERS RESULT RAW - FULL DEBUG]" +
            colors.reset
        );
        console.log(
          "Full result object:",
          JSON.stringify(offersResult, null, 2)
        );
        console.log(colors.cyan + "=".repeat(80) + colors.reset + "\n");

        logColor(
          colors.cyan,
          "📦 [OFFERS RESULT RAW]",
          "Raw offers result from service:",
          {
            hasResult: !!offersResult,
            resultType: typeof offersResult,
            resultKeys: offersResult ? Object.keys(offersResult) : [],
            offersType: typeof offersResult?.offers,
            offersIsArray: Array.isArray(offersResult?.offers),
            offersLength: offersResult?.offers?.length || 0,
            paginationTotal: offersResult?.pagination?.total || 0,
            paginationPage: offersResult?.pagination?.page,
            paginationLimit: offersResult?.pagination?.limit,
          }
        );

        offers = offersResult?.offers || [];

        console.log("\n" + colors.magenta + "=".repeat(80) + colors.reset);
        console.log(
          colors.magenta +
            colors.bright +
            "📦 [OFFERS EXTRACTED - FULL DEBUG]" +
            colors.reset
        );
        console.log("Offers array:", JSON.stringify(offers, null, 2));
        console.log("Offers length:", offers.length);
        console.log("Is array:", Array.isArray(offers));
        console.log(colors.magenta + "=".repeat(80) + colors.reset + "\n");

        logColor(
          colors.cyan,
          "📦 [OFFERS EXTRACTED]",
          "Extracted offers array:",
          {
            offersCount: offers.length,
            offersIsArray: Array.isArray(offers),
            firstOffer:
              offers.length > 0
                ? {
                    id: offers[0]._id,
                    price: offers[0].price,
                    currency: offers[0].currency,
                  }
                : null,
          }
        );
      } catch (error) {
        logColor(colors.red, "❌ [OFFERS ERROR]", "Error fetching offers:", {
          error: error.message,
          stack: error.stack,
        });
        // Continue with empty offers array
        offers = [];
      }

      if (offers.length === 0) {
        logColor(
          colors.yellow,
          "⚠️  [NO OFFERS]",
          "No offers found for this fixture",
          {
            fixtureId: fixture._id.toString(),
            slug: fixture.slug,
          }
        );
      } else {
        logColor(
          colors.green,
          "✅ [OFFERS FOUND]",
          `Found ${offers.length} offers`,
          {
            fixtureId: fixture._id.toString(),
            offersCount: offers.length,
            offersPreview: offers.slice(0, 3).map((offer) => ({
              id: offer._id,
              price: offer.price,
              currency: offer.currency,
              supplier: offer.supplier?.name || offer.supplier,
            })),
          }
        );
      }

      // Step 5: Return only offers array
      logColor(
        colors.green,
        "✅ [SUCCESS]",
        `Returning ${offers.length} offers`
      );

      // Final debug - what we're actually returning
      console.log("\n" + colors.green + "=".repeat(80) + colors.reset);
      console.log(
        colors.green +
          colors.bright +
          "📤 [FINAL RETURN - DEBUG]" +
          colors.reset
      );
      console.log(
        "Return object:",
        JSON.stringify(
          {
            success: true,
            data: offers,
            statusCode: 200,
            dataLength: offers.length,
            dataIsArray: Array.isArray(offers),
          },
          null,
          2
        )
      );
      console.log(colors.green + "=".repeat(80) + colors.reset + "\n");

      return {
        success: true,
        data: offers,
        statusCode: 200,
      };
    } catch (error) {
      logColor(colors.red, "❌ [ERROR]", error.message, {
        stack: error.stack,
        query,
        date,
      });
      logError(error, {
        operation: "WhatsAppSearchService.searchGame",
        query,
        date,
      });

      return {
        success: false,
        error: error.message || "Internal server error",
        statusCode: 500,
      };
    }
  }

  /**
   * Validate query parameter
   * @param {any} query - Query to validate
   * @returns {Object} - Validation result
   */
  validateQuery(query) {
    if (!query) {
      return {
        valid: false,
        error: {
          code: "VALIDATION_MISSING_FIELDS",
          message: "Query is required. Please provide 'query' parameter.",
          details: {
            required: ["query"],
          },
        },
      };
    }

    if (typeof query !== "string" || query.trim().length === 0) {
      return {
        valid: false,
        error: {
          code: "VALIDATION_MISSING_FIELDS",
          message: "Query must be a non-empty string",
          details: {
            required: ["query"],
          },
        },
      };
    }

    return { valid: true };
  }
}

// Export singleton instance
const whatsAppSearchService = new WhatsAppSearchService();
export default whatsAppSearchService;
