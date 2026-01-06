import express from "express";
import OfferService from "../../../services/offer/index.js";
import { getFixtureIdBySlug } from "../../../services/footballFixtures/queries/getFixtureIdBySlug.js";
import FootballEvent from "../../../models/FootballEvent.js";
import { logError } from "../../../utils/logger.js";
import { rateLimit } from "../../../middleware/userAuth.js";
import { createErrorResponse } from "../../../utils/errorCodes.js";
import { createSuccessResponse } from "../../../utils/successCodes.js";

const router = express.Router();

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
  const timestamp = new Date().toISOString();
  console.log(
    `${colors.dim}[${timestamp}]${colors.reset} ${color}${colors.bright}${label}${colors.reset} ${color}${message}${colors.reset}`
  );
  if (data) {
    console.log(
      `${colors.dim}  →${colors.reset}`,
      JSON.stringify(data, null, 2)
    );
  }
};

/**
 * Check if slug contains a date (YYYY-MM-DD format)
 */
const hasDateInSlug = (slug) => {
  const datePattern = /\d{4}-\d{2}-\d{2}$/;
  return datePattern.test(slug);
};

/**
 * Find fixture by partial slug (without date) - returns closest upcoming match
 */
const findFixtureByPartialSlug = async (partialSlug) => {
  try {
    logColor(
      colors.yellow,
      "🔍 [PARTIAL SLUG]",
      `Searching for fixture with partial slug: "${partialSlug}"`,
      { partialSlug }
    );

    // Try to find fixtures that start with the partial slug
    const slugPattern = new RegExp(
      `^${partialSlug.replace(/-/g, "\\-")}-\\d{4}-\\d{2}-\\d{2}$`
    );

    const fixtures = await FootballEvent.find({
      slug: slugPattern,
      date: { $gte: new Date() }, // Only upcoming matches
    })
      .select("_id slug date")
      .sort({ date: 1 }) // Sort by date ascending (closest first)
      .limit(1)
      .lean();

    if (fixtures.length === 0) {
      logColor(
        colors.red,
        "❌ [PARTIAL SLUG]",
        `No upcoming fixtures found for partial slug: "${partialSlug}"`,
        { partialSlug }
      );
      return null;
    }

    const fixture = fixtures[0];
    logColor(
      colors.green,
      "✅ [PARTIAL SLUG]",
      `Found closest upcoming fixture for partial slug`,
      {
        partialSlug,
        foundSlug: fixture.slug,
        fixtureId: fixture._id.toString(),
        date: fixture.date,
      }
    );

    return {
      _id: fixture._id.toString(),
      slug: fixture.slug,
      fromCache: false,
      isPartialMatch: true,
    };
  } catch (error) {
    logError(error, { operation: "findFixtureByPartialSlug", partialSlug });
    return null;
  }
};

// GET /api/offers/fixture-slug/:slug - Get all offers by fixture slug
router.get("/fixture-slug/:slug", rateLimit(1000), async (req, res) => {
  const startTime = Date.now();

  try {
    const { slug } = req.params;

    logColor(
      colors.cyan,
      "📥 [ROUTE]",
      `GET /api/offers/fixture-slug/:slug - Request received`,
      {
        slug,
        query: req.query,
      }
    );

    if (!slug) {
      logColor(colors.red, "❌ [VALIDATION]", "Slug is required but missing", {
        slug,
      });
      return res.status(400).json(
        createErrorResponse("VALIDATION_MISSING_FIELDS", {
          required: ["slug"],
          message: "Slug is required",
        })
      );
    }

    // Check if slug is full (with date) or partial (without date)
    const isFullSlug = hasDateInSlug(slug);

    logColor(
      isFullSlug ? colors.green : colors.yellow,
      isFullSlug ? "✅ [SLUG TYPE]" : "⚠️  [SLUG TYPE]",
      isFullSlug
        ? `Full slug detected (with date): "${slug}"`
        : `Partial slug detected (without date): "${slug}" - will search for closest upcoming match`,
      {
        slug,
        isFullSlug,
        expectedFormat: "team1-vs-team2-YYYY-MM-DD",
      }
    );

    // Step 1: Get fixture ID by slug
    let fixtureIdResult = await getFixtureIdBySlug(slug);

    // If not found and it's a partial slug, try to find closest upcoming match
    if ((!fixtureIdResult || !fixtureIdResult._id) && !isFullSlug) {
      logColor(
        colors.yellow,
        "🔄 [FALLBACK]",
        `Full slug not found, trying partial slug search...`,
        { slug }
      );
      fixtureIdResult = await findFixtureByPartialSlug(slug);
    }

    if (!fixtureIdResult || !fixtureIdResult._id) {
      logColor(
        colors.red,
        "❌ [NOT FOUND]",
        `Fixture not found for slug: "${slug}"`,
        {
          slug,
          isFullSlug,
          searchedPartial: !isFullSlug,
        }
      );
      return res.status(200).json(
        createErrorResponse("FIXTURE_NOT_FOUND", {
          message: `Fixture with slug "${slug}" not found`,
          isPartialSlug: !isFullSlug,
          suggestion: !isFullSlug
            ? "Try using full slug format: team1-vs-team2-YYYY-MM-DD"
            : null,
        })
      );
    }

    const fixtureId = fixtureIdResult._id;
    const actualSlug = fixtureIdResult.slug || slug;

    logColor(colors.green, "✅ [FIXTURE FOUND]", `Fixture found successfully`, {
      requestedSlug: slug,
      actualSlug: actualSlug,
      fixtureId,
      fromCache: fixtureIdResult.fromCache || false,
      isPartialMatch: fixtureIdResult.isPartialMatch || false,
    });

    // Step 2: Get offers by fixture ID
    logColor(
      colors.blue,
      "📦 [FETCHING OFFERS]",
      `Fetching offers for fixture: ${fixtureId}`,
      { fixtureId, query: req.query }
    );

    const result = await OfferService.query.getOffersByFixtureId(
      fixtureId,
      req.query
    );

    const duration = Date.now() - startTime;

    logColor(colors.green, "✅ [SUCCESS]", `Successfully fetched offers`, {
      fixtureId,
      offersCount: result.offers?.length || 0,
      pagination: result.pagination,
      fromCache: result.fromCache,
      duration: `${duration}ms`,
    });

    res.json(
      createSuccessResponse(
        {
          offers: result.offers,
          fixture: result.fixture,
          pagination: result.pagination,
          fromCache: result.fromCache,
          slugInfo: {
            requested: slug,
            actual: actualSlug,
            isPartialMatch: fixtureIdResult.isPartialMatch || false,
          },
        },
        "OFFERS_FETCHED"
      )
    );
  } catch (error) {
    const duration = Date.now() - startTime;
    logColor(colors.red, "❌ [ERROR]", `Error fetching offers by slug`, {
      slug: req.params.slug,
      error: error.message,
      duration: `${duration}ms`,
    });
    logError(error, {
      route: "GET /api/offers/fixture-slug/:slug",
      slug: req.params.slug,
      query: req.query,
    });
    res.status(500).json(createErrorResponse("INTERNAL_SERVER_ERROR"));
  }
});

export default router;
