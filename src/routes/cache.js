import express from "express";
import { logRequest, logError } from "../utils/logger.js";
import { rateLimit, auth, requireRole } from "../middleware/auth.js";
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
      // TODO: Implement cache clearing
      res.json({
        success: true,
        message: "Cache cleared successfully",
        clearedEntries: 0,
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

// DELETE /api/cache/hot-fixtures - Clear hot fixtures cache (Super Admin only)
router.delete(
  "/hot-fixtures",
  auth,
  requireRole("super-admin"),
  rateLimit(10),
  async (req, res) => {
    try {
      const result = HotFixturesService.clearCache();
      res.json(result);
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

export default router;
