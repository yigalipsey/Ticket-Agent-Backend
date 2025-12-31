import express from "express";
import { logRequest, logError } from "../utils/logger.js";
import { rateLimit } from "../middleware/userAuth.js";
import {
  searchTeamsWithFixtures,
  getSearchSuggestions,
} from "../services/search/SearchService.js";

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

// GET /api/search/teams - Search for teams with their upcoming fixtures
router.get(
  "/teams",
  rateLimit(20), // 20 requests per minute
  async (req, res) => {
    try {
      const {
        q: query,
        limit,
        fixturesLimit,
        includePastFixtures,
        leagueId,
      } = req.query;

      // Validate required parameters
      if (!query || query.trim().length < 2) {
        return res.status(400).json({
          success: false,
          error: "Invalid query",
          message: "Search query must be at least 2 characters long",
        });
      }

      // Parse and validate optional parameters
      const searchOptions = {
        limit: limit ? parseInt(limit) : 10,
        fixturesLimit: fixturesLimit ? parseInt(fixturesLimit) : 5,
        includePastFixtures: includePastFixtures === "true",
        leagueId: leagueId || null,
        // Always return only fixtures that have offers; teams returned regardless
        onlyWithOffers: true,
      };

      // Validate limits
      if (searchOptions.limit > 50) {
        searchOptions.limit = 50;
      }
      if (searchOptions.fixturesLimit > 20) {
        searchOptions.fixturesLimit = 20;
      }

      // Call the search service
      const result = await searchTeamsWithFixtures(query, searchOptions);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        data: result.data,
        message: `Found ${result.data.totalTeams} teams with ${result.data.totalFixtures} fixtures`,
      });
    } catch (error) {
      logError(error, {
        route: "GET /api/search/teams",
        query: req.query,
      });
      res.status(500).json({
        success: false,
        error: "Search failed",
        message: error.message,
      });
    }
  }
);

// GET /api/search/suggestions - Get search suggestions
router.get(
  "/suggestions",
  rateLimit(30), // 30 requests per minute
  async (req, res) => {
    try {
      const { q: query, limit } = req.query;

      // Validate query
      if (!query || query.trim().length < 1) {
        return res.json({
          success: true,
          data: {
            suggestions: [],
          },
        });
      }

      // Parse limit
      const suggestionLimit = limit ? Math.min(parseInt(limit), 10) : 5;

      // Call the suggestions service
      const result = await getSearchSuggestions(query, suggestionLimit);

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json({
        success: true,
        data: result.data,
      });
    } catch (error) {
      logError(error, {
        route: "GET /api/search/suggestions",
        query: req.query,
      });
      res.status(500).json({
        success: false,
        error: "Suggestions failed",
        message: error.message,
      });
    }
  }
);

// GET /api/search/health - Health check for search service
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Search service is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;
