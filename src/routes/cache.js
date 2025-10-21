import express from "express";
import { logRequest, logError } from "../utils/logger.js";
import { rateLimit, auth, requireRole } from "../middleware/userAuth.js";
import fixturesByTeamCacheService from "../services/footballFixtures/cache/FixturesByTeamCacheService.js";
import fixturesByLeagueCacheService from "../services/footballFixtures/cache/FixturesByLeagueCacheService.js";

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
        const deleted = fixturesByTeamCacheService.delete(teamId);
        res.json({
          success: true,
          message: `Team fixtures cache cleared for team: ${teamId}`,
          clearedEntries: deleted ? 1 : 0,
          teamId,
        });
      } else {
        // מחיקת כל ה-cache של קבוצות
        const clearedEntries = fixturesByTeamCacheService.clear();
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
