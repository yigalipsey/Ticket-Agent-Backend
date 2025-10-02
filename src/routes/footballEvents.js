import express from "express";
import FootballService from "../services/football/index.js";
import { logRequest, logError } from "../utils/logger.js";
import {
  authenticateToken,
  requireRole,
  rateLimit,
} from "../middleware/auth.js";

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

// GET /api/football-events or /api/fixtures - Get all football events with pagination and filtering
router.get("/", rateLimit(100), async (req, res) => {
  try {
    const result = await FootballService.query.getAllFootballEvents(req.query);

    res.json({
      success: true,
      data: result.footballEvents,
      pagination: result.pagination,
    });
  } catch (error) {
    logError(error, { route: "GET /api/football-events", query: req.query });
    res.status(500).json({
      success: false,
      error: "Failed to fetch football events",
      message: error.message,
    });
  }
});

// GET /api/football-events/:id - Get football event by ID
router.get("/:id", rateLimit(100), async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: "Invalid football event ID format",
      });
    }

    const footballEvent = await FootballService.query.getFootballEventById(id);

    if (!footballEvent) {
      return res.status(404).json({
        success: false,
        error: "Football event not found",
      });
    }

    res.json({
      success: true,
      data: footballEvent,
    });
  } catch (error) {
    logError(error, {
      route: "GET /api/football-events/:id",
      id: req.params.id,
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch football event",
      message: error.message,
    });
  }
});

// GET /api/football-events/team/:teamId - Get events by team
router.get("/team/:teamId", rateLimit(100), async (req, res) => {
  try {
    const { teamId } = req.params;
    const { limit = 10, upcoming = true, includePast = false } = req.query;

    if (!teamId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: "Invalid team ID format",
      });
    }

    const result = await FootballService.query.getFootballEventsByTeamId(
      teamId,
      {
        limit: parseInt(limit),
        upcoming: upcoming === "true",
        includePast: includePast === "true",
      }
    );

    res.json({
      success: true,
      data: result.footballEvents,
      total: result.total,
      teamId: teamId,
      options: { limit, upcoming, includePast },
    });
  } catch (error) {
    logError(error, {
      route: "GET /api/football-events/team/:teamId",
      teamId: req.params.teamId,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch team events",
      message: error.message,
    });
  }
});

// GET /api/football-events/league/:leagueId - Get events by league
router.get("/league/:leagueId", rateLimit(100), async (req, res) => {
  try {
    const { leagueId } = req.params;
    const { page = 1, limit = 20, upcoming = "false" } = req.query;

    if (!leagueId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: "Invalid league ID format",
      });
    }

    const result = await FootballService.query.getFootballEventsByLeagueId(
      leagueId,
      {
        page: parseInt(page),
        limit: parseInt(limit),
        upcoming: upcoming === "true",
      }
    );

    res.json({
      success: true,
      data: result.footballEvents,
      pagination: result.pagination,
      leagueId: leagueId,
    });
  } catch (error) {
    logError(error, {
      route: "GET /api/football-events/league/:leagueId",
      leagueId: req.params.leagueId,
      query: req.query,
    });
    res.status(500).json({
      success: false,
      error: "Failed to fetch league events",
      message: error.message,
    });
  }
});

// POST /api/football-events - Create new football event
router.post(
  "/",
  authenticateToken,
  requireRole("agent"),
  rateLimit(10),
  async (req, res) => {
    try {
      const footballEventData = req.body;

      // Basic validation
      const requiredFields = [
        "eventId",
        "league",
        "season",
        "homeTeamId",
        "awayTeamId",
        "venueId",
      ];
      const missingFields = requiredFields.filter(
        (field) => !footballEventData[field]
      );

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(", ")}`,
        });
      }

      // Validate ObjectId formats
      const objectIdFields = ["eventId", "homeTeamId", "awayTeamId", "venueId"];
      for (const field of objectIdFields) {
        if (!footballEventData[field].match(/^[0-9a-fA-F]{24}$/)) {
          return res.status(400).json({
            success: false,
            error: `Invalid ${field} format`,
          });
        }
      }

      const footballEvent = await FootballService.mutate.createFootballEvent(
        footballEventData
      );

      res.status(201).json({
        success: true,
        data: footballEvent,
      });
    } catch (error) {
      logError(error, { route: "POST /api/football-events", body: req.body });
      res.status(500).json({
        success: false,
        error: "Failed to create football event",
        message: error.message,
      });
    }
  }
);

// PUT /api/football-events/:id - Update football event
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
          error: "Invalid football event ID format",
        });
      }

      const footballEvent = await FootballService.mutate.updateFootballEvent(
        id,
        updateData
      );

      if (!footballEvent) {
        return res.status(404).json({
          success: false,
          error: "Football event not found",
        });
      }

      res.json({
        success: true,
        data: footballEvent,
      });
    } catch (error) {
      logError(error, {
        route: "PUT /api/football-events/:id",
        id: req.params.id,
        body: req.body,
      });
      res.status(500).json({
        success: false,
        error: "Failed to update football event",
        message: error.message,
      });
    }
  }
);

export default router;
