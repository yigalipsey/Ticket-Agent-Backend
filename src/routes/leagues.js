import express from "express";
import LeagueService from "../services/league/index.js";
import FootballService from "../services/football/index.js";
import { logRequest, logError } from "../utils/logger.js";
import {
  authenticateToken,
  requireRole,
  rateLimit,
} from "../middleware/auth.js";
import {
  createErrorResponse,
  createSuccessResponse,
} from "../utils/errorCodes.js";

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

// GET /api/leagues - Get all leagues with pagination and filtering
router.get("/", rateLimit(100), async (req, res) => {
  try {
    const result = await LeagueService.query.getAllLeagues(req.query);

    res.json({
      success: true,
      data: result.leagues,
      pagination: result.pagination,
    });
  } catch (error) {
    logError(error, { route: "GET /api/leagues", query: req.query });
    res.status(500).json({
      success: false,
      error: "Failed to fetch leagues",
      message: error.message,
    });
  }
});

// GET /api/leagues/popular - Get popular leagues only
router.get("/popular", rateLimit(100), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const result = await LeagueService.query.getPopularLeagues(limit);

    res.json({
      success: true,
      data: result.leagues,
      count: result.leagues.length,
    });
  } catch (error) {
    logError(error, { route: "GET /api/leagues/popular" });
    res.status(500).json({
      success: false,
      error: "Failed to fetch popular leagues",
      message: error.message,
    });
  }
});

// GET /api/leagues/:id - Get league by ID
router.get("/:id", rateLimit(100), async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: "Invalid league ID format",
      });
    }

    const league = await LeagueService.query.getLeagueById(id);

    if (!league) {
      return res.status(404).json({
        success: false,
        error: "League not found",
      });
    }

    res.json({
      success: true,
      data: league,
    });
  } catch (error) {
    logError(error, { route: "GET /api/leagues/:id", id: req.params.id });
    res.status(500).json({
      success: false,
      error: "Failed to fetch league",
      message: error.message,
    });
  }
});

// GET /api/leagues/league-id/:leagueId - Get league by leagueId
router.get("/league-id/:leagueId", rateLimit(100), async (req, res) => {
  try {
    const { leagueId } = req.params;

    if (!leagueId.match(/^\d+$/)) {
      return res.status(400).json({
        success: false,
        error: "Invalid leagueId format",
      });
    }

    const league = await LeagueService.query.getLeagueByLeagueId(
      parseInt(leagueId)
    );

    if (!league) {
      return res.status(404).json({
        success: false,
        error: "League not found",
      });
    }

    res.json({
      success: true,
      data: league,
    });
  } catch (error) {
    logError(error, {
      route: "GET /api/leagues/league-id/:leagueId",
      leagueId: req.params.leagueId,
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch league",
      message: error.message,
    });
  }
});

// POST /api/leagues - Create new league
router.post(
  "/",
  authenticateToken,
  requireRole("agent"),
  rateLimit(10),
  async (req, res) => {
    try {
      const leagueData = req.body;

      // Basic validation
      if (!leagueData.leagueId || !leagueData.name || !leagueData.country) {
        return res.status(400).json({
          success: false,
          error: "leagueId, name, and country are required",
        });
      }

      const league = await LeagueService.mutate.createLeague(leagueData);

      res.status(201).json({
        success: true,
        data: league,
      });
    } catch (error) {
      logError(error, { route: "POST /api/leagues", body: req.body });
      res.status(500).json({
        success: false,
        error: "Failed to create league",
        message: error.message,
      });
    }
  }
);

// PUT /api/leagues/:id - Update league
router.put(
  "/:id",
  authenticateToken,
  requireRole("agent"),
  rateLimit(20),
  async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;

      if (!id.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: "Invalid league ID format",
        });
      }

      const league = await LeagueService.mutate.updateLeague(id, updateData);

      if (!league) {
        return res.status(404).json({
          success: false,
          error: "League not found",
        });
      }

      res.json({
        success: true,
        data: league,
      });
    } catch (error) {
      logError(error, {
        route: "PUT /api/leagues/:id",
        id: req.params.id,
        body: req.body,
      });
      res.status(500).json({
        success: false,
        error: "Failed to update league",
        message: error.message,
      });
    }
  }
);

export default router;
