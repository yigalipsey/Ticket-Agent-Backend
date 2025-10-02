import express from "express";
import TeamService from "../services/team/index.js";
import FootballService from "../services/football/index.js";
import { logRequest, logError } from "../utils/logger.js";
import {
  authenticateToken,
  requireRole,
  rateLimit,
} from "../middleware/auth.js";
import mongoose from "mongoose";
// Helper functions
const isValidObjectId = (id) => mongoose.Types.ObjectId.isValid(id);

const sendSuccess = (res, data, message = "SUCCESS", statusCode = 200) => {
  res.status(statusCode).json({ success: true, data, message });
};

const sendError = (
  res,
  errorCode = "INTERNAL_SERVER_ERROR",
  details = null,
  statusCode = 500
) => {
  res.status(statusCode).json({ success: false, error: errorCode, details });
};

const sendPaginated = (
  res,
  data,
  pagination,
  message = "SUCCESS",
  statusCode = 200
) => {
  res.status(statusCode).json({ success: true, data, pagination, message });
};

const sendObjectIdError = (res, fieldName = "ID") => {
  sendError(
    res,
    "VALIDATION_ERROR",
    { field: fieldName, expected: "Valid MongoDB ObjectID" },
    400
  );
};

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

// GET /api/teams - Get all teams with pagination and filtering
router.get("/", rateLimit(100), async (req, res) => {
  try {
    const result = await TeamService.query.getAllTeams(req.query);
    sendPaginated(res, result.teams, result.pagination, "TEAMS_FETCHED");
  } catch (error) {
    logError(error, { route: "GET /api/teams", query: req.query });
    sendError(res, "INTERNAL_SERVER_ERROR", null, 500);
  }
});

// GET /api/teams/:id/fixtures - Get fixtures for a specific team by ID
router.get("/:id/fixtures", rateLimit(100), async (req, res) => {
  try {
    const { id } = req.params;

    // Validate ObjectID format
    if (!isValidObjectId(id)) {
      return sendObjectIdError(res, "team ID");
    }

    // Get fixtures for this team using the team's _id
    const result = await FootballService.query.getFootballEventsByTeamId(
      id,
      req.query
    );

    sendSuccess(
      res,
      {
        team: result.team,
        fixtures: result.footballEvents,
        pagination: result.pagination,
      },
      "TEAM_FIXTURES_FETCHED"
    );
  } catch (error) {
    logError(error, {
      route: "GET /api/teams/:id/fixtures",
      id: req.params.id,
      query: req.query,
    });
    sendError(res, "INTERNAL_SERVER_ERROR", null, 500);
  }
});

// GET /api/teams/league/:leagueId - Get teams by league with caching
router.get("/league/:leagueId", rateLimit(100), async (req, res) => {
  try {
    const { leagueId } = req.params;

    // Validate ObjectID format
    if (!isValidObjectId(leagueId)) {
      return sendObjectIdError(res, "league ID");
    }

    const locale =
      req.query.locale ||
      req.headers["accept-language"]?.split(",")[0]?.split("-")[0] ||
      "he";

    const teams = await TeamService.query.getTeamsByLeagueId(leagueId, locale);

    sendSuccess(res, teams, "TEAMS_BY_LEAGUE_FETCHED");
  } catch (error) {
    logError(error, {
      route: "GET /api/teams/league/:leagueId",
      leagueId: req.params.leagueId,
    });
    sendError(res, "INTERNAL_SERVER_ERROR", null, 500);
  }
});

// GET /api/teams/:id - Get team by ID
router.get("/:id", rateLimit(100), async (req, res) => {
  try {
    const { id } = req.params;

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        error: "Invalid team ID format",
      });
    }

    const team = await TeamService.query.getTeamById(id);

    if (!team) {
      return res.status(404).json({
        success: false,
        error: "Team not found",
      });
    }

    res.json({
      success: true,
      data: team,
    });
  } catch (error) {
    logError(error, { route: "GET /api/teams/:id", id: req.params.id });
    res.status(500).json({
      success: false,
      error: "Failed to fetch team",
      message: error.message,
    });
  }
});

// POST /api/teams - Create new team
router.post(
  "/",
  authenticateToken,
  requireRole("agent"),
  rateLimit(10),
  async (req, res) => {
    try {
      const teamData = req.body;

      // Basic validation
      if (!teamData.name || !teamData.code || !teamData.country) {
        return res.status(400).json({
          success: false,
          error: "Name, code, and country are required",
        });
      }

      const team = await TeamService.mutate.createTeam(teamData);

      res.status(201).json({
        success: true,
        data: team,
      });
    } catch (error) {
      logError(error, { route: "POST /api/teams", body: req.body });
      res.status(500).json({
        success: false,
        error: "Failed to create team",
        message: error.message,
      });
    }
  }
);

// PUT /api/teams/:id - Update team
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
          error: "Invalid team ID format",
        });
      }

      const team = await TeamService.mutate.updateTeam(id, updateData);

      if (!team) {
        return res.status(404).json({
          success: false,
          error: "Team not found",
        });
      }

      res.json({
        success: true,
        data: team,
      });
    } catch (error) {
      logError(error, {
        route: "PUT /api/teams/:id",
        id: req.params.id,
        body: req.body,
      });
      res.status(500).json({
        success: false,
        error: "Failed to update team",
        message: error.message,
      });
    }
  }
);

export default router;
