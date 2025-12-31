import express from "express";
import { logRequest, logError } from "../utils/logger.js";
import { rateLimit } from "../middleware/userAuth.js";
import { validateObjectIdQuery } from "../middleware/validateObjectId.js";
import HotFixturesService from "../services/footballFixtures/queries/HotFixturesService.js";
import { getLeagueFixturesWithCache } from "../services/footballFixtures/queries/byLeague.js";
import { getFootballEventsByTeamId } from "../services/footballFixtures/queries/byTeam.js";
import { getFixtureIdBySlug } from "../services/footballFixtures/queries/getFixtureIdBySlug.js";
import { getFixtureById } from "../services/footballFixtures/queries/getFixtureById.js";
import { createErrorResponse } from "../utils/errorCodes.js";

const router = express.Router();

// Middleware for request logging
router.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const responseTime = Date.now() - start;
    logRequest(req, res, responseTime, "ROUTE_MW");
  });

  next();
});

// GET /api/fixtures/hot - שליפת משחקים חמים קרובים
router.get("/hot", rateLimit(200), async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const result = await HotFixturesService.getUpcomingHotFixtures(
      parseInt(limit)
    );

    if (result.success) {
      return res.status(200).json(result);
    } else {
      return res.status(400).json(result);
    }
  } catch (error) {
    logError(error, {
      route: "GET /api/fixtures/hot",
      query: req.query,
    });
    const errorResponse = createErrorResponse(
      "INTERNAL_SERVER_ERROR",
      error.message
    );
    return res.status(500).json(errorResponse);
  }
});

// GET /api/fixtures/by-league - שליפת משחקי ליגה עם cache ופילטרים
router.get(
  "/by-league",
  validateObjectIdQuery("leagueId"),
  rateLimit(200),
  async (req, res) => {
    try {
      const { leagueId, ...queryParams } = req.query;

      const result = await getLeagueFixturesWithCache(leagueId, queryParams);

      // החזרת התוצאה עם status code המתאים
      const statusCode = result.success ? 200 : result.error?.statusCode || 400;
      return res.status(statusCode).json(result);
    } catch (error) {
      logError(error, {
        route: "GET /api/fixtures/by-league",
        query: req.query,
      });
      const errorResponse = createErrorResponse(
        "INTERNAL_SERVER_ERROR",
        error.message
      );
      return res.status(500).json(errorResponse);
    }
  }
);

// GET /api/fixtures/by-team - שליפת כל משחקי קבוצה עם cache פשוט
router.get(
  "/by-team",
  validateObjectIdQuery("teamId"),
  rateLimit(200),
  async (req, res) => {
    console.log(
      "\x1b[31m%s\x1b[0m",
      "🔥 [ROUTE] GET /api/fixtures/by-team - Request received"
    );
    console.log(req.query);
    try {
      const { teamId, limit = 1000, upcoming, hasOffers } = req.query;

      // קריאה לסרוויס עם כל הפרמטרים
      const result = await getFootballEventsByTeamId(teamId, {
        limit,
        page: 1,
        upcoming,
        hasOffers,
      });

      // החזרת התוצאה
      if (result.success === false) {
        return res.status(400).json(result);
      }

      return res.status(200).json({
        success: true,
        data: result.footballEvents || [],
        pagination: result.pagination,
        fromCache: result.fromCache || false,
      });
    } catch (error) {
      logError(error, {
        route: "GET /api/fixtures/by-team",
        query: req.query,
      });
      const errorResponse = createErrorResponse(
        "INTERNAL_SERVER_ERROR",
        error.message
      );
      return res.status(500).json(errorResponse);
    }
  }
);

// GET /api/fixtures/by-slug/:slug - קבלת ID של משחק לפי slug
router.get("/by-slug/:slug", rateLimit(200), async (req, res) => {
  try {
    const { slug } = req.params;

    if (!slug) {
      return res.status(400).json(
        createErrorResponse("VALIDATION_MISSING_FIELDS", {
          required: ["slug"],
        })
      );
    }

    const result = await getFixtureIdBySlug(slug);

    if (!result) {
      return res.status(404).json(createErrorResponse("FIXTURE_NOT_FOUND"));
    }

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    logError(error, {
      route: "GET /api/fixtures/by-slug/:slug",
      params: req.params,
    });
    return res
      .status(500)
      .json(createErrorResponse("INTERNAL_SERVER_ERROR", error.message));
  }
});

// GET /api/fixtures/:id - קבלת פרטי משחק מלאים לפי ID
router.get("/:id", rateLimit(200), async (req, res) => {
  try {
    const { id } = req.params;

    // בודק אם ה-ID הוא valid ObjectId
    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json(
        createErrorResponse("VALIDATION_INVALID_OBJECTID", {
          field: "id",
          value: id,
        })
      );
    }

    const result = await getFixtureById(id);

    if (!result) {
      return res.status(404).json(createErrorResponse("FIXTURE_NOT_FOUND"));
    }

    return res.status(200).json(result);
  } catch (error) {
    logError(error, {
      route: "GET /api/fixtures/:id",
      params: req.params,
    });
    return res
      .status(500)
      .json(createErrorResponse("INTERNAL_SERVER_ERROR", error.message));
  }
});

export default router;
