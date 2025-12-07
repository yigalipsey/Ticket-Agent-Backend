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

// DELETE /api/cache/leagues/:leagueId - Clear cache for specific league (Super Admin only)
router.delete(
  "/leagues/:leagueId",
  auth,
  requireRole("super-admin"),
  rateLimit(20),
  async (req, res) => {
    try {
      const { leagueId } = req.params;

      if (!leagueId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: "Invalid leagueId format",
          message: "leagueId must be a valid MongoDB ObjectId",
        });
      }

      logWithCheckpoint(
        "info",
        "Starting to clear league fixtures cache for specific league",
        "CACHE_CLEAR_LEAGUE_001",
        { leagueId }
      );

      const deletedCount = fixturesByLeagueCacheService.deleteLeague(leagueId);

      logWithCheckpoint(
        "info",
        "League fixtures cache cleared for specific league",
        "CACHE_CLEAR_LEAGUE_002",
        { leagueId, deletedCount }
      );

      res.json({
        success: true,
        message: `League fixtures cache cleared for league: ${leagueId}`,
        clearedEntries: deletedCount,
        leagueId,
      });
    } catch (error) {
      logError(error, { route: "DELETE /api/cache/leagues/:leagueId" });
      res.status(500).json({
        success: false,
        error: "Failed to clear league fixtures cache",
        message: error.message,
      });
    }
  }
);

// DELETE /api/cache/leagues - Clear ALL leagues cache (Super Admin only)
router.delete(
  "/leagues",
  auth,
  requireRole("super-admin"),
  rateLimit(10),
  async (req, res) => {
    try {
      const { type } = req.query; // 'fixtures' or 'leagues' or both (default)

      const results = {};

      // Clear league fixtures cache
      if (!type || type === "fixtures" || type === "all") {
        results.fixtures = fixturesByLeagueCacheService.clear();
      }

      // Clear leagues data cache (the one used by /api/leagues endpoint)
      if (!type || type === "leagues" || type === "all") {
        results.leagues = leagueCacheService.clear();
        results.slugToId = leagueCacheService.slugToIdCache.clear();
      }

      const totalCleared = Object.values(results).reduce((sum, val) => {
        return sum + (typeof val === "number" ? val : 0);
      }, 0);

      res.json({
        success: true,
        message: "Leagues cache cleared successfully",
        clearedEntries: totalCleared,
        details: results,
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
        // hotFixtures: אין cache למשחקים חמים - מביאים ישירות מה-DB
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

// DELETE /api/cache/hot-fixtures - אין cache למשחקים חמים (מביאים ישירות מה-DB)
router.delete(
  "/hot-fixtures",
  auth,
  requireRole("super-admin"),
  rateLimit(10),
  async (req, res) => {
    try {
      logWithCheckpoint(
        "info",
        "Hot fixtures cache clear requested - no cache exists",
        "CACHE_CLEAR_HOT_001"
      );

      res.json({
        success: true,
        message: "אין cache למשחקים חמים - הנתונים מביאים ישירות מה-DB",
        clearedEntries: 0,
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

// DELETE /api/cache/offers - Clear ALL offers cache (Super Admin only)
// NOTE: This route MUST come before /offers/:fixtureId to avoid route matching conflicts
router.delete(
  "/offers",
  auth,
  requireRole("super-admin"),
  rateLimit(10),
  async (req, res) => {
    try {
      logWithCheckpoint(
        "info",
        "Starting to clear all offers cache",
        "CACHE_CLEAR_OFFERS_ALL_001"
      );

      const clearedEntries = offersByFixtureCacheService.clear();

      logWithCheckpoint(
        "info",
        "All offers cache cleared successfully",
        "CACHE_CLEAR_OFFERS_ALL_002",
        { clearedEntries }
      );

      res.json({
        success: true,
        message: "All offers cache cleared successfully",
        clearedEntries,
      });
    } catch (error) {
      logError(error, { route: "DELETE /api/cache/offers" });
      res.status(500).json({
        success: false,
        error: "Failed to clear offers cache",
        message: error.message,
      });
    }
  }
);

// DELETE /api/cache/offers/:fixtureId - Clear offers cache for a specific fixture (Super Admin only)
router.delete(
  "/offers/:fixtureId",
  auth,
  requireRole("super-admin"),
  rateLimit(20),
  async (req, res) => {
    try {
      const { fixtureId } = req.params;

      if (!fixtureId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          success: false,
          error: "Invalid fixtureId format",
          message: "fixtureId must be a valid MongoDB ObjectId",
        });
      }

      logWithCheckpoint(
        "info",
        "Starting to clear offers cache for specific fixture",
        "CACHE_CLEAR_OFFERS_001",
        { fixtureId }
      );

      const deleted = offersByFixtureCacheService.delete(fixtureId);

      logWithCheckpoint(
        "info",
        "Offers cache cleared for specific fixture",
        "CACHE_CLEAR_OFFERS_002",
        { fixtureId, deleted }
      );

      res.json({
        success: true,
        message: `Offers cache cleared for fixture: ${fixtureId}`,
        clearedEntries: deleted ? 1 : 0,
        fixtureId,
      });
    } catch (error) {
      logError(error, { route: "DELETE /api/cache/offers/:fixtureId" });
      res.status(500).json({
        success: false,
        error: "Failed to clear offers cache",
        message: error.message,
      });
    }
  }
);

export default router;
