import express from "express";
import { getAllLeagues } from "../services/league/queries/getAllLeagues.js";
import { getLeague } from "../services/league/queries/getLeague.js";
import { getLeagueIdBySlug } from "../services/league/queries/getLeagueIdBySlug.js";
import { logRequest, logError } from "../utils/logger.js";
import { rateLimit } from "../middleware/auth.js";

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

// GET /api/leagues - Get all leagues with optional teams
router.get("/", rateLimit(100), async (req, res) => {
  try {
    const { withTeams = false } = req.query;

    const shouldIncludeTeams = withTeams === "true" || withTeams === true;

    // שימוש בסרוויס לשליפת ליגות
    const result = await getAllLeagues(shouldIncludeTeams);

    res.json({
      success: true,
      data: result.leagues,
      count: result.count,
      withTeams: result.withTeams,
      fromCache: result.fromCache,
    });
  } catch (error) {
    logError(error, {
      route: "GET /api/leagues",
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch leagues",
      message: error.message,
    });
  }
});

// GET /api/leagues/:id - Get single league by ID with optional teams
router.get("/:id", rateLimit(100), async (req, res) => {
  try {
    const { id: leagueId } = req.params;
    const { withTeams = false } = req.query;

    const shouldIncludeTeams = withTeams === "true" || withTeams === true;

    // שימוש בסרוויס לשליפת ליגה ספציפית
    const result = await getLeague(leagueId, shouldIncludeTeams);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "League not found",
        message: `League with ID ${leagueId} not found`,
      });
    }

    res.json({
      success: true,
      data: result.league,
      fromCache: result.fromCache,
      stale: result.stale || false,
      withTeams: result.withTeams,
      ...(result.error && { warning: result.error }),
    });
  } catch (error) {
    logError(error, {
      route: "GET /api/leagues/:id",
      params: req.params,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch league",
      message: error.message,
    });
  }
});

// GET /api/leagues/slug/:slug/id - Get only league ID by slug (ultra-fast)
router.get("/slug/:slug/id", rateLimit(100), async (req, res) => {
  try {
    const { slug } = req.params;

    // שימוש בפונקציה ייעודית ומהירה לקבלת ID בלבד
    const result = await getLeagueIdBySlug(slug);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: "League not found",
        message: `League with slug ${slug} not found`,
      });
    }

    // מחזיר רק את ה-ID
    res.json({
      success: true,
      data: {
        _id: result._id,
        slug: result.slug,
      },
      fromCache: result.fromCache,
    });
  } catch (error) {
    logError(error, {
      route: "GET /api/leagues/slug/:slug/id",
      params: req.params,
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch league ID",
      message: error.message,
    });
  }
});

export default router;
