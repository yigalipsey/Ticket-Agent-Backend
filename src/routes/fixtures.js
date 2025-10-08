import express from "express";
import { logRequest, logError } from "../utils/logger.js";
import { rateLimit } from "../middleware/auth.js";
import HotFixturesService from "../services/footballFixtures/queries/HotFixturesService.js";
import { getLeagueFixturesWithCache } from "../services/footballFixtures/queries/byLeague.js";
import { createErrorResponse } from "../utils/errorCodes.js";

const router = express.Router();

// Middleware for request logging
router.use((req, res, next) => {
  const start = Date.now();

  res.on("finish", () => {
    const responseTime = Date.now() - start;
    logRequest(req, res, responseTime);
  });

  next();
});

// GET /api/fixtures/hot - שליפת משחקים חמים קרובים
router.get("/hot", rateLimit(200), async (req, res) => {
  try {
    const { limit = 5 } = req.query;

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
router.get("/by-league", rateLimit(200), async (req, res) => {
  try {
    const { leagueId, ...queryParams } = req.query;

    // וולידציה
    if (!leagueId) {
      const errorResponse = createErrorResponse(
        "VALIDATION_LEAGUE_ID_REQUIRED"
      );
      return res.status(400).json(errorResponse);
    }

    if (!leagueId.match(/^[0-9a-fA-F]{24}$/)) {
      const errorResponse = createErrorResponse(
        "VALIDATION_INVALID_LEAGUE_ID",
        "Expected MongoDB ObjectId (24 hex characters)"
      );
      return res.status(400).json(errorResponse);
    }

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
});

export default router;
