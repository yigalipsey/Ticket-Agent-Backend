import express from "express";
import { logRequest, logError } from "../utils/logger.js";
import { rateLimit, auth } from "../middleware/auth.js";
import { getFootballEventsByTeamId } from "../services/footballFixtures/queries/byTeam.js";
import HotFixturesService from "../services/footballFixtures/queries/HotFixturesService.js";
import LeagueFixturesService from "../services/footballFixtures/queries/LeagueFixturesService.js";

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

// GET /api/fixtures/by-league - Get league fixtures with advanced caching and filtering
router.get("/by-league", rateLimit(200), async (req, res) => {
  try {
    const { leagueId, ...queryParams } = req.query;

    const result = await LeagueFixturesService.getLeagueFixtures(
      leagueId,
      queryParams
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(result.statusCode || 400).json(result);
    }
  } catch (error) {
    logError(error, {
      route: "GET /api/fixtures/by-league",
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
});

// GET /api/fixtures/by-team - Get team fixtures with advanced caching and filtering
router.get("/by-team", rateLimit(200), async (req, res) => {
  try {
    const {
      teamId,
      month, // חובה
      city,
      hasOffers,
      page = 1,
      limit = 20,
      upcoming = "true",
      sortBy = "date",
      sortOrder = "asc",
      homeOnly = false,
      awayOnly = false,
    } = req.query;

    // וולידציה
    if (!teamId) {
      return res.status(400).json({
        success: false,
        error: "teamId parameter is required",
      });
    }

    // month is now optional - if not provided, fetch all fixtures for the team

    if (!teamId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: "Invalid teamId format",
      });
    }

    // בניית פילטרים
    const filters = {
      page: parseInt(page),
      limit: parseInt(limit),
      month,
      upcoming: upcoming === "true",
      sortBy,
      sortOrder,
    };

    // הוספת פילטרים אופציונליים
    if (city) filters.city = city;
    if (hasOffers === "true") filters.hasOffers = true;
    if (homeOnly === "true") filters.homeOnly = true;
    if (awayOnly === "true") filters.awayOnly = true;

    // קבלת נתונים עם cache
    const result = await getFootballEventsByTeamId(teamId, filters);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "No fixtures found for this team and month",
      });
    }

    res.json({
      success: true,
      data: result.data || [],
      pagination: result.pagination || {},
      meta: {
        fromCache: result.fromCache || false,
        cachedAt: result.cachedAt,
        teamId,
        month,
        filters: filters,
        ...result.meta,
      },
    });
  } catch (error) {
    logError(error, {
      route: "GET /api/fixtures/by-team",
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch team fixtures",
      message: error.message,
    });
  }
});

// GET /api/fixtures/hot - שליפת משחקים חמים קרובים
router.get("/hot", rateLimit(200), async (req, res) => {
  try {
    const { limit = 5 } = req.query;

    const result = await HotFixturesService.getUpcomingHotFixtures(
      parseInt(limit)
    );

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    logError(error, {
      route: "GET /api/fixtures/hot",
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: "שגיאה פנימית בשרת",
    });
  }
});

export default router;
