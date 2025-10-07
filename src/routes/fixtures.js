import express from "express";
import { logRequest, logError } from "../utils/logger.js";
import { rateLimit } from "../middleware/auth.js";
import HotFixturesService from "../services/footballFixtures/queries/HotFixturesService.js";
import { getLeagueFixturesWithCache } from "../services/footballFixtures/queries/byLeague.js";

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

// GET /api/fixtures/by-league - שליפת משחקי ליגה עם cache ופילטרים
router.get("/by-league", rateLimit(200), async (req, res) => {
  try {
    const { leagueId, ...queryParams } = req.query;

    // וולידציה
    if (!leagueId) {
      return res.status(400).json({
        success: false,
        error: "leagueId parameter is required",
      });
    }

    if (!leagueId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: "Invalid leagueId format",
      });
    }

    const result = await getLeagueFixturesWithCache(leagueId, queryParams);

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
      error: "שגיאה פנימית בשרת",
    });
  }
});

export default router;
