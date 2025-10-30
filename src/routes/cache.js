import express from "express";
import { logRequest, logError, logWithCheckpoint } from "../utils/logger.js";
import { rateLimit, auth, requireRole } from "../middleware/userAuth.js";
import fixturesByTeamCacheService from "../services/footballFixtures/cache/FixturesByTeamCacheService.js";
import fixturesByLeagueCacheService from "../services/footballFixtures/cache/FixturesByLeagueCacheService.js";
import leagueCacheService from "../services/league/cache/LeagueCacheService.js";
import offersByFixtureCacheService from "../services/offer/cache/OffersByFixtureCacheService.js";
import HotFixturesService from "../services/footballFixtures/queries/HotFixturesService.js";

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

// DELETE /api/cache/leagues - Clear leagues cache (Super Admin only)
router.delete(
  "/leagues",
  auth,
  requireRole("super-admin"),
  rateLimit(10),
  async (req, res) => {
    try {
      const clearedEntries = fixturesByLeagueCacheService.clear();
      res.json({
        success: true,
        message: "League fixtures cache cleared successfully",
        clearedEntries,
      });
    } catch (error) {
      logError(error, { route: "DELETE /api/cache/leagues" });
      res.status(500).json({
        success: false,
        error: "Failed to clear leagues cache",
        message: error.message,
      });
    }
  }
);

// DELETE /api/cache/teams - Clear team fixtures cache (Super Admin only)
router.delete(
  "/teams",
  auth,
  requireRole("super-admin"),
  rateLimit(10),
  async (req, res) => {
    try {
      const { teamId } = req.query;

      if (teamId) {
        // מחיקת cache של קבוצה ספציפית
        logWithCheckpoint(
          "info",
          "Starting to clear team fixtures cache for specific team",
          "CACHE_CLEAR_TEAM_001",
          { teamId }
        );
        const deleted = fixturesByTeamCacheService.delete(teamId);
        logWithCheckpoint(
          "info",
          "Team fixtures cache cleared for specific team",
          "CACHE_CLEAR_TEAM_002",
          { teamId, deleted: deleted ? true : false }
        );
        res.json({
          success: true,
          message: `Team fixtures cache cleared for team: ${teamId}`,
          clearedEntries: deleted ? 1 : 0,
          teamId,
        });
      } else {
        // מחיקת כל ה-cache של קבוצות
        logWithCheckpoint(
          "info",
          "Starting to clear all team fixtures cache",
          "CACHE_CLEAR_TEAMS_001"
        );
        const clearedEntries = fixturesByTeamCacheService.clear();
        logWithCheckpoint(
          "info",
          "All team fixtures cache cleared successfully",
          "CACHE_CLEAR_TEAMS_002",
          { clearedEntries }
        );
        res.json({
          success: true,
          message: "All team fixtures cache cleared successfully",
          clearedEntries,
        });
      }
    } catch (error) {
      logError(error, { route: "DELETE /api/cache/teams" });
      res.status(500).json({
        success: false,
        error: "Failed to clear team fixtures cache",
        message: error.message,
      });
    }
  }
);

// DELETE /api/cache/all - Clear ALL caches (Super Admin only)
router.delete(
  "/all",
  auth,
  requireRole("super-admin"),
  rateLimit(5),
  async (req, res) => {
    try {
      logWithCheckpoint(
        "info",
        "Starting to clear all server caches",
        "CACHE_CLEAR_ALL_001"
      );

      const results = {
        teamFixtures: fixturesByTeamCacheService.clear(),
        leagueFixtures: fixturesByLeagueCacheService.clear(),
        leagues: leagueCacheService.clear(),
        offersByFixture: offersByFixtureCacheService.clear(),
        hotFixtures: HotFixturesService.clearCache(),
      };

      const totalCleared = Object.values(results).reduce((sum, val) => {
        if (typeof val === "number") return sum + val;
        if (val && typeof val === "object" && val.clearedEntries) {
          return sum + val.clearedEntries;
        }
        return sum;
      }, 0);

      logWithCheckpoint(
        "info",
        "All server caches cleared successfully",
        "CACHE_CLEAR_ALL_002",
        { results, totalCleared }
      );

      res.json({
        success: true,
        message: "All server caches cleared successfully",
        results: {
          teamFixtures: {
            clearedEntries: results.teamFixtures,
            message: "Team fixtures cache cleared",
          },
          leagueFixtures: {
            clearedEntries: results.leagueFixtures,
            message: "League fixtures cache cleared",
          },
          leagues: {
            clearedEntries: results.leagues,
            message: "Leagues cache cleared",
          },
          offersByFixture: {
            clearedEntries: results.offersByFixture,
            message: "Offers by fixture cache cleared",
          },
          hotFixtures: {
            clearedEntries:
              results.hotFixtures?.clearedEntries || results.hotFixtures || 0,
            message: "Hot fixtures cache cleared",
          },
        },
        totalCleared,
      });
    } catch (error) {
      logError(error, { route: "DELETE /api/cache/all" });
      res.status(500).json({
        success: false,
        error: "Failed to clear all caches",
        message: error.message,
      });
    }
  }
);

// DELETE /api/cache/hot-fixtures - Clear only hot fixtures cache (Super Admin only)
router.delete(
  "/hot-fixtures",
  auth,
  requireRole("super-admin"),
  rateLimit(10),
  async (req, res) => {
    try {
      logWithCheckpoint(
        "info",
        "Starting to clear hot fixtures cache",
        "CACHE_CLEAR_HOT_001"
      );

      const result = HotFixturesService.clearCache();

      logWithCheckpoint(
        "info",
        "Hot fixtures cache cleared successfully",
        "CACHE_CLEAR_HOT_002",
        { result }
      );

      res.json({
        success: true,
        message: "Hot fixtures cache cleared successfully",
        clearedEntries: result?.clearedEntries || result || 0,
      });
    } catch (error) {
      logError(error, { route: "DELETE /api/cache/hot-fixtures" });
      res.status(500).json({
        success: false,
        error: "Failed to clear hot fixtures cache",
        message: error.message,
      });
    }
  }
);

// GET /api/cache/stats - Get cache statistics (Admin only)
router.get(
  "/stats",
  auth,
  requireRole("admin"),
  rateLimit(20),
  async (req, res) => {
    try {
      const teamCacheStats = fixturesByTeamCacheService.getStats();
      const leagueCacheStats = fixturesByLeagueCacheService.getStats();

      res.json({
        success: true,
        data: {
          teamFixtures: teamCacheStats,
          leagueFixtures: leagueCacheStats,
        },
      });
    } catch (error) {
      logError(error, { route: "GET /api/cache/stats" });
      res.status(500).json({
        success: false,
        error: "Failed to get cache stats",
        message: error.message,
      });
    }
  }
);

export default router;
